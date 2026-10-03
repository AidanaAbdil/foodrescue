import type { Metadata } from "next";
import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { getI18n } from "@/i18n/server";
import { earningsReport, isPeriod, PERIODS } from "@/lib/earnings";
import { runHousekeeping } from "@/lib/housekeeping";
import { requireOwner } from "@/lib/session";
import { Doodle } from "@/components/Doodle";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.earnings.title };
}

// "📊 Earnings": what the store sold this week/month and what it will be paid.
export default async function EarningsPage({ searchParams }: PageProps<"/dashboard/earnings">) {
  const user = await requireOwner("/dashboard/earnings");
  await runHousekeeping();
  const { dict, f, fill } = await getI18n();
  const t = dict.earnings;
  const { period: requested } = await searchParams;
  const period = isPeriod(requested) ? requested : "month";
  const report = await earningsReport(user.id, period);
  const lastDay = new Date(report.to.getTime() - 1);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link href="/dashboard" className="text-sm font-medium text-stone-500 hover:text-brand-dark">
        {t.back}
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {f.date(report.from)} – {f.date(lastDay)}
          </p>
        </div>
        <nav className="grid w-full grid-cols-3 rounded-xl bg-stone-200/70 p-1 sm:inline-grid sm:w-auto" aria-label={t.title}>
          {PERIODS.map((value) => (
            <Link
              key={value}
              href={`/dashboard/earnings?period=${value}`}
              aria-current={period === value ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-2 py-2 text-center text-sm font-semibold transition sm:px-4 ${
                period === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {t.periods[value]}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard template={t.statSold} value={report.bagsSold} />
        <StatCard template={t.statRevenue} value={f.price(report.revenue)} />
        <StatCard template={t.statPayout} value={f.price(report.payout)} />
        <StatCard template={t.statSaved} value={f.price(report.foodValue)} />
      </div>

      <div className="mt-4 space-y-1 text-sm text-stone-600">
        <p>
          {report.feePercent > 0
            ? fill(t.feeLine, { percent: report.feePercent, amount: f.price(report.fee) })
            : t.noFee}
        </p>
        <p>{t.payoutNote}</p>
        {report.waiting > 0 && <p>{fill(t.waiting, { n: report.waiting })}</p>}
        {report.noShows > 0 && <p>{fill(t.noShows, { n: report.noShows })}</p>}
        {report.refunded > 0 && <p>{fill(t.refunded, { n: report.refunded })}</p>}
      </div>

      {report.bagsSold === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white py-12 text-center text-stone-600">
          {t.empty}
        </p>
      ) : (
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <Breakdown
            title={t.byDay}
            first={t.colDate}
            rows={report.byDay.map((row) => ({ ...row, label: f.date(row.date!) }))}
            t={t}
            price={f.price}
          />
          <Breakdown title={t.byBag} first={t.colBag} rows={report.byBag} t={t} price={f.price} />
        </div>
      )}

      {report.orders.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {/* A plain link to a file download, so no client code is needed. */}
          <a
            href={`/dashboard/earnings/export?period=${period}`}
            download
            className="rounded-xl bg-white px-5 py-2.5 font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50"
          >
            <Doodle name="download" size={16} className="mr-1.5" />{t.download}
          </a>
          <p className="text-sm text-stone-500">{t.downloadHint}</p>
        </div>
      )}
    </main>
  );
}

type Row = { label: string; bags: number; revenue: number };

function Breakdown({ title, first, rows, t, price }: {
  title: string;
  first: string;
  rows: Row[];
  t: { colSold: string; colRevenue: string };
  price: (tiyn: number) => string;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <table className="mt-3 w-full overflow-hidden rounded-2xl bg-white text-sm ring-1 ring-stone-200">
        <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-2.5 font-medium">{first}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t.colSold}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t.colRevenue}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="px-4 py-2.5">{row.label}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{row.bags}</td>
              <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{price(row.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
