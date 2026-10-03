// The payment flow, independent of which provider is used:
//
//   reserve ──► PENDING_PAYMENT (bag held for HOLD_MINUTES)
//                 ├─ paid ───────► RESERVED ──► COLLECTED
//                 │                   └─ cancel before pickup starts ─► CANCELLED (refunded)
//                 └─ declined / too late ─► EXPIRED (bag back on sale)
//
// Every status change is a single conditional update ("only if it's still
// PENDING…"), so a double click, a late provider callback or two requests at
// once can never pay, refund or release stock twice.
import "server-only";

import { prisma } from "@/lib/prisma";
import { notifyNewOrder, notifyStoreCancelled } from "@/lib/push";
import type { CancelReason } from "@/lib/orders";
import { getPaymentProvider } from "./provider";

export const HOLD_MINUTES = 15;

// Run before showing stock or orders. There's no background job yet, so
// pages do this housekeeping: release unpaid holds past their deadline, and
// retry refunds that failed earlier.
export async function paymentHousekeeping() {
  const expired = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  for (const { id } of expired) await expireOrder(id);
  await retryPendingRefunds();
}

// Paid payments whose order was cancelled or expired, or whose problem report
// an admin refunded, still owe the customer their money (the refund call
// failed before). Try again, a few at a time.
async function retryPendingRefunds() {
  const owed = await prisma.payment.findMany({
    where: {
      status: "PAID",
      OR: [{ order: { status: { in: ["CANCELLED", "EXPIRED"] } } }, { order: { report: { status: "REFUNDED" } } }],
    },
    select: { id: true },
    take: 10,
  });
  for (const { id } of owed) await refundPayment(id);
}

// PENDING_PAYMENT → EXPIRED and put the bags back. Safe to call twice.
export async function expireOrder(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT" },
      data: { status: "EXPIRED", expiresAt: null },
    });
    if (count === 0) return; // already handled
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    await tx.surpriseBag.update({
      where: { id: order.bagId },
      data: { quantityAvailable: { increment: order.quantity } },
    });
    // The payment is deliberately left PENDING: the customer may still finish
    // paying on the provider's page. If that payment arrives, confirmPayment
    // takes the bag again if it can, or refunds the money.
  });
}

// The provider says the customer paid. Returns the order's final status.
export async function confirmPayment(paymentId: string): Promise<"RESERVED" | "REFUNDED" | "IGNORED"> {
  const outcome = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment || payment.status !== "PENDING") return "IGNORED" as const;

    await tx.payment.update({ where: { id: paymentId }, data: { status: "PAID", paidAt: new Date() } });

    // Normal case: paid within the hold.
    const { count } = await tx.order.updateMany({
      where: { id: payment.orderId, status: "PENDING_PAYMENT" },
      data: { status: "RESERVED", expiresAt: null },
    });
    if (count === 1) return "RESERVED" as const;

    // Paid after the hold expired: take the bags again if still available…
    if (payment.order.status === "EXPIRED") {
      const taken = await tx.surpriseBag.updateMany({
        where: { id: payment.order.bagId, quantityAvailable: { gte: payment.order.quantity }, pickupEnd: { gt: new Date() } },
        data: { quantityAvailable: { decrement: payment.order.quantity } },
      });
      if (taken.count === 1) {
        await tx.order.update({ where: { id: payment.orderId }, data: { status: "RESERVED" } });
        return "RESERVED" as const;
      }
    }
    return "NEEDS_REFUND" as const; // …otherwise the money goes back (below)
  });

  if (outcome === "NEEDS_REFUND") {
    await refundPayment(paymentId);
    return "REFUNDED";
  }
  if (outcome === "RESERVED") {
    // Tell the store (push notification). Never fails the payment.
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { orderId: true } });
    if (payment) await notifyNewOrder(payment.orderId);
  }
  return outcome;
}

// The customer declined or the provider reported a failure.
export async function failPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING") return;
  await prisma.payment.updateMany({ where: { id: paymentId, status: "PENDING" }, data: { status: "FAILED" } });
  await expireOrder(payment.orderId);
}

// Customer cancels a paid order: refund and put the bags back.
// Only allowed before the pickup window starts.
export async function cancelPaidOrder(orderId: string, userId: string): Promise<"OK" | "TOO_LATE" | "NOT_FOUND"> {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { bag: true } });
    if (!order || order.userId !== userId) return "NOT_FOUND" as const;
    if (order.bag.pickupStart <= new Date()) return "TOO_LATE" as const;

    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "RESERVED" },
      data: { status: "CANCELLED", cancelledBy: "customer" },
    });
    if (count === 0) return "NOT_FOUND" as const;
    await tx.surpriseBag.update({
      where: { id: order.bagId },
      data: { quantityAvailable: { increment: order.quantity } },
    });
    return "OK" as const;
  });

  if (result === "OK") {
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (payment) await refundPayment(payment.id);
  }
  return result;
}

// The store couldn't hand over a paid order → cancel it and refund in full,
// at any time. Stock isn't put back (the store had nothing to give).
// Admins can do this for any store (ownerId omitted); owners only for theirs.
export async function storeCancelOrder(orderId: string, by: "store" | "admin", ownerId?: string, reason?: CancelReason) {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: "RESERVED", ...(ownerId && { bag: { store: { ownerId } } }) },
    data: { status: "CANCELLED", cancelledBy: by, cancelReason: reason ?? null },
  });
  if (count === 0) return false;
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (payment) await refundPayment(payment.id);
  await notifyStoreCancelled(orderId);
  return true;
}

// The customer didn't come: mark it (no refund, per the terms). Only once
// the pickup window has started, and only for the store's own orders.
export async function markNoShow(orderId: string, ownerId: string) {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: "RESERVED", bag: { pickupStart: { lte: new Date() }, store: { ownerId } } },
    data: { status: "NO_SHOW" },
  });
  return count === 1;
}

// Ask the provider for the money back, then record it. PAID → REFUNDED once.
// If the provider fails, the payment stays PAID and paymentHousekeeping()
// retries later; the customer sees "refund in progress" meanwhile.
async function refundPayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PAID") return;
  try {
    await getPaymentProvider().refund(payment);
  } catch (error) {
    console.error(`Refund failed for payment ${paymentId}; will retry`, error);
    return;
  }
  await prisma.payment.updateMany({
    where: { id: paymentId, status: "PAID" },
    data: { status: "REFUNDED", refundedAt: new Date() },
  });
}

// Admin refund after a problem report (the order may already be collected).
// Returns true if the money is being returned.
export async function refundForReport(orderId: string) {
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment || payment.status !== "PAID") return false;
  // A still-reserved order (store was closed) is cancelled so it can't be handed over later.
  await prisma.order.updateMany({ where: { id: orderId, status: "RESERVED" }, data: { status: "CANCELLED", cancelledBy: "admin" } });
  await refundPayment(payment.id);
  return true;
}
