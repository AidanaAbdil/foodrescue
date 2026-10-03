// The admin activity log: who did what, when (shown at /admin/log).
import "server-only";

import { prisma } from "@/lib/prisma";

export const ADMIN_ACTIONS = [
  "store.approve", "store.reject", "order.refund", "report.refund", "report.close",
  "user.block", "user.unblock", "bag.hide", "bag.unhide", "partner.contacted", "partner.closed", "fee.paid",
] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export async function logAdmin(adminId: string, action: AdminAction, target: { type: string; id: string }, details?: string | null) {
  await prisma.adminLog.create({
    data: { adminId, action, targetType: target.type, targetId: target.id, details: details?.slice(0, 500) || null },
  });
}
