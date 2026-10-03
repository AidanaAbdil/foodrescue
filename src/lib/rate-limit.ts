// Simple rate limiting backed by the database (AuthAttempt rows), so it keeps
// working across server restarts and multiple server instances.
import "server-only";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const LIMITS = {
  login: { max: 5, windowMinutes: 15 }, // wrong passwords per email
  "login-ip": { max: 20, windowMinutes: 15 }, // failed logins per IP (many emails)
  reset: { max: 3, windowMinutes: 60 }, // reset emails per address
  partner: { max: 5, windowMinutes: 60 }, // partner requests per IP
} as const;
type Kind = keyof typeof LIMITS;

// Minutes until the caller may try again, or 0 if allowed now.
export async function retryAfterMinutes(kind: Kind, key: string) {
  const { max, windowMinutes } = LIMITS[kind];
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const attempts = await prisma.authAttempt.findMany({
    where: { kind, key, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (attempts.length < max) return 0;
  // Blocked until the oldest counted attempt leaves the window.
  const freeAt = attempts[attempts.length - max].createdAt.getTime() + windowMinutes * 60_000;
  return Math.max(1, Math.ceil((freeAt - Date.now()) / 60_000));
}

export async function recordAttempt(kind: Kind, key: string) {
  await prisma.authAttempt.create({ data: { kind, key } });
  // Housekeeping: rows older than a day are never needed.
  if (Math.random() < 0.05) {
    await prisma.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
  }
}

export async function clearAttempts(kind: Kind, key: string) {
  await prisma.authAttempt.deleteMany({ where: { kind, key } });
}

// The visitor's IP address, as reported by the hosting proxy. Locally there
// may be none; then IP limits simply don't apply.
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
}
