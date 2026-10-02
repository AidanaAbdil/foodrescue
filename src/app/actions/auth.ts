"use server";
// Server Actions: these functions run on the server, but forms can call them
// directly. Anything here is reachable from the browser, so validate everything.

import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession, safeReturnPath } from "@/lib/session";

export type AuthFormState =
  | {
      errors?: { name?: string; email?: string; password?: string; form?: string };
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

  const errors: NonNullable<AuthFormState>["errors"] = {};
  if (name.length < 2) errors.name = "Please enter your name.";
  if (!EMAIL_PATTERN.test(email)) errors.email = "Please enter a valid email address.";
  if (password.length < MIN_PASSWORD_LENGTH)
    errors.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (Object.keys(errors).length > 0) return { errors, values };

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: { name, email, role, passwordHash: await hashPassword(password) },
    });
    userId = user.id;
  } catch (error) {
    // P2002 = unique constraint failed, i.e. this email is already registered.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { errors: { email: "An account with this email already exists. Try logging in." }, values };
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

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));

  if (!user || !valid) {
    // Same message either way, so we don't reveal whether the email exists.
    return { errors: { form: "Incorrect email or password." }, values: { email } };
  }

  await createSession(user.id);
  redirect(safeReturnPath(formData.get("next")));
}

export async function logout() {
  await deleteSession();
  redirect("/");
}
