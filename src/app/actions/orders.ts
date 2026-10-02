"use server";
// Reserving and cancelling surprise bags. Like all Server Actions, these can be
// called with any input, so every check happens here on the server.

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { MAX_PER_ORDER } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type ReserveState = { error?: string } | undefined;

// Thrown inside the transaction to roll it back with a friendly message.
class ReserveError extends Error {}

// e.g. "GC-4821": store initials + 4 random digits, easy to read out at the counter.
function makePickupCode(storeName: string) {
  const initials = storeName
    .split(/\s+/)
    .map((word) => word[0])
    .filter((char) => /[a-z]/i.test(char ?? ""))
    .join("")
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, "X");
  return `${initials}-${randomInt(1000, 10000)}`;
}

export async function reserveBag(_prev: ReserveState, formData: FormData): Promise<ReserveState> {
  const bagId = String(formData.get("bagId") ?? "");
  const user = await requireUser(`/bags/${bagId}`);
  const quantity = Number(formData.get("quantity") ?? 1);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PER_ORDER) {
    return { error: `You can reserve between 1 and ${MAX_PER_ORDER} bags.` };
  }

  let orderId: string | undefined;
  // A pickup code could (rarely) collide with an existing one; just try again.
  for (let attempt = 0; attempt < 5 && !orderId; attempt++) {
    try {
      orderId = await prisma.$transaction(async (tx) => {
        const bag = await tx.surpriseBag.findUnique({ where: { id: bagId }, include: { store: true } });
        if (!bag) throw new ReserveError("This bag no longer exists.");
        if (bag.store.ownerId === user.id) throw new ReserveError("You can't reserve bags from your own store.");

        // Take the bags only if enough are still available, all in ONE update.
        // If two people click "Reserve" on the last bag at the same moment,
        // only one update can match; the other gets count 0. Reading the
        // quantity first and writing it later would sell the bag twice.
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
              ? `Only ${bag.quantityAvailable} left. Try a smaller amount.`
              : "Sorry, this bag is no longer available.",
          );
        }

        const order = await tx.order.create({
          data: {
            userId: user.id,
            bagId,
            quantity,
            totalPrice: bag.price * quantity, // locked in now, even if the price changes later
            pickupCode: makePickupCode(bag.store.name),
          },
        });
        return order.id;
      });
    } catch (error) {
      if (error instanceof ReserveError) return { error: error.message };
      const codeTaken = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!codeTaken) throw error;
    }
  }

  if (!orderId) return { error: "Something went wrong. Please try again." };
  redirect(`/orders?new=${orderId}`);
}

export async function cancelOrder(formData: FormData) {
  const user = await requireUser("/orders");
  const orderId = String(formData.get("orderId") ?? "");

  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { bag: true } });
    // Only your own, still-reserved orders, and only before pickup ends.
    if (!order || order.userId !== user.id || order.bag.pickupEnd <= new Date()) return;

    // Status check inside the update, so double-clicking "Cancel" can't put
    // the bags back twice.
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: "RESERVED" },
      data: { status: "CANCELLED" },
    });
    if (count === 1) {
      await tx.surpriseBag.update({
        where: { id: order.bagId },
        data: { quantityAvailable: { increment: order.quantity } },
      });
    }
  });

  redirect("/orders");
}
