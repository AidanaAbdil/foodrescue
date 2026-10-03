// Earnings report for store owners: what they sold in a period and what
// they'll be paid. Orders count on the day of their pickup (Kazakhstan time).
import "server-only";

import { TIME_ZONE_OFFSET } from "@/i18n/config";
import { dayKey } from "@/i18n/shared";
import { prisma } from "@/lib/prisma";

export const PERIODS = ["week", "month", "last-month"] as const;
export type Period = (typeof PERIODS)[number];
export const isPeriod = (value: unknown): value is Period => PERIODS.includes(value as Period);

// The service's commission in percent, from .env (PLATFORM_FEE_PERCENT=10).
// Not set = no commission yet.
export function platformFeePercent() {
  const value = Number(process.env.PLATFORM_FEE_PERCENT ?? 0);
  return Number.isFinite(value) && value > 0 && value < 100 ? value : 0;
}

// Midnight in Kazakhstan on a calendar day; day/month may overflow (day 0 = last day of previous month).
function localMidnight(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
  return new Date(`${date}T00:00:00${TIME_ZONE_OFFSET}`);
}

// [from, to) for a period, e.g. this month = 1 October 00:00 → 1 November 00:00.
export function periodRange(period: Period, now = new Date()) {
  const [y, m, d] = dayKey(now).split("-").map(Number);
  if (period === "week") {
    const sinceMonday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    return { from: localMidnight(y, m, d - sinceMonday), to: localMidnight(y, m, d - sinceMonday + 7) };
  }
  if (period === "last-month") return { from: localMidnight(y, m - 1, 1), to: localMidnight(y, m, 1) };
  return { from: localMidnight(y, m, 1), to: localMidnight(y, m + 1, 1) };
}

export async function earningsReport(ownerId: string, period: Period) {
  const { from, to } = periodRange(period);
  const orders = await prisma.order.findMany({
    where: {
      bag: { store: { ownerId }, pickupStart: { gte: from, lt: to } },
      status: { in: ["RESERVED", "COLLECTED", "NO_SHOW", "CANCELLED"] },
      payment: { status: { in: ["PAID", "REFUNDED"] } }, // only orders that were actually paid
    },
    include: {
      bag: { select: { title: true, originalPrice: true, pickupStart: true, pickupEnd: true, store: { select: { name: true } } } },
      payment: { select: { status: true } },
    },
    orderBy: { bag: { pickupStart: "asc" } },
  });

  const now = new Date();
  // Sold = paid and kept: collected, no-show (the store keeps the money) or still to be picked up.
  const sold = orders.filter((o) => o.status !== "CANCELLED" && o.payment?.status === "PAID");
  const revenue = sold.reduce((sum, o) => sum + o.totalPrice, 0);
  const feePercent = platformFeePercent();
  const fee = Math.round((revenue * feePercent) / 100);

  const group = (key: (o: (typeof sold)[number]) => string) => {
    const rows = new Map<string, { label: string; date?: Date; bags: number; revenue: number }>();
    for (const o of sold) {
      const k = key(o);
      const row = rows.get(k) ?? { label: k, date: o.bag.pickupStart, bags: 0, revenue: 0 };
      row.bags += o.quantity;
      row.revenue += o.totalPrice;
      rows.set(k, row);
    }
    return [...rows.values()];
  };

  return {
    from,
    to,
    orders,
    bagsSold: sold.reduce((sum, o) => sum + o.quantity, 0),
    revenue,
    feePercent,
    fee,
    payout: revenue - fee,
    // What the food would have cost at full price.
    foodValue: sold.reduce((sum, o) => sum + o.bag.originalPrice * o.quantity, 0),
    waiting: sold.filter((o) => o.status === "RESERVED" && o.bag.pickupEnd > now).length,
    noShows: sold.filter((o) => o.status === "NO_SHOW").length,
    refunded: orders.filter((o) => o.status === "CANCELLED").length,
    byDay: group((o) => dayKey(o.bag.pickupStart)),
    byBag: group((o) => o.bag.title).sort((a, b) => b.revenue - a.revenue),
  };
}
