// "Pickup starts soon" reminders, sent by the background timer (src/lib/background.ts).
import "server-only";

import { prisma } from "@/lib/prisma";
import { notifyPickupSoon } from "@/lib/push";

export const REMINDER_MINUTES = 30; // how long before pickup starts
const minutes = (n: number) => n * 60 * 1000;

export async function sendPickupReminders() {
  const now = Date.now();
  const due = await prisma.order.findMany({
    where: {
      status: "RESERVED",
      reminderSentAt: null,
      createdAt: { lt: new Date(now - minutes(10)) }, // not to someone who has just ordered
      bag: { pickupStart: { lte: new Date(now + minutes(REMINDER_MINUTES)), gt: new Date(now - minutes(15)) } },
    },
    select: { id: true },
    take: 100,
  });
  for (const { id } of due) {
    // Mark first: one reminder per order, even if two servers run this at once.
    const { count } = await prisma.order.updateMany({ where: { id, reminderSentAt: null }, data: { reminderSentAt: new Date() } });
    if (count === 1) await notifyPickupSoon(id);
  }
  return due.length;
}
