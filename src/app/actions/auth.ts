"use server";
// Server Actions: these functions run on the server, but forms can call them
// directly. Anything here is reachable from the browser, so validate everything.

import { randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { LEGAL_VERSION } from "@/content/legal";
import { getI18n } from "@/i18n/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { sendEmail, siteUrl } from "@/lib/mailer";
import { clearAttempts, clientIp, recordAttempt, retryAfterMinutes } from "@/lib/rate-limit";
import { hashResetToken, RESET_HOURS } from "@/lib/reset-tokens";
import { createSession, deleteSession, getCurrentUser, safeReturnPath } from "@/lib/session";

export type AuthFormState =
  | {
      errors?: { name?: string; email?: string; password?: string; consent?: string; form?: string };
      // Echoed back so the form keeps what the user typed after an error.
      values?: { name?: string; email?: string; role?: string };
    }
  | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "");

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const name = field(formData, "name").trim();
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  // Only these two are allowed from the form; nobody can sign up as ADMIN.
  const role = field(formData, "role") === "STORE_OWNER" ? "STORE_OWNER" : "CUSTOMER";
  const values = { name, email, role };
  const { dict, fill } = await getI18n();
  const t = dict.errors;

  const errors: NonNullable<AuthFormState>["errors"] = {};
  if (name.length < 2) errors.name = t.name;
  if (!EMAIL_PATTERN.test(email)) errors.email = t.email;
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = fill(t.passwordShort, { n: MIN_PASSWORD_LENGTH });
  // Consent to the terms and personal data processing is required by law.
  if (formData.get("consent") !== "yes") errors.consent = t.consentRequired;
  if (Object.keys(errors).length > 0) return { errors, values };

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        passwordHash: await hashPassword(password),
        consentAt: new Date(), // proof of consent: when, and to which version
        consentVersion: LEGAL_VERSION,
      },
    });
    userId = user.id;
  } catch (error) {
    // P2002 = unique constraint failed, i.e. this email is already registered.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { errors: { email: t.emailTaken }, values };
    }
    throw error;
  }

  await createSession(userId);
  // New store owners go straight to setting up their store.
  const next = safeReturnPath(formData.get("next"));
  // redirect() works by throwing, so it must stay outside try/catch.
  redirect(next === "/" && role === "STORE_OWNER" ? "/dashboard" : next);
}

// Used when the email doesn't exist, so a wrong email takes as long as a wrong
// password. Otherwise response timing would reveal which emails have accounts.
const dummyHash = hashPassword("not-a-real-password");

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = field(formData, "email").trim().toLowerCase();
  const password = field(formData, "password");
  const { dict, fill } = await getI18n();
  const ip = await clientIp();

  // Stop password guessing: too many failures for this email (or from this
  // IP address) → wait. Checked before the password, so guesses don't count.
  const wait = Math.max(
    await retryAfterMinutes("login", email),
    ip ? await retryAfterMinutes("login-ip", ip) : 0,
  );
  if (wait > 0) return { errors: { form: fill(dict.errors.tooManyAttempts, { n: wait }) }, values: { email } };

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));

  if (!user || !valid) {
    await recordAttempt("login", email);
    if (ip) await recordAttempt("login-ip", ip);
    // Same message either way, so we don't reveal whether the email exists.
    return { errors: { form: dict.errors.badCredentials }, values: { email } };
  }

  await clearAttempts("login", email);
  await createSession(user.id);
  redirect(safeReturnPath(formData.get("next")));
}

// ── Password reset ────────────────────────────────────────────────────────

export type ResetRequestState = { sent?: boolean; error?: string; email?: string } | undefined;

// "Forgot password?": email a one-time link. The reply is the same whether or
// not the account exists, so this can't be used to discover who has one.
export async function requestPasswordReset(_prev: ResetRequestState, formData: FormData): Promise<ResetRequestState> {
  const email = field(formData, "email").trim().toLowerCase();
  const { dict, fill } = await getI18n();
  if (!EMAIL_PATTERN.test(email)) return { error: dict.errors.email, email };

  // Limit per address so nobody can flood someone's inbox.
  const wait = await retryAfterMinutes("reset", email);
  if (wait > 0) return { error: fill(dict.errors.tooManyAttempts, { n: wait }), email };
  await recordAttempt("reset", email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = randomBytes(32).toString("base64url");
    // Only the newest link works.
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.passwordResetToken.create({
      data: { tokenHash: hashResetToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_HOURS * 3_600_000) },
    });
    const link = `${await siteUrl()}/reset-password?token=${token}`;
    await sendEmail({ to: email, subject: dict.reset.emailSubject, text: fill(dict.reset.emailBody, { name: user.name, link }) });
  }
  return { sent: true };
}

export type ResetState = { error?: string; invalid?: boolean } | undefined;

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = field(formData, "token");
  const password = field(formData, "password");
  const { dict, fill } = await getI18n();
  if (password.length < MIN_PASSWORD_LENGTH) return { error: fill(dict.errors.passwordShort, { n: MIN_PASSWORD_LENGTH }) };

  const passwordHash = await hashPassword(password);
  const userId = await prisma.$transaction(async (tx) => {
    // Use up the link in the same step that checks it, so it works only once.
    const reset = await tx.passwordResetToken.findFirst({
      where: { tokenHash: hashResetToken(token), usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!reset) return null;
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: reset.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 0) return null;
    await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
    // Log out every device: whoever knew the old password is locked out.
    await tx.session.deleteMany({ where: { userId: reset.userId } });
    return reset.userId;
  });
  if (!userId) return { invalid: true };

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await clearAttempts("login", user.email);
  await createSession(userId);
  redirect(user.role === "STORE_OWNER" ? "/dashboard" : "/");
}

// Consent banner: record agreement to the current terms and privacy policy.
export async function acceptTerms() {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.user.update({
    where: { id: user.id },
    data: { consentAt: new Date(), consentVersion: LEGAL_VERSION },
  });
  // Redraw the page so the banner disappears straight away. (Nothing else
  // changes in this action, so without this the browser keeps the old page.)
  refresh();
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
