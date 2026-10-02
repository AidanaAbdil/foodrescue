"use server";
// Reserving and cancelling surprise bags. Like all Server Actions, these can be
// called with any input, so every check happens here on the server.

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { getI18n } from "@/i18n/server";
import { MAX_PER_ORDER } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments/provider";
import { cancelPaidOrder, expireOrder, HOLD_MINUTES, paymentHousekeeping } from "@/lib/payments/service";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type ReserveState = { error?: string } | undefined;

// Thrown inside the transaction to roll it back with a friendly message.
class ReserveError extends Error {}

// e.g. "KT-4821": 2 letters + 4 digits, easy to read out at the counter.
// Latin letters only (no I or O, which look like 1 and 0), so the code reads
// the same on any keyboard, whatever language the store's name is in.
const CODE_LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";
function makePickupCode() {
  const letter = () => CODE_LETTERS[randomInt(CODE_LETTERS.length)];
  return `${letter()}${letter()}-${randomInt(1000, 10000)}`;
}

export async function reserveBag(_prev: ReserveState, formData: FormData): Promise<ReserveState> {
  const bagId = String(formData.get("bagId") ?? "");
  const user = await requireUser(`/bags/${bagId}`);
  const quantity = Number(formData.get("quantity") ?? 1);
  const { dict, fill, plural } = await getI18n();
  const t = dict.errors;

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_ORDER) {
    return { error: fill(t.quantityRange, { n: MAX_PER_ORDER }) };
  }

  // Bags held by unpaid orders that timed out go back on sale first.
  await paymentHousekeeping();

  let created: { orderId: string; paymentId: string; amount: number; description: string } | undefined;
  // A pickup code could (rarely) collide with an existing one; just try again.
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    try {
      created = await prisma.$transaction(async (tx) => {
        const bag = await tx.surpriseBag.findUnique({ where: { id: bagId }, include: { store: true } });
        if (!bag) throw new ReserveError(t.bagGone);
        if (bag.store.ownerId === user.id) throw new ReserveError(t.ownStore);

        // Hold the bags only if enough are still available, all in ONE update.
        // If two people click "Pay" on the last bag at the same moment, only
        // one update can match; the other gets count 0. Reading the quantity
        // first and writing it later would sell the bag twice.
        const { count } = await tx.surpriseBag.updateMany({
          where: {
            id: bagId,
            isActive: true,
            pickupEnd: { gt: new Date() },
            quantityAvailable: { gte: quantity },
          },
          data: { quantityAvailable: { decrement: quantity } },
        });
        if (count === 0) {
          throw new ReserveError(
            bag.quantityAvailable > 0 && bag.quantityAvailable < quantity && bag.pickupEnd > new Date()
              ? plural(bag.quantityAvailable, t.onlyLeft)
              : t.soldOut,
          );
        }

        const amount = bag.price * quantity; // locked in now, even if the price changes later
        const order = await tx.order.create({
          data: {
            userId: user.id,
            bagId,
            quantity,
            totalPrice: amount,
            pickupCode: makePickupCode(),
            status: "PENDING_PAYMENT",
            expiresAt: new Date(Date.now() + HOLD_MINUTES * 60_000),
            payment: { create: { provider: getPaymentProvider().name, amount } },
          },
          include: { payment: true },
        });
        return {
          orderId: order.id,
          paymentId: order.payment!.id,
          amount,
          description: `FoodRescue: ${bag.title} × ${quantity}`,
        };
      });
    } catch (error) {
      if (error instanceof ReserveError) return { error: error.message };
      const codeTaken = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!codeTaken) throw error;
    }
  }
  if (!created) return { error: t.generic };

  // Start the payment with the provider (outside the transaction: it's a
  // network call). If that fails, release the hold straight away.
  let redirectUrl: string;
  try {
    const started = await getPaymentProvider().createPayment(created);
    await prisma.payment.update({
      where: { id: created.paymentId },
      data: { providerPaymentId: started.providerPaymentId },
    });
    redirectUrl = started.redirectUrl;
  } catch (error) {
    console.error("Could not start payment", error);
    await expireOrder(created.orderId);
    return { error: t.generic };
  }
  redirect(redirectUrl);
}

// Cancel your own order. Unpaid: the hold is simply released. Paid: refunded,
// but only before the pickup window starts.
export async function cancelOrder(formData: FormData) {
  const user = await requireUser("/orders");
  const orderId = String(formData.get("orderId") ?? "");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (order?.userId === user.id && order.status === "PENDING_PAYMENT") {
    await expireOrder(orderId);
  } else if (order?.userId === user.id && order.status === "RESERVED") {
    const result = await cancelPaidOrder(orderId, user.id);
    if (result === "TOO_LATE") redirect("/orders?error=too-late");
  }
  redirect("/orders");
}
