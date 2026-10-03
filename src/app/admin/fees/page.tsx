import type { Metadata } from "next";
import Link from "next/link";
import { recordYearlyFee } from "@/app/actions/admin";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { getI18n } from "@/i18n/server";
import { cityName } from "@/lib/cities";
import { feeStatus, foundingFreeMonths, foundingPartners, nextPaidUntil, yearlyFee } from "@/lib/fees";
import { foundingPlacesLeft } from "@/lib/founding";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.fees.title };
}

const STATUS_ORDER = { DUE: 0, FREE: 1, PAID: 2 } as const;
const STATUS_STYLE = { DUE: "bg-red-100 text-red-800", FREE: "bg-brand-light text-brand-dark", PAID: "bg-accent text-white" } as const;

// Yearly fees: who's free, who's paid, who owes; record payments made outside the app.
export default async function FeesPage() {
  await requireAdmin("/admin/fees");
  const { dict, f, fill } = await getI18n();
  const t = dict.fees;
  const [stores, payments, placesLeft] = await Promise.all([
    prisma.store.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } }),
    prisma.membershipPayment.findMany({ include: { store: { select: { name: true } } }, orderBy: { paidAt: "desc" }, take: 10 }),
    foundingPlacesLeft(),
  ]);
  const fee = f.price(yearlyFee());
  const rows = stores
    .map((store) => ({ store, status: feeStatus(store) }))
    .sort((a, b) => STATUS_ORDER[a.status.kind] - STATUS_ORDER[b.status.kind] || a.store.name.localeCompare(b.store.name));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/admin" className="text-sm font-medium text-stone-500 hover:text-brand-dark">{dict.report.back}</Link>
      <h1 className="mt-2 text-3xl font-bold">{t.title}</h1>
      <p className="mt-1 text-sm text-stone-600">{fill(t.hint, { fee, total: foundingPartners(), months: foundingFreeMonths() })}</p>
      <p className="mt-1 text-sm font-medium text-brand-dark">{fill(t.placesLeft, { n: placesLeft, total: foundingPartners() })}</p>

      {rows.length === 0 ? (
        <p className="mt-6 text-stone-600">{t.none}</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
          {rows.map(({ store, status }) => (
            <li key={store.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <p>
                  <span className="font-semibold">{store.name}</span>
                  <span className="text-stone-500"> · {cityName(dict.cities, store.city)}</span>
                  {store.foundingNumber && <span className="ml-2 text-xs font-medium text-accent">{fill(t.founding, { n: store.foundingNumber })}</span>}
                </p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status.kind]}`}>
                  {status.kind === "DUE"
                    ? status.since ? fill(t.dueSince, { date: f.date(status.since) }) : t.due
                    : fill(status.kind === "FREE" ? t.free : t.paid, { date: f.date(status.until) })}
                </span>
              </div>
              <ConfirmSubmit
                action={recordYearlyFee}
                hidden={{ storeId: store.id }}
                message={fill(t.markPaidConfirm, { store: store.name, fee, date: f.date(nextPaidUntil(store)) })}
                yes={dict.dashboard.confirmYes}
                no={dict.dashboard.confirmNo}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-100"
              >
                {t.markPaid}
              </ConfirmSubmit>
            </li>
          ))}
        </ul>
      )}

      {payments.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t.paymentsTitle}</h2>
          <ul className="mt-3 space-y-1 text-sm text-stone-600">
            {payments.map((payment) => (
              <li key={payment.id}>
                {f.date(payment.paidAt)} · {payment.store.name} · <strong>{f.price(payment.amount)}</strong> → {f.date(payment.coversUntil)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
