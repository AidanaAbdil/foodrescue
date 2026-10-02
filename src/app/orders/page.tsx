import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cancelOrder } from "@/app/actions/orders";
import type { Order, Store, SurpriseBag } from "@/generated/prisma/client";
import { getI18n } from "@/i18n/server";
import { CATEGORY_EMOJI } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.orders };
}

type OrderWithBag = Order & { bag: SurpriseBag & { store: Store } };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const user = await requireUser("/orders");
  const { new: newOrderId } = await searchParams;
  const { dict, f, fill } = await getI18n();
  const t = dict.orders;

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
      <h1 className="text-3xl font-bold">{t.title}</h1>

      {justReserved && (
        <div role="status" className="mt-6 rounded-2xl bg-accent p-5 text-white">
          <p className="text-lg font-semibold">{t.reservedTitle}</p>
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
  RESERVED: "bg-brand-light text-brand-dark",
  COLLECTED: "bg-accent text-white",
  CANCELLED: "bg-stone-200 text-stone-600",
  MISSED: "bg-stone-200 text-stone-600",
};

async function OrderCard({ order, highlight = false }: { order: OrderWithBag; highlight?: boolean }) {
  const { dict, f } = await getI18n();
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
          <span className="grid h-full place-items-center text-3xl">{CATEGORY_EMOJI[bag.category]}</span>
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
          {f.pickupWindow(bag.pickupStart, bag.pickupEnd)} · {bag.store.address}, {bag.store.city}
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {isUpcoming && (
              <span className="rounded-lg bg-stone-900 px-3 py-1.5 font-mono text-lg font-bold tracking-wider text-white">
                {order.pickupCode}
              </span>
            )}
            <span className="font-semibold">{f.price(order.totalPrice)}</span>
          </div>
          {isUpcoming && (
            <form action={cancelOrder}>
              <input type="hidden" name="orderId" value={order.id} />
              <button type="submit" className="text-sm font-medium text-stone-500 underline-offset-2 hover:text-red-700 hover:underline">
                {dict.orders.cancel}
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}
