"use server";
// The "Account" page: change name, email or password, or delete the account.

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { getI18n } from "@/i18n/server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { expireOrder } from "@/lib/payments/service";
import { prisma } from "@/lib/prisma";
import { clearAttempts } from "@/lib/rate-limit";
import { deleteOtherSessions, deleteSession, requireUser } from "@/lib/session";

export type AccountState = { ok?: boolean; error?: string } | undefined;

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The user's password check (current password typed into the form).
async function passwordMatches(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  return verifyPassword(password, user.passwordHash);
}

export async function updateName(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/account");
  const t = (await getI18n()).dict.errors;
  const name = field(formData, "name").trim().slice(0, 80);
  if (name.length < 2) return { error: t.name };
  await prisma.user.update({ where: { id: user.id }, data: { name } });
  return { ok: true };
}

export async function updateEmail(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/account");
  const t = (await getI18n()).dict.errors;
  const email = field(formData, "email").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { error: t.email };
  if (!(await passwordMatches(user.id, field(formData, "password")))) return { error: t.wrongPassword };
  try {
    await prisma.user.update({ where: { id: user.id }, data: { email } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { error: t.emailTaken };
    throw error;
  }
  return { ok: true };
}

export async function updatePassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/account");
  const { dict, fill } = await getI18n();
  const next = field(formData, "newPassword");
  if (next.length < 8) return { error: fill(dict.errors.passwordShort, { n: 8 }) };
  if (!(await passwordMatches(user.id, field(formData, "password")))) return { error: dict.errors.wrongPassword };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await deleteOtherSessions(user.id); // this browser stays logged in
  return { ok: true };
}

// Delete the account (the privacy policy's "right to deletion"). Personal
// details are wiped; orders and payments stay, anonymised, because the law
// requires keeping them. Not allowed while paid orders are waiting for pickup.
export async function deleteAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const user = await requireUser("/account");
  const t = (await getI18n()).dict;
  if (!(await passwordMatches(user.id, field(formData, "password")))) return { error: t.errors.wrongPassword };

  // Paid orders still to be picked up (as a customer, or at the user's stores).
  const [ownActive, storeActive] = await Promise.all([
    prisma.order.count({ where: { userId: user.id, status: "RESERVED", bag: { pickupEnd: { gt: new Date() } } } }),
    prisma.order.count({ where: { status: "RESERVED", bag: { pickupEnd: { gt: new Date() }, store: { ownerId: user.id } } } }),
  ]);
  if (ownActive > 0) return { error: t.account.activeOrders };
  if (storeActive > 0) return { error: t.account.storeActiveOrders };

  // Unpaid holds just expire (the bags go back on sale).
  const holds = await prisma.order.findMany({ where: { userId: user.id, status: "PENDING_PAYMENT" }, select: { id: true } });
  for (const { id } of holds) await expireOrder(id);

  const oldEmail = user.email;
  await prisma.$transaction([
    // Stores disappear from the site; their order history stays.
    prisma.store.updateMany({
      where: { ownerId: user.id },
      data: { status: "REJECTED", rejectionReason: "Account deleted" },
    }),
    prisma.bagSchedule.updateMany({ where: { store: { ownerId: user.id } }, data: { isActive: false } }),
    prisma.surpriseBag.updateMany({ where: { store: { ownerId: user.id } }, data: { isActive: false } }),
    prisma.favorite.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        name: "—",
        email: `deleted-${user.id}@deleted.invalid`, // frees the address; never deliverable
        passwordHash: `deleted$${randomBytes(16).toString("hex")}`, // can't match any password
        consentAt: null,
        consentVersion: null,
        deletedAt: new Date(),
      },
    }),
  ]);
  await clearAttempts("login", oldEmail);
  await deleteSession();
  redirect("/");
}
