import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReserveForm } from "@/components/ReserveForm";
import { getI18n } from "@/i18n/server";
import { CATEGORY_EMOJI } from "@/lib/categories";
import { discountPercent } from "@/lib/format";
import { MAX_PER_ORDER } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, loginUrl } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/bags/[id]">) {
  const { id } = await params;
  const [bag, { dict }] = await Promise.all([
    prisma.surpriseBag.findUnique({ where: { id }, include: { store: true } }),
    getI18n(),
  ]);
  return { title: bag ? `${bag.title} · ${bag.store.name}` : dict.meta.bagNotFound };
}

export default async function BagPage({ params }: PageProps<"/bags/[id]">) {
  const { id } = await params;
  const [bag, user, { dict, f, fill }] = await Promise.all([
    prisma.surpriseBag.findUnique({ where: { id }, include: { store: true } }),
    getCurrentUser(),
    getI18n(),
  ]);
  if (!bag) notFound();

  const t = dict.bag;
  const emoji = CATEGORY_EMOJI[bag.category];
  const available = bag.isActive && bag.quantityAvailable > 0 && bag.pickupEnd > new Date();
  const isOwnStore = user?.id === bag.store.ownerId;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm font-medium text-stone-600 hover:text-brand-dark">
        {t.back}
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-light">
          {bag.imageUrl ? (
            <Image
              src={bag.imageUrl}
              alt={bag.title}
              fill
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center text-8xl" aria-hidden>
              {emoji}
            </div>
          )}
          <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1 text-sm font-bold text-white shadow">
            −{discountPercent(bag.originalPrice, bag.price)}%
          </span>
        </div>

        <div>
          <p className="flex items-center gap-2 font-medium text-stone-600">
            <span className="grid size-8 place-items-center rounded-full bg-brand-light text-sm font-bold text-brand-dark">
              {bag.store.name.charAt(0)}
            </span>
            {bag.store.name}
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">{bag.title}</h1>
          <p className="mt-2 text-sm font-medium text-stone-500">
            {emoji} {dict.categories[bag.category]}
          </p>

          <p className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-brand">{f.price(bag.price)}</span>
            <span className="text-stone-400 line-through">{f.price(bag.originalPrice)}</span>
          </p>

          <dl className="mt-6 space-y-3 rounded-2xl bg-white p-5 text-sm ring-1 ring-stone-200">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">{t.pickup}</dt>
              <dd className="text-right font-medium">{f.pickupWindow(bag.pickupStart, bag.pickupEnd)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">{t.address}</dt>
              <dd className="text-right font-medium">
                {bag.store.address}, {bag.store.city}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-500">{t.available}</dt>
              <dd className="text-right font-medium">
                {available ? fill(t.availableCount, { n: bag.quantityAvailable }) : t.none}
              </dd>
            </div>
          </dl>

          <div className="mt-6">
            {!available ? (
              <p className="rounded-xl bg-stone-100 px-4 py-3 text-center font-medium text-stone-600">
                {t.unavailable}
              </p>
            ) : !user ? (
              <Link
                href={loginUrl(`/bags/${bag.id}`)}
                className="block rounded-xl bg-brand px-5 py-3.5 text-center font-semibold text-white hover:bg-brand-dark"
              >
                {t.loginToReserve}
              </Link>
            ) : isOwnStore ? (
              <p className="rounded-xl bg-stone-100 px-4 py-3 text-center font-medium text-stone-600">
                {t.ownStore}
              </p>
            ) : (
              <ReserveForm
                bagId={bag.id}
                price={bag.price}
                maxQuantity={Math.min(MAX_PER_ORDER, bag.quantityAvailable)}
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
          <h2 className="font-semibold">{t.whatInside}</h2>
          <p className="mt-2 text-sm text-stone-600">
            {bag.description ?? t.defaultDescription} {t.surprise}
          </p>
        </section>
        <section className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
          <h2 className="font-semibold">{fill(t.about, { store: bag.store.name })}</h2>
          <p className="mt-2 text-sm text-stone-600">{bag.store.description ?? t.defaultStoreDescription}</p>
        </section>
      </div>
    </main>
  );
}
