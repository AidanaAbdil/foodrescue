// The numbers next to "Dashboard (2)" and "Admin (1)" in the header.
import "server-only";

import { startOfToday } from "@/i18n/shared";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";

export async function headerCount(user: CurrentUser | null) {
  // Admins: stores waiting for review.
  if (user?.role === "ADMIN") return prisma.store.count({ where: { status: "PENDING" } });
  // Store owners: paid orders waiting for pickup today.
  if (user?.role === "STORE_OWNER") {
    return prisma.order.count({
      where: { status: "RESERVED", bag: { pickupEnd: { gte: startOfToday() }, store: { ownerId: user.id } } },
    });
  }
  return 0;
}
