import type { Metadata } from "next";
import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { getI18n } from "@/i18n/server";
import { cityName } from "@/lib/cities";
import { isPeriod, PERIODS } from "@/lib/earnings";
import { runHousekeeping } from "@/lib/housekeeping";
import { platformReport } from "@/lib/platform-report";
import { requireAdmin } from "@/lib/session";
import { Doodle } from "@/components/Doodle";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.report.title };
}

// The owner's view of the whole service: money, orders, growth, every store.
export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin("/admin/reports");
  await runHousekeeping();
  const { dict, f, fill } = await getI18n();
  const t = dict.report;
  const { period: requested } = await searchParams;
  const period = isPeriod(requested) ? requested : "month";
  const r = await platformReport(period);
  const lastDay = new Date(r.to.getTime() - 1);
  const maxDay = Math.max(1, ...r.days.map((d) => d.sales));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link href="/admin" className="text-sm font-medium text-stone-500 hover:text-brand-dark">{t.back}</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t.title}</h1>
          <p className="mt-1 text-sm text-stone-500">{f.date(r.from)} – {f.date(lastDay)}</p>
        </div>
        <nav className="grid w-full grid-cols-3 rounded-xl bg-stone-200/70 p-1 sm:inline-grid sm:w-auto" aria-label={t.title}>
          {PERIODS.map((value) => (
            <Link key={value} href={`/admin/reports?period=${value}`} aria-current={period === value ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-2 py-2 text-center text-sm font-semibold transition sm:px-4 ${
                period === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
              }`}>
              {dict.earnings.periods[value]}
            </Link>
          ))}
        </nav>
      </div>

      <h2 className="mt-8 text-lg font-semibold">{t.money}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard template={t.sales} value={f.price(r.sales)} />
        <StatCard template={t.commission} value={f.price(r.commission)} />
        <StatCard template={t.payout} value={f.price(r.payout)} />
        <StatCard template={t.refunds} value={f.price(r.refunds.amount)} />
      </div>
      <p className="mt-2 text-sm text-stone-600">
        {r.feePercent > 0 ? fill(t.feeLine, { percent: r.feePercent }) : t.noFee} {fill(t.refundsCount, { n: r.refunds.count })}. {t.payoutNote}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="text-lg font-semibold">{t.byDay}</h2>
          {/* Simple bar chart: one bar per day, height = that day's sales. */}
          <div className="mt-3 flex h-48 items-end gap-1 rounded-2xl bg-white p-4 ring-1 ring-stone-200" role="img"
            aria-label={r.days.map((d) => `${d.day}: ${f.price(d.sales)}`).join(", ")}>
            {r.days.map((d) => (
              <div key={d.day} title={`${f.date(new Date(`${d.day}T12:00:00+05:00`))}: ${f.price(d.sales)}`}
                className={`flex-1 rounded-t ${d.sales > 0 ? "bg-brand" : "bg-stone-200"}`}
                style={{ height: `${Math.max(3, (d.sales / maxDay) * 100)}%` }} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold">{t.byCity}</h2>
          <ul className="mt-3 divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
            {r.byCity.length === 0 && <li className="p-4 text-sm text-stone-500">{t.noSales}</li>}
            {r.byCity.map((c) => (
              <li key={c.city} className="flex justify-between p-4 text-sm">
                <span className="font-medium">{cityName(dict.cities, c.city)}</span>
                <span>{c.bags} · <strong>{f.price(c.sales)}</strong></span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <h2 className="mt-8 text-lg font-semibold">{t.ordersTitle}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard template={t.paidOrders} value={r.orders.paid} />
        <StatCard template={t.bagsRescued} value={r.bagsRescued} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
        {([
          [t.collected, r.orders.collected],
          [t.waiting, r.orders.waiting],
          [t.noShows, r.orders.noShows],
          [t.storeCancels, r.orders.storeCancels],
          [t.customerCancels, r.orders.customerCancels],
          [t.abandoned, r.orders.abandoned],
        ] as const).map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-stone-100 py-1.5">
            <dt className="text-stone-600">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-8 text-lg font-semibold">{t.growthTitle}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard template={t.newCustomers} value={r.customers.new} />
        <StatCard template={t.activeCustomers} value={r.customers.active} />
        <StatCard template={t.repeatCustomers} value={r.customers.repeat} />
        <StatCard template={t.newStores} value={r.stores.new} />
        <StatCard template={t.activeStores} value={r.stores.active} />
        <StatCard template={t.pendingStores} value={r.stores.pending} />
      </div>
      <p className="mt-2 text-sm text-stone-600">{fill(t.complaints, { n: r.complaints })}</p>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t.storesTitle}</h2>
          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-stone-500 sm:block">{t.downloadHint}</p>
            <a href={`/admin/reports/export?period=${period}`} download
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50">
              <Doodle name="download" size={16} className="mr-1.5" />{t.download}
            </a>
          </div>
        </div>
        {/* Wide table: scrolls sideways on phones. */}
        <div className="mt-3 overflow-x-auto rounded-2xl bg-white ring-1 ring-stone-200">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t.col.store}</th>
                <th className="px-4 py-2.5 font-medium">{t.col.city}</th>
                {[t.col.bags, t.col.sales, t.col.commission, t.col.payout, t.col.noShows, t.col.cancels, t.col.complaints, t.col.rating].map((label) => (
                  <th key={label} className="px-4 py-2.5 text-right font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {r.storeRows.map((row) => (
                <tr key={row.id} className={row.sales === 0 ? "text-stone-500" : ""}>
                  <td className="px-4 py-2.5">
                    <Link href={`/stores/${row.id}`} className="font-medium text-stone-900 hover:text-brand-dark hover:underline">{row.name}</Link>
                    {row.status !== "APPROVED" && <span className="ml-2 text-xs text-amber-700">{dict.admin.status[row.status as keyof typeof dict.admin.status]}</span>}
                  </td>
                  <td className="px-4 py-2.5">{cityName(dict.cities, row.city)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.bags}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{f.price(row.sales)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f.price(row.commission)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f.price(row.payout)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${row.noShows > 0 ? "text-amber-700" : ""}`}>{row.noShows}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${row.storeCancels > 0 ? "text-red-700" : ""}`}>{row.storeCancels}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${row.complaints > 0 ? "text-red-700" : ""}`}>{row.complaints}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.rating !== null ? <><Doodle name="star" size={13} filled className="mr-1 text-amber-400" />{row.rating} ({row.ratingCount})</> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
