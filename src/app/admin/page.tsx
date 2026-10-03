import type { Metadata } from "next";
import Link from "next/link";
import { approveStore, cancelAndRefund, handlePartnerRequest, rejectStore, resolveReport } from "@/app/actions/admin";
import { isBusinessKind } from "@/lib/partners";
import { isProblemKind } from "@/lib/feedback";
import type { Store, StoreStatus } from "@/generated/prisma/client";
import { getI18n } from "@/i18n/server";
import { runHousekeeping } from "@/lib/housekeeping";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { type City, cityName } from "@/lib/cities";
import { formatPhone } from "@/lib/phone";
import { Doodle, type DoodleName } from "@/components/Doodle";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.admin };
}

const STATUS_STYLES: Record<StoreStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  APPROVED: "bg-accent text-white",
  REJECTED: "bg-stone-200 text-stone-700",
};

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  await runHousekeeping();
  const { error } = await searchParams;
  const { dict, f, fill } = await getI18n();
  const t = dict.admin;

  const reportInclude = {
    order: {
      include: {
        user: { select: { name: true, email: true } },
        bag: { select: { title: true, pickupStart: true, pickupEnd: true, store: { select: { name: true } } } },
        payment: { select: { status: true, amount: true } },
      },
    },
  };
  const [openReports, resolvedReports] = await Promise.all([
    prisma.problemReport.findMany({ where: { status: "OPEN" }, include: reportInclude, orderBy: { createdAt: "asc" } }),
    prisma.problemReport.findMany({ where: { status: { not: "OPEN" } }, include: reportInclude, orderBy: { resolvedAt: "desc" }, take: 10 }),
  ]);
  const fb = dict.feedback;
  const [newPartners, handledPartners] = await Promise.all([
    prisma.partnerRequest.findMany({ where: { status: "NEW" }, orderBy: { createdAt: "asc" } }),
    prisma.partnerRequest.findMany({ where: { status: { not: "NEW" } }, orderBy: { handledAt: "desc" }, take: 10 }),
  ]);
  const pt = dict.partners;

  const [stores, orders] = await Promise.all([
    prisma.store.findMany({
      include: { owner: { select: { name: true, email: true } }, _count: { select: { bags: true } } },
      orderBy: { createdAt: "desc" },
    }),
    // Paid orders not yet collected: the ones a store might be unable to hand over.
    prisma.order.findMany({
      where: { status: "RESERVED" },
      include: {
        user: { select: { name: true, email: true, _count: { select: { orders: { where: { status: "NO_SHOW" } } } } } },
        bag: { include: { store: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const pending = stores.filter((store) => store.status === "PENDING");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t.title}</h1>
        <nav className="flex flex-wrap gap-2">
          {[
            ["/admin/search", dict.adminTools.searchLink, "search"],
            ["/admin/reports", dict.report.link, "chart"],
            ["/admin/log", dict.adminTools.logLink, "notebook"],
          ].map(([href, label, icon]) => (
            <Link key={href} href={href} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50">
              <Doodle name={icon as DoodleName} className="mr-1.5 text-brand" />{label}
            </Link>
          ))}
        </nav>
      </div>

      {error === "reason" && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-red-700">
          {t.reasonRequired}
        </p>
      )}

      {/* Problem reports first: a customer is waiting for an answer. */}
      <section id="reports" className="mt-8 scroll-mt-20">
        <h2 className="text-xl font-bold">
          {fb.reportsTitle} <span className="text-stone-400">({openReports.length})</span>
        </h2>
        <p className="mt-1 text-sm text-stone-500">{fb.reportsHint}</p>
        {openReports.length === 0 ? (
          <p className="mt-3 text-stone-500">{fb.noReports}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {openReports.map((report) => (
              <li key={report.id} className="rounded-2xl bg-white p-5 ring-1 ring-red-200">
                <p className="text-sm text-stone-500">
                  <span className="font-mono font-semibold text-stone-800">{report.order.pickupCode}</span> ·{" "}
                  {report.order.bag.store.name} · {report.order.bag.title} ·{" "}
                  {f.pickupWindow(report.order.bag.pickupStart, report.order.bag.pickupEnd)}
                </p>
                <p className="mt-1 text-sm text-stone-500">
                  {t.customer}: {report.order.user.name} ({report.order.user.email}) · {dict.orders.status[report.order.status === "RESERVED" ? "MISSED" : report.order.status]}
                </p>
                <p className="mt-3 font-semibold">{isProblemKind(report.kind) ? fb.kinds[report.kind] : report.kind}</p>
                <p className="mt-1 whitespace-pre-line text-stone-800">{report.text}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {report.order.payment?.status === "PAID" ? (
                    <>
                      <form action={resolveReport}>
                        <input type="hidden" name="reportId" value={report.id} />
                        <input type="hidden" name="decision" value="refund" />
                        <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
                          {fb.refund} · {f.price(report.order.payment.amount)}
                        </button>
                      </form>
                    </>
                  ) : (
                    <span className="text-sm text-stone-500">{fb.notPaid}</span>
                  )}
                  <form action={resolveReport}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="decision" value="close" />
                    <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100">
                      {fb.close}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {resolvedReports.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-stone-600">{fb.recentlyResolved}</summary>
            <ul className="mt-2 space-y-1 text-sm text-stone-600">
              {resolvedReports.map((report) => (
                <li key={report.id}>
                  <span className="font-mono">{report.order.pickupCode}</span> · {report.order.bag.store.name} ·{" "}
                  {isProblemKind(report.kind) ? fb.kinds[report.kind] : report.kind} ·{" "}
                  <span className="font-medium">{fb.status[report.status as keyof typeof fb.status] ?? report.status}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Stores asking to join (from /partners): call them back. */}
      <section id="partners" className="mt-10 scroll-mt-20">
        <h2 className="text-xl font-bold">
          {pt.adminTitle} <span className="text-stone-400">({newPartners.length})</span>
        </h2>
        <p className="mt-1 text-sm text-stone-500">{pt.adminHint}</p>
        {newPartners.length === 0 ? (
          <p className="mt-3 text-stone-500">{pt.adminNone}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {newPartners.map((request) => (
              <li key={request.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {request.storeName} <span className="font-normal text-stone-500">· {isBusinessKind(request.kind) ? pt.kinds[request.kind] : request.kind} · {cityName(dict.cities, request.city)}</span>
                  </p>
                  <span className="text-sm text-stone-500">{f.date(request.createdAt)}, {f.time(request.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm">
                  {request.contactName} ·{" "}
                  <a href={`tel:${request.phone}`} className="font-semibold text-brand-dark underline underline-offset-2"><Doodle name="phone" size={15} className="mr-1" />{formatPhone(request.phone)}</a>
                  {request.email && <> · <a href={`mailto:${request.email}`} className="text-brand-dark underline underline-offset-2">{request.email}</a></>}
                </p>
                {request.message && <p className="mt-2 whitespace-pre-line text-sm text-stone-700">{request.message}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["CONTACTED", "CLOSED"] as const).map((status) => (
                    <form key={status} action={handlePartnerRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="status" value={status} />
                      <button type="submit" className={status === "CONTACTED"
                        ? "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        : "rounded-lg px-4 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"}>
                        {status === "CONTACTED" ? pt.contacted : pt.close}
                      </button>
                    </form>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {handledPartners.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-stone-600">{pt.recent}</summary>
            <ul className="mt-2 space-y-1 text-sm text-stone-600">
              {handledPartners.map((request) => (
                <li key={request.id}>
                  {request.storeName} · {formatPhone(request.phone)} · <span className="font-medium">{pt.status[request.status as keyof typeof pt.status] ?? request.status}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">
          {t.pending} <span className="text-stone-400">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white py-8 text-center text-stone-500">
            {t.noPending}
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {pending.map((store) => (
              <li key={store.id} className="rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                <StoreDetails store={store} t={t} created={f.day(store.createdAt)} cities={dict.cities} />
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <form action={approveStore}>
                    <input type="hidden" name="storeId" value={store.id} />
                    <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                      <Doodle name="check" size={15} className="mr-1" />{t.approve}
                    </button>
                  </form>
                  <RejectForm storeId={store.id} label={t.reject} reasonLabel={t.reasonLabel} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">{t.allStores}</h2>
        <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
          {stores
            .filter((store) => store.status !== "PENDING")
            .map((store) => (
              <li key={store.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <StoreDetails store={store} t={t} created={f.day(store.createdAt)} cities={dict.cities} />
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[store.status]}`}>
                    {t.status[store.status]}
                  </span>
                </div>
                {store.rejectionReason && <p className="mt-2 text-sm text-stone-600">“{store.rejectionReason}”</p>}
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  {store.status === "APPROVED" ? (
                    <RejectForm storeId={store.id} label={t.hide} reasonLabel={t.reasonLabel} />
                  ) : (
                    <form action={approveStore}>
                      <input type="hidden" name="storeId" value={store.id} />
                      <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
                        <Doodle name="check" size={15} className="mr-1" />{t.approve}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
        </ul>
      </section>

      <section id="orders" className="mt-10 scroll-mt-20">
        <h2 className="text-xl font-bold">{t.orders}</h2>
        <p className="text-sm text-stone-500">{t.ordersHint}</p>
        {orders.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white py-8 text-center text-stone-500">
            {t.noOrders}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            {orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-semibold">
                    <span className="font-mono">{order.pickupCode}</span> · {order.bag.title} × {order.quantity} ·{" "}
                    {f.price(order.totalPrice)}
                  </p>
                  <p className="text-stone-500">
                    {order.bag.store.name} · {f.pickupWindow(order.bag.pickupStart, order.bag.pickupEnd)} · {t.customer}:{" "}
                    {order.user.name} ({order.user.email})
                    {order.user._count.orders > 0 && (
                      <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                        {fill(t.noShows, { n: order.user._count.orders })}
                      </span>
                    )}
                  </p>
                </div>
                <form action={cancelAndRefund}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <button type="submit" className="rounded-lg px-3 py-1.5 font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50">
                    {t.cancelRefund}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

type Labels = Awaited<ReturnType<typeof getI18n>>["dict"]["admin"];

function StoreDetails({ store, t, created, cities }: {
  store: Store & { owner: { name: string; email: string }; _count: { bags: number } };
  t: Labels;
  created: string;
  cities: Record<City, string>;
}) {
  const hasLocation = store.latitude != null && store.longitude != null;
  return (
    <div className="min-w-0 text-sm">
      <p className="text-base font-semibold">{store.name}</p>
      <p className="text-stone-600">
        {store.address}, {cityName(cities, store.city)} ·{" "}
        {hasLocation ? (
          <a
            href={`https://www.openstreetmap.org/?mlat=${store.latitude}&mlon=${store.longitude}#map=17/${store.latitude}/${store.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="text-brand-dark underline"
          >
            {t.onMap}
          </a>
        ) : (
          t.noLocation
        )}
      </p>
      {store.phone && <p className="text-stone-600"><Doodle name="phone" size={14} className="mr-1" />{formatPhone(store.phone)}</p>}
      {store.description && <p className="mt-1 text-stone-600">{store.description}</p>}
      <p className="mt-1 text-stone-500">
        {t.owner}: {store.owner.name} ({store.owner.email}) · {t.created}: {created}
      </p>
    </div>
  );
}

function RejectForm({ storeId, label, reasonLabel }: { storeId: string; label: string; reasonLabel: string }) {
  return (
    <form action={rejectStore} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="storeId" value={storeId} />
      <label className="text-xs text-stone-600">
        {reasonLabel}
        <input
          name="reason"
          required
          maxLength={500}
          className="mt-1 block w-64 rounded-lg border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
        />
      </label>
      <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100">
        {label}
      </button>
    </form>
  );
}
