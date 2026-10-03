import { getI18n } from "@/i18n/server";
import { dayKey } from "@/i18n/shared";
import { cityName } from "@/lib/cities";
import { isPeriod } from "@/lib/earnings";
import { platformReport } from "@/lib/platform-report";
import { getCurrentUser } from "@/lib/session";

// The report's store table as a CSV file (semicolons and a BOM for Excel).
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });
  const requested = new URL(request.url).searchParams.get("period");
  const period = isPeriod(requested) ? requested : "month";
  const r = await platformReport(period);
  const { dict } = await getI18n();
  const c = dict.report.col;

  // Quote every cell; a leading = + - @ would make Excel run it as a formula.
  const cell = (value: string | number) => `"${String(value).replace(/^([=+\-@])/, "'$1").replaceAll('"', '""')}"`;
  const tenge = (tiyn: number) => (tiyn / 100).toFixed(0);
  const lines = [
    [c.store, c.city, c.bags, `${c.sales}, ₸`, `${c.commission}, ₸`, `${c.payout}, ₸`, c.noShows, c.cancels, c.complaints, c.rating],
    ...r.storeRows.map((row) => [
      row.name, cityName(dict.cities, row.city), row.bags, tenge(row.sales), tenge(row.commission), tenge(row.payout),
      row.noShows, row.storeCancels, row.complaints, row.rating ?? "",
    ]),
  ].map((row) => row.map(cell).join(";"));

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="platform-report-${dayKey(r.from)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
