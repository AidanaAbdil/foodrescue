import { getI18n } from "@/i18n/server";
import { dayKey } from "@/i18n/shared";
import { earningsReport, isPeriod } from "@/lib/earnings";
import { getCurrentUser } from "@/lib/session";

// The earnings report's orders as a CSV file for the store's accountant.
// Semicolons and a BOM so Excel (Russian/Kazakh settings) opens it correctly.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "STORE_OWNER") return new Response("Unauthorized", { status: 401 });
  const requested = new URL(request.url).searchParams.get("period");
  const period = isPeriod(requested) ? requested : "month";
  const report = await earningsReport(user.id, period);
  const { dict } = await getI18n();
  const c = dict.earnings.csv;
  const now = new Date();

  // Quote every cell; a leading = + - @ would make Excel run it as a formula.
  const cell = (value: string | number) => `"${String(value).replace(/^([=+\-@])/, "'$1").replaceAll('"', '""')}"`;
  const lines = [
    [c.date, c.code, c.store, c.bag, c.quantity, c.amount, c.status],
    ...report.orders.map((o) => [
      dayKey(o.bag.pickupStart),
      o.pickupCode,
      o.bag.store.name,
      o.bag.title,
      o.quantity,
      (o.totalPrice / 100).toFixed(0),
      dict.orders.status[
        o.payment?.status === "REFUNDED" || o.status === "CANCELLED"
          ? "CANCELLED"
          : o.status === "RESERVED" && o.bag.pickupEnd < now
            ? "MISSED" // pickup time is over and nobody marked it
            : o.status
      ],
    ]),
  ].map((row) => row.map(cell).join(";"));

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="earnings-${dayKey(report.from)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
