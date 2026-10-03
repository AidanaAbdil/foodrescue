import type { Metadata } from "next";
import Link from "next/link";
import { cantHandOver, deleteSchedule, markCollected, noShow, toggleBagActive, toggleSchedule } from "@/app/actions/dashboard";
import { NewOrderAlert } from "@/components/dashboard/NewOrderAlert";
import { PushToggle } from "@/components/PushToggle";
import { SetLocationButton } from "@/components/dashboard/SetLocationButton";
import { StoreForm } from "@/components/dashboard/StoreForm";
import { StatCard } from "@/components/StatCard";
import type { SurpriseBag } from "@/generated/prisma/client";
import { getI18n } from "@/i18n/server";
import { startOfToday } from "@/i18n/shared";
import { CATEGORY_EMOJI } from "@/lib/categories";
import { latestPaidOrder } from "@/lib/new-orders";
import { pushPublicKey } from "@/lib/push";
import { nextWindow, parseWeekdays } from "@/lib/schedules";
import { runHousekeeping } from "@/lib/housekeeping";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { CANCEL_REASONS } from "@/lib/orders";
import { roundRating } from "@/lib/feedback";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.dashboard };
}

export default async function DashboardPage() {
  const user = await requireOwner();
  await runHousekeeping();
  const { dict, f, fill, locale } = await getI18n();
  const t = dict.dashboard;

  const stores = await prisma.store.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      bags: {
        orderBy: { pickupStart: "desc" },
        // "Reserved" = paid orders only (not unpaid holds, cancelled or expired).
        include: { _count: { select: { orders: { where: { status: { in: ["RESERVED", "COLLECTED"] } } } } } },
      },
      schedules: { orderBy: { createdAt: "asc" } },
    },
  });

  if (stores.length === 0) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-12">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 sm:p-8">
          <p className="text-3xl" aria-hidden>
            🏪
          </p>
          <h1 className="mt-2 text-2xl font-bold">{t.setupTitle}</h1>
          <p className="mt-1 text-stone-600">{t.setupSubtitle}</p>
          <div className="mt-6">
            <StoreForm />
          </div>
        </div>
      </main>
    );
  }

  const now = new Date();
  const todayStart = startOfToday(); // midnight, Kazakhstan time

  const [pickups, collectedToday, latestOrder] = await Promise.all([
    // Reservations still to be picked up (including ones from earlier today,
    // in case the customer is running late).
    prisma.order.findMany({
      where: { status: "RESERVED", bag: { store: { ownerId: user.id }, pickupEnd: { gte: todayStart } } },
      include: { user: { select: { name: true } }, bag: { include: { store: { select: { name: true } } } } },
      orderBy: { bag: { pickupStart: "asc" } },
    }),
    prisma.order.count({
      where: { status: "COLLECTED", updatedAt: { gte: todayStart }, bag: { store: { ownerId: user.id } } },
    }),
    latestPaidOrder(user.id),
  ]);

  // Customers' ratings of this owner's stores (comments are private to the store and admins).
  const reviewWhere = { store: { ownerId: user.id } };
  const [reviewStats, reviews] = await Promise.all([
    prisma.review.aggregate({ where: reviewWhere, _avg: { rating: true }, _count: true }),
    prisma.review.findMany({
      where: reviewWhere,
      include: { order: { select: { bag: { select: { title: true, pickupStart: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const allBags = stores.flatMap((store) => store.bags);
  const liveBags = allBags.filter((bag) => bagStatus(bag, now) === "LIVE").length;
  const showStoreName = stores.length > 1;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {/* Store names link to their settings. */}
          <p className="text-sm font-medium text-stone-500">
            {stores.map((store, i) => (
              <span key={store.id}>
                {i > 0 && " · "}
                <Link
                  href={`/dashboard/stores/${store.id}/edit`}
                  title={t.editStore}
                  className="underline decoration-stone-300 underline-offset-2 hover:text-brand-dark"
                >
                  {store.name} ✎
                </Link>
              </span>
            ))}
          </p>
          <h1 className="text-3xl font-bold">{t.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <PushToggle publicKey={pushPublicKey()} hint={dict.push.hint} />
          <NewOrderAlert initial={latestOrder} />
          <Link
            href="/dashboard/earnings"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
          >
            {dict.earnings.link}
          </Link>
          <Link
            href="/dashboard/bags/new"
            className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark"
          >
            {t.addBag}
          </Link>
        </div>
      </div>

      {/* Review status: new stores wait for an admin; rejected ones say why. */}
      {stores
        .filter((store) => store.status !== "APPROVED")
        .map((store) => (
          <p
            key={store.id}
            role="note"
            className={`mt-6 rounded-2xl p-4 text-sm ring-1 ${
              store.status === "PENDING" ? "bg-amber-50 text-amber-900 ring-amber-200" : "bg-red-50 text-red-800 ring-red-200"
            }`}
          >
            {store.status === "PENDING"
              ? fill(t.pendingNotice, { store: store.name })
              : fill(t.rejectedNotice, { store: store.name, reason: store.rejectionReason ?? "" })}
          </p>
        ))}

      {stores
        .filter((store) => !store.phone)
        .map((store) => (
          <div key={store.id} className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
            <p className="text-sm text-amber-900">{fill(t.phoneMissing, { store: store.name })}</p>
            <Link href={`/dashboard/stores/${store.id}/edit`} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
              {t.addPhone}
            </Link>
          </div>
        ))}

      {stores
        .filter((store) => store.latitude == null || store.longitude == null)
        .map((store) => (
          <div
            key={store.id}
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-light/60 p-4 ring-1 ring-accent/30"
          >
            <p className="text-sm text-stone-700">{fill(t.noLocation, { store: store.name })}</p>
            <SetLocationButton storeId={store.id} />
          </div>
        ))}

      <div className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard template={t.statLive} value={liveBags} />
        <StatCard template={t.statWaiting} value={pickups.length} />
        <StatCard template={t.statCollected} value={collectedToday} />
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-bold">{t.pickupsTitle}</h2>
        <p className="text-sm text-stone-500">{t.pickupsHint}</p>
        {pickups.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white py-8 text-center text-stone-500">
            {t.noPickups}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white ring-1 ring-stone-200">
            {pickups.map((order) => (
              <li key={order.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6">
                <span className="self-start rounded-lg bg-stone-900 px-3 py-1.5 font-mono text-lg font-bold tracking-wider text-white sm:self-auto">
                  {order.pickupCode}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {order.user.name}
                    <span className="font-normal text-stone-500">
                      {" "}
                      · {order.quantity} × {order.bag.title}
                    </span>
                  </p>
                  <p className="text-sm text-stone-500">
                    {f.pickupWindow(order.bag.pickupStart, order.bag.pickupEnd)}
                    {showStoreName && ` · ${order.bag.store.name}`}
                    {order.bag.pickupEnd < now && <span className="font-medium text-brand-dark"> · {t.runningLate}</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={markCollected}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      {t.markCollected}
                    </button>
                  </form>
                  {/* Only once pickup has started can a customer be a no-show. */}
                  {order.bag.pickupStart <= now && (
                    <ConfirmSubmit
                      action={noShow}
                      message={fill(t.noShowConfirm, { code: order.pickupCode })}
                      hidden={{ orderId: order.id }}
                      yes={t.confirmYes}
                      no={t.confirmNo}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
                    >
                      {t.noShow}
                    </ConfirmSubmit>
                  )}
                  <ConfirmSubmit
                    action={cantHandOver}
                    message={fill(t.cantHandOverConfirm, { code: order.pickupCode })}
                    hidden={{ orderId: order.id }}
                    yes={t.confirmYes}
                    no={t.confirmNo}
                    fields={
                      <fieldset className="mt-2 space-y-1">
                        <legend className="font-medium text-stone-700">{t.cancelReasonLabel}</legend>
                        {CANCEL_REASONS.map((reason, i) => (
                          <label key={reason} className="flex items-center gap-2">
                            <input type="radio" name="reason" value={reason} defaultChecked={i === 0} className="accent-brand" />
                            {dict.cancelReasons[reason]}
                          </label>
                        ))}
                      </fieldset>
                    }
                    className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50"
                  >
                    {t.cantHandOver}
                  </ConfirmSubmit>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {stores.some((store) => store.schedules.length > 0) && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">🔁 {t.schedulesTitle}</h2>
          <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-2xl bg-white text-sm ring-1 ring-stone-200">
            {stores.flatMap((store) =>
              store.schedules.map((schedule) => {
                const days = parseWeekdays(schedule.weekdays);
                return (
                  <li key={schedule.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {CATEGORY_EMOJI[schedule.category]} {schedule.title}
                      </p>
                      <p className="text-stone-600">
                        {days.length === 7 ? t.everyDay : days.map((day) => t.weekdays[day - 1]).join(", ")} ·{" "}
                        {schedule.startTime}–{schedule.endTime} · {fill(t.perDay, { n: schedule.quantity })} ·{" "}
                        {f.price(schedule.price)}
                        {showStoreName && ` · ${store.name}`}
                      </p>
                      {schedule.isActive && nextWindow(schedule) && (
                        <p className="text-brand-dark">
                          {fill(t.nextBag, { when: f.pickupWindow(nextWindow(schedule)!.start, nextWindow(schedule)!.end) })}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        schedule.isActive ? "bg-accent text-white" : "bg-stone-200 text-stone-700"
                      }`}
                    >
                      {schedule.isActive ? t.scheduleActive : t.schedulePaused}
                    </span>
                    <div className="flex gap-1">
                      <Link
                        href={`/dashboard/schedules/${schedule.id}/edit`}
                        className="rounded-lg px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100"
                      >
                        {t.edit}
                      </Link>
                      <form action={toggleSchedule}>
                        <input type="hidden" name="scheduleId" value={schedule.id} />
                        <button type="submit" className="rounded-lg px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100">
                          {schedule.isActive ? t.pause : t.resume}
                        </button>
                      </form>
                      <form action={deleteSchedule}>
                        <input type="hidden" name="scheduleId" value={schedule.id} />
                        <button type="submit" className="rounded-lg px-3 py-1.5 font-medium text-red-700 hover:bg-red-50">
                          {t.deleteSchedule}
                        </button>
                      </form>
                    </div>
                  </li>
                );
              }),
            )}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold">{t.bagsTitle}</h2>
        {allBags.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center">
            <p className="text-stone-600">{t.noBags}</p>
            <Link href="/dashboard/bags/new" className="mt-2 inline-block font-semibold text-brand-dark hover:underline">
              {t.addFirst}
            </Link>
          </div>
        ) : (
          // A list that lays out as columns on wider screens and stacks on phones.
          <div className="mt-4 overflow-hidden rounded-2xl bg-white text-sm ring-1 ring-stone-200">
            <div className={`${BAG_GRID} hidden gap-x-4 border-b border-stone-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-500 md:grid`}>
              <span>{t.colBag}</span>
              <span>{t.colPickup}</span>
              <span>{t.colPrice}</span>
              <span>{t.colStock}</span>
              <span>{t.colStatus}</span>
              <span className="sr-only">{t.colActions}</span>
            </div>
            <ul className="divide-y divide-stone-100">
              {stores.flatMap((store) =>
                store.bags.map((bag) => {
                  const key = bagStatus(bag, now);
                  const status = { label: t.status[key], className: STATUS_STYLES[key] };
                  return (
                    <li key={bag.id} className={`${BAG_GRID} grid gap-x-4 gap-y-1 px-4 py-3 md:items-center`}>
                      <div className="flex items-start justify-between gap-3 md:block">
                        <div>
                          <p className="font-semibold">
                            {CATEGORY_EMOJI[bag.category]} {bag.title}
                            {bag.scheduleId && (
                              <span title={t.fromSchedule} aria-label={t.fromSchedule}>
                                {" "}🔁
                              </span>
                            )}
                          </p>
                          {showStoreName && <p className="text-stone-500">{store.name}</p>}
                        </div>
                        <StatusBadge status={status} className="shrink-0 md:hidden" />
                      </div>
                      <p className="text-stone-600">
                        {f.day(bag.pickupStart)}
                        <span className="md:hidden">, </span>
                        <br className="hidden md:block" />
                        {f.time(bag.pickupStart)}–{f.time(bag.pickupEnd)}
                      </p>
                      <p>
                        <span className="font-semibold">{f.price(bag.price)}</span>{" "}
                        <span className="text-stone-400 line-through">{f.price(bag.originalPrice)}</span>
                        <span className="text-stone-600 md:hidden">
                          {" "}
                          · {fill(t.stockMobile, { left: bag.quantityAvailable, reserved: bag._count.orders })}
                        </span>
                      </p>
                      <p className="hidden text-stone-600 md:block">
                        {bag.quantityAvailable} / {bag._count.orders}
                      </p>
                      <StatusBadge status={status} className="hidden justify-self-start md:inline-block" />
                      <div className="-ml-3 flex gap-1 md:ml-0 md:justify-end">
                        <Link
                          href={`/dashboard/bags/${bag.id}/edit`}
                          className="rounded-lg px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100"
                        >
                          {t.edit}
                        </Link>
                        {/* A bag the admins hid can't be put back on sale by the store. */}
                        {!bag.hiddenByAdminAt && (
                          <form action={toggleBagActive}>
                            <input type="hidden" name="bagId" value={bag.id} />
                            <button
                              type="submit"
                              className="rounded-lg px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100"
                            >
                              {bag.isActive ? t.hide : t.show}
                            </button>
                          </form>
                        )}
                      </div>
                    </li>
                  );
                }),
              )}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">{dict.feedback.reviewsTitle}</h2>
        {reviewStats._count === 0 ? (
          <p className="mt-2 text-sm text-stone-500">{dict.feedback.noReviews}</p>
        ) : (
          <>
            <p className="mt-1 text-stone-700">
              <span className="text-amber-400" aria-hidden>★ </span>
              {fill(dict.feedback.averageLine, {
                rating: roundRating(reviewStats._avg.rating ?? 0).toLocaleString(locale === "en" ? "en" : "ru", { minimumFractionDigits: 1 }),
                n: reviewStats._count,
              })}
            </p>
            <p className="text-sm text-stone-500">{dict.feedback.reviewsHint}</p>
            <ul className="mt-4 divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
              {reviews.map((review) => (
                <li key={review.id} className="p-4 text-sm">
                  <p className="flex flex-wrap items-baseline gap-x-3">
                    <span className="text-amber-400" aria-label={`${review.rating} / 5`}>
                      {"★".repeat(review.rating)}
                      <span className="text-stone-300">{"★".repeat(5 - review.rating)}</span>
                    </span>
                    <span className="text-stone-500">
                      {review.order.bag.title} · {f.date(review.order.bag.pickupStart)}
                    </span>
                  </p>
                  {review.comment && <p className="mt-1 whitespace-pre-line text-stone-800">{review.comment}</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

// Column widths for the bag list header and rows (wide screens only).
const BAG_GRID = "md:grid-cols-[2fr_1.3fr_1.3fr_1fr_1fr_11rem]";

function StatusBadge({ status, className = "" }: { status: { label: string; className: string }; className?: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className} ${className}`}>{status.label}</span>
  );
}

type BagStatus = "LIVE" | "HIDDEN" | "BLOCKED" | "SOLD_OUT" | "ENDED";

function bagStatus(bag: SurpriseBag, now: Date): BagStatus {
  if (bag.hiddenByAdminAt) return "BLOCKED"; // hidden by the service's admins
  if (bag.pickupEnd <= now) return "ENDED";
  if (!bag.isActive) return "HIDDEN";
  if (bag.quantityAvailable === 0) return "SOLD_OUT";
  return "LIVE";
}

const STATUS_STYLES: Record<BagStatus, string> = {
  LIVE: "bg-accent text-white",
  HIDDEN: "bg-stone-200 text-stone-700",
  BLOCKED: "bg-red-100 text-red-800",
  SOLD_OUT: "bg-stone-800 text-white",
  ENDED: "bg-stone-100 text-stone-500",
};
