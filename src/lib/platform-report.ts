// The admin's platform report: sales, commission, payouts, refunds, orders,
// growth and a table of every store, for a period. Orders count on their
// pickup day, like the stores' own earnings report (src/lib/earnings.ts).
import "server-only";

import { dayKey } from "@/i18n/shared";
import { type Period, periodRange, platformFeePercent } from "@/lib/earnings";
import { prisma } from "@/lib/prisma";

export type StoreRow = {
  id: string;
  name: string;
  city: string;
  status: string;
  bags: number; // bags sold
  sales: number; // tiyn
  commission: number;
  payout: number;
  noShows: number;
  storeCancels: number;
  complaints: number;
  rating: number | null;
  ratingCount: number;
};

export async function platformReport(period: Period) {
  const { from, to } = periodRange(period);
  const now = new Date();
  const inPeriod = { pickupStart: { gte: from, lt: to } };
  const feePercent = platformFeePercent();

  const [orders, abandoned, newCustomers, newStores, pendingStores, stores, reviews, complaints] = await Promise.all([
    // Every order that was paid at some point (including refunded ones).
    prisma.order.findMany({
      where: { bag: inPeriod, payment: { status: { in: ["PAID", "REFUNDED"] } } },
      select: {
        status: true,
        cancelledBy: true,
        quantity: true,
        totalPrice: true,
        userId: true,
        payment: { select: { status: true, amount: true } },
        bag: { select: { pickupStart: true, pickupEnd: true, storeId: true, store: { select: { city: true } } } },
      },
    }),
    // Started paying but never finished (the hold ran out or they declined).
    prisma.order.count({ where: { bag: inPeriod, status: "EXPIRED", payment: { status: { notIn: ["PAID", "REFUNDED"] } } } }),
    prisma.user.count({ where: { role: "CUSTOMER", deletedAt: null, createdAt: { gte: from, lt: to } } }),
    prisma.store.count({ where: { createdAt: { gte: from, lt: to } } }),
    prisma.store.count({ where: { status: "PENDING" } }),
    prisma.store.findMany({ select: { id: true, name: true, city: true, status: true } }),
    prisma.review.groupBy({ by: ["storeId"], _avg: { rating: true }, _count: true }),
    prisma.problemReport.findMany({
      where: { createdAt: { gte: from, lt: to } },
      select: { status: true, order: { select: { bag: { select: { storeId: true } } } } },
    }),
  ]);

  const sold = orders.filter((o) => o.status !== "CANCELLED" && o.payment?.status === "PAID");
  const refunded = orders.filter((o) => o.payment?.status === "REFUNDED");
  const sum = (list: typeof orders) => list.reduce((total, o) => total + o.totalPrice, 0);
  const commissionOf = (sales: number) => Math.round((sales * feePercent) / 100);
  const sales = sum(sold);
  const commission = commissionOf(sales);

  // Customers who bought in this period, and how many bought more than once.
  const buys = new Map<string, number>();
  for (const o of sold) buys.set(o.userId, (buys.get(o.userId) ?? 0) + 1);
  const repeat = [...buys.values()].filter((n) => n > 1).length;

  // Per store.
  const ratingBy = new Map(reviews.map((r) => [r.storeId, r]));
  const rows = new Map<string, StoreRow>(
    stores.map((store) => {
      const r = ratingBy.get(store.id);
      return [store.id, {
        ...store, bags: 0, sales: 0, commission: 0, payout: 0, noShows: 0, storeCancels: 0, complaints: 0,
        rating: r ? Math.round((r._avg.rating ?? 0) * 10) / 10 : null, ratingCount: r?._count ?? 0,
      }];
    }),
  );
  for (const o of orders) {
    const row = rows.get(o.bag.storeId);
    if (!row) continue;
    if (o.status !== "CANCELLED" && o.payment?.status === "PAID") {
      row.bags += o.quantity;
      row.sales += o.totalPrice;
    }
    if (o.status === "NO_SHOW") row.noShows += 1;
    if (o.status === "CANCELLED" && (o.cancelledBy === "store" || o.cancelledBy === "admin")) row.storeCancels += 1;
  }
  for (const c of complaints) {
    const row = rows.get(c.order.bag.storeId);
    if (row) row.complaints += 1;
  }
  for (const row of rows.values()) {
    row.commission = commissionOf(row.sales);
    row.payout = row.sales - row.commission;
  }
  const storeRows = [...rows.values()]
    .filter((row) => row.sales > 0 || row.noShows > 0 || row.storeCancels > 0 || row.complaints > 0 || row.status === "APPROVED")
    .sort((a, b) => b.sales - a.sales || a.name.localeCompare(b.name));

  // By city and by day.
  const byCity = new Map<string, { bags: number; sales: number }>();
  const byDay = new Map<string, number>();
  for (const o of sold) {
    const city = byCity.get(o.bag.store.city) ?? { bags: 0, sales: 0 };
    city.bags += o.quantity;
    city.sales += o.totalPrice;
    byCity.set(o.bag.store.city, city);
    const day = dayKey(o.bag.pickupStart);
    byDay.set(day, (byDay.get(day) ?? 0) + o.totalPrice);
  }
  // Every day of the period up to today, so the chart shows quiet days too.
  const days: { day: string; sales: number }[] = [];
  for (let t = from.getTime(); t < Math.min(to.getTime(), now.getTime() + 86_400_000); t += 86_400_000) {
    const day = dayKey(new Date(t + 12 * 3_600_000));
    if (!days.some((d) => d.day === day)) days.push({ day, sales: byDay.get(day) ?? 0 });
  }

  return {
    from,
    to,
    feePercent,
    sales,
    commission,
    payout: sales - commission,
    refunds: { count: refunded.length, amount: refunded.reduce((total, o) => total + (o.payment?.amount ?? 0), 0) },
    orders: {
      paid: orders.length,
      collected: orders.filter((o) => o.status === "COLLECTED").length,
      waiting: orders.filter((o) => o.status === "RESERVED" && o.bag.pickupEnd > now).length,
      noShows: orders.filter((o) => o.status === "NO_SHOW").length,
      storeCancels: orders.filter((o) => o.status === "CANCELLED" && o.cancelledBy !== "customer").length,
      customerCancels: orders.filter((o) => o.status === "CANCELLED" && o.cancelledBy === "customer").length,
      abandoned,
    },
    bagsRescued: orders.filter((o) => o.status === "COLLECTED").reduce((total, o) => total + o.quantity, 0),
    customers: { new: newCustomers, active: buys.size, repeat },
    stores: { new: newStores, active: storeRows.filter((r) => r.sales > 0).length, pending: pendingStores },
    complaints: complaints.length,
    byCity: [...byCity.entries()].map(([city, v]) => ({ city, ...v })).sort((a, b) => b.sales - a.sales),
    days,
    storeRows,
  };
}
