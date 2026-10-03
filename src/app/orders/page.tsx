import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cancelOrder } from "@/app/actions/orders";
import type { Order, Payment, Store, SurpriseBag } from "@/generated/prisma/client";
import { getI18n } from "@/i18n/server";
import { CATEGORY_DOODLE } from "@/lib/categories";
import { getPaymentProvider } from "@/lib/payments/provider";
import { runHousekeeping } from "@/lib/housekeeping";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { cityName } from "@/lib/cities";
import { formatPhone } from "@/lib/phone";
import { BagCard } from "@/components/BagCard";
import { PushToggle } from "@/components/PushToggle";
import { StatCard } from "@/components/StatCard";
import { customerImpact } from "@/lib/impact";
import { isCancelReason } from "@/lib/orders";
import { canRate, canReport } from "@/lib/feedback";
import { OrderFeedback } from "@/components/OrderFeedback";
import { pushPublicKey } from "@/lib/push";
import { Doodle } from "@/components/Doodle";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.orders };
}

type OrderWithBag = Order & {
  bag: SurpriseBag & { store: Store };
  payment: Payment | null;
  review: { rating: number } | null;
  report: { status: string } | null;
};

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const user = await requireUser("/orders");
  if (user.role !== "CUSTOMER") redirect("/dashboard"); // store accounts don't order
  const { new: newOrderId, declined, error } = await searchParams;
  await runHousekeeping(); // unpaid orders past their deadline become EXPIRED
  const { dict, f, fill } = await getI18n();
  const t = dict.orders;

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: {
      bag: { include: { store: true } },
      payment: true,
      review: { select: { rating: true } },
      report: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const impact = await customerImpact(user.id);

  const now = new Date();
  const upcoming = orders.filter(
    (o) => o.status === "PENDING_PAYMENT" || (o.status === "RESERVED" && o.bag.pickupEnd > now),
  );
  const past = orders.filter((o) => !upcoming.includes(o));
  const justReserved = upcoming.find((o) => o.id === newOrderId);

  // Orders the store couldn't hand over in the last two days: apologise at
  // the top and suggest other stores' bags from the same city.
  const recentlyCancelled = orders.filter(
    (o) =>
      o.status === "CANCELLED" &&
      (o.cancelledBy === "store" || o.cancelledBy === "admin") &&
      now.getTime() - o.updatedAt.getTime() < 2 * 24 * 60 * 60 * 1000,
  );
  const alternatives = recentlyCancelled.length
    ? await prisma.surpriseBag.findMany({
        where: {
          isActive: true,
          quantityAvailable: { gt: 0 },
          pickupEnd: { gt: now },
          // Not from the store that just cancelled.
          storeId: { notIn: recentlyCancelled.map((o) => o.bag.storeId) },
          store: { status: "APPROVED", city: recentlyCancelled[0].bag.store.city },
        },
        include: { store: true },
        orderBy: { pickupStart: "asc" },
        take: 3,
      })
    : [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{t.title}</h1>
        <PushToggle publicKey={pushPublicKey()} hint={dict.push.customerHint} />
      </div>

      {(declined || error === "too-late") && (
        <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-red-700">
          {declined ? t.declined : t.tooLate}
        </p>
      )}

      {impact.bags > 0 && (
        <section className="mt-6 rounded-2xl bg-brand-light/60 p-5 ring-1 ring-accent/20">
          <h2 className="flex items-center gap-2 font-semibold text-brand-dark"><Doodle name="sprout" size={22} />{dict.impact.title}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
            <StatCard template={dict.impact.bags} value={impact.bags} />
            <StatCard template={dict.impact.money} value={f.price(impact.saved)} />
          </div>
        </section>
      )}

      {recentlyCancelled.map((order) => (
        <div key={order.id} role="status" className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <p className="flex items-center gap-2 text-lg font-semibold"><Doodle name="sad" size={24} className="text-brand" />{fill(t.sorryTitle, { code: order.pickupCode })}</p>
          <p className="mt-1 text-stone-700">
            {fill(t.sorryText, { store: order.bag.store.name })}{" "}
            {order.cancelReason && order.cancelReason !== "OTHER" && isCancelReason(order.cancelReason) &&
              fill(t.reasonLine, { reason: dict.cancelReasons[order.cancelReason] })}
          </p>
          <p className="mt-1 font-medium text-brand-dark">
            {fill(order.payment?.status === "REFUNDED" ? t.refundDone : t.refundGoing, { amount: f.price(order.totalPrice) })}
          </p>
        </div>
      ))}
      {alternatives.length > 0 && (
        <section className="mt-4">
          <p className="text-stone-700">{t.alternatives}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alternatives.map((bag) => (
              <BagCard key={bag.id} bag={bag} />
            ))}
          </div>
          <Link href="/" className="mt-3 inline-block font-semibold text-brand-dark hover:underline">
            {t.findBag}
          </Link>
        </section>
      )}

      {justReserved && (
        <div role="status" className="mt-6 rounded-2xl bg-accent p-5 text-white">
          <p className="flex items-center gap-2 text-lg font-semibold"><Doodle name="party" size={26} />{t.reservedTitle}</p>
          <p className="mt-1">
            {/* Split around {code} so the code itself can be shown in bold. */}
            {fill(t.reservedText, {
              store: justReserved.bag.store.name,
              window: f.pickupWindow(justReserved.bag.pickupStart, justReserved.bag.pickupEnd),
            })
              .split("{code}")
              .map((part, i) => (
                <span key={i}>
                  {i > 0 && <strong className="font-mono">{justReserved.pickupCode}</strong>}
                  {part}
                </span>
              ))}
          </p>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t.upcoming}</h2>
        {upcoming.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center">
            <p className="text-stone-600">{t.none}</p>
            <Link href="/" className="mt-2 inline-block font-semibold text-brand-dark hover:underline">
              {t.findBag}
            </Link>
          </div>
        ) : (
          <ul className="mt-3 space-y-4">
            {upcoming.map((order) => (
              <OrderCard key={order.id} order={order} highlight={order.id === newOrderId} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">{t.past}</h2>
          <ul className="mt-3 space-y-4">
            {past.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

const STATUS_STYLES = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-900",
  NO_SHOW: "bg-stone-200 text-stone-600",
  EXPIRED: "bg-stone-200 text-stone-600",
  RESERVED: "bg-brand-light text-brand-dark",
  COLLECTED: "bg-accent text-white",
  CANCELLED: "bg-stone-200 text-stone-600",
  MISSED: "bg-stone-200 text-stone-600",
};

async function OrderCard({ order, highlight = false }: { order: OrderWithBag; highlight?: boolean }) {
  const { dict, f, fill } = await getI18n();
  const t = dict.orders;
  const { bag, payment } = order;
  const now = new Date();
  const isPending = order.status === "PENDING_PAYMENT";
  const isUpcoming = order.status === "RESERVED" && bag.pickupEnd > now;
  const status = order.status === "RESERVED" && !isUpcoming ? "MISSED" : order.status;
  const canCancel = isPending || (isUpcoming && bag.pickupStart > now); // refunds only before pickup starts

  return (
    <li
      className={`flex gap-4 rounded-2xl bg-white p-4 ring-1 ${
        highlight ? "ring-2 ring-accent" : "ring-stone-200"
      } ${isUpcoming || isPending || canRate(order) || canReport(order) ? "" : "opacity-75"}`}
    >
      <Link href={`/bags/${bag.id}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-brand-light sm:size-24">
        {bag.imageUrl ? (
          <Image src={bag.imageUrl} alt="" fill sizes="96px" className="object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-brand"><Doodle name={CATEGORY_DOODLE[bag.category]} size={44} /></span>
        )}
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm text-stone-500">{bag.store.name}</p>
            <h3 className="font-semibold">
              {bag.title}
              {order.quantity > 1 && <span className="text-stone-500"> × {order.quantity}</span>}
            </h3>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
            {dict.orders.status[status]}
          </span>
        </div>

        <p className="mt-1 text-sm text-stone-600">
          {f.pickupWindow(bag.pickupStart, bag.pickupEnd)} · {bag.store.address}, {cityName(dict.cities, bag.store.city)}
        </p>
        {(isUpcoming || isPending) && bag.store.phone && (
          <a href={`tel:${bag.store.phone}`} className="mt-1 inline-block text-sm font-medium text-brand-dark underline underline-offset-2">
            <Doodle name="phone" size={15} className="mr-1" />{dict.store.call} · {formatPhone(bag.store.phone)}
          </a>
        )}
        {isPending && order.expiresAt && (
          <p className="mt-1 text-sm font-medium text-amber-800">{fill(t.payBy, { time: f.time(order.expiresAt) })}</p>
        )}
        {(order.cancelledBy === "store" || order.cancelledBy === "admin") && (
          <p className="mt-1 text-sm text-stone-600">
            {t.cancelledByStore}{" "}
            {order.cancelReason && order.cancelReason !== "OTHER" && isCancelReason(order.cancelReason) &&
              fill(t.reasonLine, { reason: dict.cancelReasons[order.cancelReason] })}
          </p>
        )}
        {payment?.status === "REFUNDED" && <p className="mt-1 text-sm text-stone-600">{t.refunded}</p>}
        {payment?.status === "PAID" && (order.status === "CANCELLED" || order.status === "EXPIRED") && (
          <p className="mt-1 text-sm text-stone-600">{t.refundPending}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {isUpcoming && (
              <span className="rounded-lg bg-stone-900 px-3 py-1.5 font-mono text-lg font-bold tracking-wider text-white">
                {order.pickupCode}
              </span>
            )}
            <span className="font-semibold">{f.price(order.totalPrice)}</span>
            {isPending && payment && (
              <Link
                href={getPaymentProvider().resumeUrl(payment)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                {t.payNow}
              </Link>
            )}
          </div>
          {canCancel && (
            <form action={cancelOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="text-sm font-medium text-stone-500 underline-offset-2 hover:text-red-700 hover:underline">
                {isPending ? dict.common.cancel : t.cancel}
              </button>
            </form>
          )}
        </div>
        {(canRate(order) || canReport(order) || order.review || order.report) && (
          <OrderFeedback
            orderId={order.id}
            review={order.review}
            report={order.report}
            canRate={canRate(order)}
            canReport={canReport(order)}
          />
        )}
      </div>
    </li>
  );
}
