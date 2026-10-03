// Reminders sent by the background timer (src/lib/background.ts):
//   - customers: "pickup starts soon"
//   - stores: "time to pack N bags" before a pickup window with orders
import "server-only";

import { prisma } from "@/lib/prisma";
import { notifyPackReminder, notifyPickupSoon } from "@/lib/push";

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

// How long before pickup the store is told how many bags to pack (.env PACK_REMINDER_MINUTES).
export const packReminderMinutes = () => {
  const n = Number(process.env.PACK_REMINDER_MINUTES ?? 60);
  return Number.isFinite(n) && n >= 5 && n <= 24 * 60 ? n : 60;
};

// Bags whose pickup starts within the reminder time and that have paid orders:
// one notification per store owner and pickup time, listing every bag.
export async function sendPackReminders() {
  const now = Date.now();
  const bags = await prisma.surpriseBag.findMany({
    where: {
      packReminderSentAt: null,
      pickupStart: { lte: new Date(now + minutes(packReminderMinutes())), gt: new Date(now) },
      orders: { some: { status: "RESERVED" } },
    },
    select: {
      id: true,
      title: true,
      pickupStart: true,
      store: { select: { ownerId: true } },
      orders: { where: { status: "RESERVED" }, select: { quantity: true } },
    },
    take: 200,
  });
  const groups = new Map<string, { ownerId: string; pickupStart: Date; items: { bag: string; n: number }[] }>();
  for (const bag of bags) {
    // Claim first, so two servers never send it twice.
    const { count } = await prisma.surpriseBag.updateMany({ where: { id: bag.id, packReminderSentAt: null }, data: { packReminderSentAt: new Date() } });
    if (count === 0) continue;
    const key = `${bag.store.ownerId}|${bag.pickupStart.getTime()}`;
    const group = groups.get(key) ?? { ownerId: bag.store.ownerId, pickupStart: bag.pickupStart, items: [] };
    group.items.push({ bag: bag.title, n: bag.orders.reduce((sum, order) => sum + order.quantity, 0) });
    groups.set(key, group);
  }
  for (const group of groups.values()) await notifyPackReminder(group.ownerId, group.pickupStart, group.items);
  return groups.size;
}
