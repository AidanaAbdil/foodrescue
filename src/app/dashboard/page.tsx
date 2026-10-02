import type { Metadata } from "next";
import Link from "next/link";
import { markCollected, toggleBagActive } from "@/app/actions/dashboard";
import { StoreSetupForm } from "@/components/dashboard/StoreSetupForm";
import type { SurpriseBag } from "@/generated/prisma/client";
import { CATEGORIES } from "@/lib/categories";
import { formatDay, formatPrice, formatTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard · FoodRescue" };

export default async function DashboardPage() {
  const user = await requireOwner();

  const stores = await prisma.store.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      bags: {
        orderBy: { pickupStart: "desc" },
        include: { _count: { select: { orders: { where: { status: { not: "CANCELLED" } } } } } },
      },
    },
  });

  if (stores.length === 0) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-12">
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 sm:p-8">
          <p className="text-3xl" aria-hidden>
            🏪
          </p>
          <h1 className="mt-2 text-2xl font-bold">Set up your store</h1>
          <p className="mt-1 text-stone-600">Tell customers where to pick up their bags.</p>
          <div className="mt-6">
            <StoreSetupForm />
          </div>
        </div>
      </main>
    );
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [pickups, collectedToday] = await Promise.all([
    // Reservations still to be picked up (including ones from earlier today,
    // in case the customer is running late).
    prisma.order.findMany({
      where: { status: "RESERVED", bag: { store: { ownerId: user.id }, pickupEnd: { gte: startOfToday } } },
      include: { user: { select: { name: true } }, bag: { include: { store: { select: { name: true } } } } },
      orderBy: { bag: { pickupStart: "asc" } },
    }),
    prisma.order.count({
      where: { status: "COLLECTED", updatedAt: { gte: startOfToday }, bag: { store: { ownerId: user.id } } },
    }),
  ]);

  const allBags = stores.flatMap((store) => store.bags);
  const liveBags = allBags.filter((bag) => bagStatus(bag, now) === "LIVE").length;
  const showStoreName = stores.length > 1;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-stone-500">{stores.map((s) => s.name).join(" · ")}</p>
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>
        <Link
          href="/dashboard/bags/new"
          className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark"
        >
          + Add a bag
        </Link>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Bags live" value={liveBags} />
        <Stat label="Waiting for pickup" value={pickups.length} />
        <Stat label="Collected today" value={collectedToday} />
      </dl>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Upcoming pickups</h2>
        <p className="text-sm text-stone-500">Check the customer&apos;s code, hand over the bag, then mark it collected.</p>
        {pickups.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white py-8 text-center text-stone-500">
            No reservations waiting right now.
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
                    {formatDay(order.bag.pickupStart)}, {formatTime(order.bag.pickupStart)}–
                    {formatTime(order.bag.pickupEnd)}
                    {showStoreName && ` · ${order.bag.store.name}`}
                    {order.bag.pickupEnd < now && <span className="font-medium text-brand-dark"> · running late</span>}
                  </p>
                </div>
                <form action={markCollected}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <button
                    type="submit"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    ✓ Mark collected
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Your bags</h2>
        {allBags.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center">
            <p className="text-stone-600">You haven&apos;t listed any bags yet.</p>
            <Link href="/dashboard/bags/new" className="mt-2 inline-block font-semibold text-brand-dark hover:underline">
              Add your first bag →
            </Link>
          </div>
        ) : (
          // A list that lays out as columns on wider screens and stacks on phones.
          <div className="mt-4 overflow-hidden rounded-2xl bg-white text-sm ring-1 ring-stone-200">
            <div className={`${BAG_GRID} hidden gap-x-4 border-b border-stone-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-stone-500 md:grid`}>
              <span>Bag</span>
              <span>Pickup</span>
              <span>Price</span>
              <span>Left / reserved</span>
              <span>Status</span>
              <span className="sr-only">Actions</span>
            </div>
            <ul className="divide-y divide-stone-100">
              {stores.flatMap((store) =>
                store.bags.map((bag) => {
                  const status = STATUS[bagStatus(bag, now)];
                  return (
                    <li key={bag.id} className={`${BAG_GRID} grid gap-x-4 gap-y-1 px-4 py-3 md:items-center`}>
                      <div className="flex items-start justify-between gap-3 md:block">
                        <div>
                          <p className="font-semibold">
                            {CATEGORIES[bag.category].emoji} {bag.title}
                          </p>
                          {showStoreName && <p className="text-stone-500">{store.name}</p>}
                        </div>
                        <StatusBadge status={status} className="shrink-0 md:hidden" />
                      </div>
                      <p className="text-stone-600">
                        {formatDay(bag.pickupStart)}
                        <span className="md:hidden">, </span>
                        <br className="hidden md:block" />
                        {formatTime(bag.pickupStart)}–{formatTime(bag.pickupEnd)}
                      </p>
                      <p>
                        <span className="font-semibold">{formatPrice(bag.price)}</span>{" "}
                        <span className="text-stone-400 line-through">{formatPrice(bag.originalPrice)}</span>
                        <span className="text-stone-600 md:hidden">
                          {" "}
                          · {bag.quantityAvailable} left, {bag._count.orders} reserved
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
                          Edit
                        </Link>
                        <form action={toggleBagActive}>
                          <input type="hidden" name="bagId" value={bag.id} />
                          <button
                            type="submit"
                            className="rounded-lg px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-100"
                          >
                            {bag.isActive ? "Hide" : "Show"}
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                }),
              )}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200 sm:p-5">
      <dt className="text-xs font-medium text-stone-500 sm:text-sm">{label}</dt>
      <dd className="mt-1 text-2xl font-bold sm:text-3xl">{value}</dd>
    </div>
  );
}

// Column widths for the bag list header and rows (wide screens only).
const BAG_GRID = "md:grid-cols-[2fr_1.4fr_1.2fr_1fr_0.8fr_7.5rem]";

function StatusBadge({ status, className = "" }: { status: { label: string; className: string }; className?: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className} ${className}`}>{status.label}</span>
  );
}

type BagStatus = "LIVE" | "HIDDEN" | "SOLD_OUT" | "ENDED";

function bagStatus(bag: SurpriseBag, now: Date): BagStatus {
  if (bag.pickupEnd <= now) return "ENDED";
  if (!bag.isActive) return "HIDDEN";
  if (bag.quantityAvailable === 0) return "SOLD_OUT";
  return "LIVE";
}

const STATUS: Record<BagStatus, { label: string; className: string }> = {
  LIVE: { label: "Live", className: "bg-accent text-white" },
  HIDDEN: { label: "Hidden", className: "bg-stone-200 text-stone-700" },
  SOLD_OUT: { label: "Sold out", className: "bg-stone-800 text-white" },
  ENDED: { label: "Ended", className: "bg-stone-100 text-stone-500" },
};
