// The numbers next to "Dashboard (2)" and "Admin (1)" in the header.
import "server-only";

import { startOfToday } from "@/i18n/shared";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";

export async function headerCount(user: CurrentUser | null) {
  // Admins: stores waiting for review, open problem reports and new partner requests.
  if (user?.role === "ADMIN") {
    const [stores, reports, partners] = await Promise.all([
      prisma.store.count({ where: { status: "PENDING" } }),
      prisma.problemReport.count({ where: { status: "OPEN" } }),
      prisma.partnerRequest.count({ where: { status: "NEW" } }),
    ]);
    return stores + reports + partners;
  }
  // Store owners: paid orders waiting for pickup today.
  if (user?.role === "STORE_OWNER") {
    return prisma.order.count({
      where: { status: "RESERVED", bag: { pickupEnd: { gte: startOfToday() }, store: { ownerId: user.id } } },
    });
  }
  return 0;
}
