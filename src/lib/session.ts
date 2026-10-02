// Login sessions: who is making this request?
import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Log a user in on this browser. Call only from a Server Action.
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url"); // unguessable
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true, // JavaScript in the page can't read it
    secure: process.env.NODE_ENV === "production", // HTTPS-only once deployed
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

// Log out on this browser. Call only from a Server Action.
export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(COOKIE_NAME);
}

// Log out everywhere except this browser (e.g. after a password change).
export async function deleteOtherSessions(userId: string) {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  await prisma.session.deleteMany({
    where: { userId, ...(token && { tokenHash: { not: hashToken(token) } }) },
  });
}

// The logged-in user, or null. `cache` makes repeat calls during one request
// (header, page, …) share a single database lookup.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    // Select only safe fields: never send passwordHash anywhere.
    include: { user: { select: { id: true, name: true, email: true, role: true, consentVersion: true } } },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// For pages and actions that need a login: returns the user, or sends them to
// /login, which brings them back to `returnTo` afterwards.
export async function requireUser(returnTo = "/") {
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(returnTo));
  return user;
}

// For admin pages and actions. Everyone else is sent to the homepage.
export async function requireAdmin(returnTo = "/admin") {
  const user = await requireUser(returnTo);
  if (user.role !== "ADMIN") redirect("/");
  return user;
}

// For store-owner pages and actions. Customers are sent to the homepage.
export async function requireOwner(returnTo = "/dashboard") {
  const user = await requireUser(returnTo);
  if (user.role !== "STORE_OWNER") redirect("/");
  return user;
}

export const loginUrl =(returnTo: string) => `/login?next=${encodeURIComponent(returnTo)}`;

// Only allow redirects to our own pages. "//evil.com" or "https://evil.com"
// would otherwise send users to another site after logging in.
export function safeReturnPath(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/";
}
