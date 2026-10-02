import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cancelOrder } from "@/app/actions/orders";
import type { Order, Store, SurpriseBag } from "@/generated/prisma/client";
import { CATEGORIES } from "@/lib/categories";
import { formatDay, formatPrice, formatTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "My orders · FoodRescue" };

type OrderWithBag = Order & { bag: SurpriseBag & { store: Store } };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const user = await requireUser("/orders");
  const { new: newOrderId } = await searchParams;

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { bag: { include: { store: true } } },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const upcoming = orders.filter((o) => o.status === "RESERVED" && o.bag.pickupEnd > now);
  const past = orders.filter((o) => !upcoming.includes(o));
  const justReserved = upcoming.find((o) => o.id === newOrderId);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">My orders</h1>

      {justReserved && (
        <div role="status" className="mt-6 rounded-2xl bg-accent p-5 text-white">
          <p className="text-lg font-semibold">🎉 Reserved! Thanks for rescuing food.</p>
          <p className="mt-1">
            Show code <strong className="font-mono">{justReserved.pickupCode}</strong> at {justReserved.bag.store.name}{" "}
            {formatDay(justReserved.bag.pickupStart).toLowerCase()} between {formatTime(justReserved.bag.pickupStart)}{" "}
            and {formatTime(justReserved.bag.pickupEnd)}.
          </p>
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Upcoming pickups</h2>
        {upcoming.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white py-10 text-center">
            <p className="text-stone-600">No upcoming pickups.</p>
            <Link href="/" className="mt-2 inline-block font-semibold text-brand-dark hover:underline">
              Find a bag to rescue →
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
          <h2 className="text-lg font-semibold">Past orders</h2>
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

const STATUS_LABELS = {
  RESERVED: { label: "Reserved", className: "bg-brand-light text-brand-dark" },
  COLLECTED: { label: "Collected", className: "bg-accent text-white" },
  CANCELLED: { label: "Cancelled", className: "bg-stone-200 text-stone-600" },
  MISSED: { label: "Pickup missed", className: "bg-stone-200 text-stone-600" },
};

function OrderCard({ order, highlight = false }: { order: OrderWithBag; highlight?: boolean }) {
  const { bag } = order;
  const isUpcoming = order.status === "RESERVED" && bag.pickupEnd > new Date();
  const status = order.status === "RESERVED" && !isUpcoming ? "MISSED" : order.status;

  return (
    <li
      className={`flex gap-4 rounded-2xl bg-white p-4 ring-1 ${
        highlight ? "ring-2 ring-accent" : "ring-stone-200"
      } ${isUpcoming ? "" : "opacity-75"}`}
    >
      <Link href={`/bags/${bag.id}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-brand-light sm:size-24">
        {bag.imageUrl ? (
          <Image src={bag.imageUrl} alt="" fill sizes="96px" className="object-cover" />
        ) : (
          <span className="grid h-full place-items-center text-3xl">{CATEGORIES[bag.category].emoji}</span>
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
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_LABELS[status].className}`}>
            {STATUS_LABELS[status].label}
          </span>
        </div>

        <p className="mt-1 text-sm text-stone-600">
          {formatDay(bag.pickupStart)}, {formatTime(bag.pickupStart)}–{formatTime(bag.pickupEnd)} ·{" "}
          {bag.store.address}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {isUpcoming && (
              <span className="rounded-lg bg-stone-900 px-3 py-1.5 font-mono text-lg font-bold tracking-wider text-white">
                {order.pickupCode}
              </span>
            )}
            <span className="font-semibold">{formatPrice(order.totalPrice)}</span>
          </div>
          {isUpcoming && (
            <form action={cancelOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="text-sm font-medium text-stone-500 underline-offset-2 hover:text-red-700 hover:underline">
                Cancel reservation
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
