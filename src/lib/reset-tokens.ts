// Password-reset link tokens. Like sessions, only a SHA-256 hash is stored.
import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const RESET_HOURS = 1;
export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

// The reset link's token row if it's still usable (unused, not expired), else null.
export async function findValidResetToken(token: string) {
  if (!token) return null;
  return prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashResetToken(token), usedAt: null, expiresAt: { gt: new Date() } },
  });
}
