import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { testPayDecline, testPaySucceed } from "@/app/actions/payments";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { runHousekeeping } from "@/lib/housekeeping";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.pay.title };
}

// Stand-in for the provider's payment page (Kaspi, Halyk…) during development.
export default async function TestPaymentPage({ params }: PageProps<"/pay/test/[paymentId]">) {
  const { paymentId } = await params;
  const user = await requireUser(`/pay/test/${paymentId}`);
  await runHousekeeping();
  const { dict, f, fill } = await getI18n();
  const t = dict.pay;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { bag: { include: { store: true } } } } },
  });
  if (!payment || payment.provider !== "test" || payment.order.userId !== user.id) redirect("/orders");
  const { order } = payment;

  const message =
    order.status === "EXPIRED" ? t.expired : payment.status !== "PENDING" ? t.done : null;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <p role="note" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
        🧪 {t.testBanner}
      </p>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="mt-4 text-sm text-stone-500">{order.bag.store.name}</p>
        <p className="font-semibold">
          {order.bag.title} × {order.quantity}
        </p>
        <p className="mt-1 text-sm text-stone-600">{f.pickupWindow(order.bag.pickupStart, order.bag.pickupEnd)}</p>

        <div className="mt-5 flex items-baseline justify-between border-t border-stone-100 pt-4">
          <span className="text-stone-600">{t.total}</span>
          <span className="text-2xl font-bold">{f.price(payment.amount)}</span>
        </div>

        {message ? (
          <div className="mt-6 space-y-3 text-center">
            <p className="rounded-xl bg-stone-100 px-4 py-3 text-stone-700">{message}</p>
            <Link href={`/bags/${order.bagId}`} className="inline-block font-semibold text-brand-dark hover:underline">
              {t.back}
            </Link>
          </div>
        ) : (
          <>
            {order.expiresAt && (
              <p className="mt-4 text-sm text-stone-600">{fill(t.holdNote, { time: f.time(order.expiresAt) })}</p>
            )}
            <form action={testPaySucceed} className="mt-6">
              <input type="hidden" name="paymentId" value={payment.id} />
              <button
                type="submit"
                className="w-full rounded-xl bg-brand px-5 py-3.5 font-semibold text-white hover:bg-brand-dark"
              >
                {fill(t.pay, { amount: f.price(payment.amount) })}
              </button>
            </form>
            <form action={testPayDecline} className="mt-2">
              <input type="hidden" name="paymentId" value={payment.id} />
              <button type="submit" className="w-full rounded-xl px-5 py-3 font-medium text-stone-600 hover:bg-stone-100">
                {t.decline}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
