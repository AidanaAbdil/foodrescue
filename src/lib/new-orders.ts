// The owner's most recent paid order, for the dashboard's new-order alert.
import "server-only";

import { prisma } from "@/lib/prisma";

export async function latestPaidOrder(ownerId: string) {
  const payment = await prisma.payment.findFirst({
    where: { status: "PAID", order: { bag: { store: { ownerId } } } },
    orderBy: { paidAt: "desc" },
    select: {
      paidAt: true,
      order: { select: { pickupCode: true, quantity: true, bag: { select: { title: true } } } },
    },
  });
  if (!payment?.paidAt) return null;
  return {
    paidAt: payment.paidAt.toISOString(),
    code: payment.order.pickupCode,
    bag: payment.order.bag.title,
    quantity: payment.order.quantity,
  };
}

export type LatestOrder = Awaited<ReturnType<typeof latestPaidOrder>>;
