import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BagCard } from "@/components/BagCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { getI18n } from "@/i18n/server";
import { startOfToday } from "@/i18n/shared";
import { CATEGORY_EMOJI } from "@/lib/categories";
import { runHousekeeping } from "@/lib/housekeeping";
import { prisma } from "@/lib/prisma";
import { nextWindow, parseWeekdays } from "@/lib/schedules";
import { getCurrentUser } from "@/lib/session";
import { cityName } from "@/lib/cities";

export async function generateMetadata({ params }: PageProps<"/stores/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [store, { dict }] = await Promise.all([
    prisma.store.findUnique({ where: { id }, select: { name: true, city: true } }),
    getI18n(),
  ]);
  return { title: store ? `${store.name} · ${cityName(dict.cities, store.city)}` : dict.meta.notFound };
}

// A store's own page: always reachable (even when sold out), so customers can
// see when the next bag comes and add the store to their favourites.
export default async function StorePage({ params }: PageProps<"/stores/[id]">) {
  const { id } = await params;
  await runHousekeeping();
  const [store, user, { dict, f, fill }] = await Promise.all([
    prisma.store.findUnique({
      where: { id },
      include: {
        bags: {
          where: { isActive: true, pickupEnd: { gte: startOfToday() } },
          include: { store: true },
          orderBy: { pickupStart: "asc" },
        },
        schedules: { where: { isActive: true }, orderBy: { startTime: "asc" } },
      },
    }),
    getCurrentUser(),
    getI18n(),
  ]);
  // Stores under review are only visible to their owner and admins.
  if (!store || (store.status !== "APPROVED" && user?.id !== store.ownerId && user?.role !== "ADMIN")) notFound();
  const t = dict.store;

  const now = new Date();
  const available = store.bags.filter((bag) => bag.quantityAvailable > 0 && bag.pickupEnd > now);
  const soldOut = store.bags.filter((bag) => bag.quantityAvailable === 0);
  const hasLocation = store.latitude != null && store.longitude != null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-light text-2xl font-bold text-brand-dark">
            {store.name.charAt(0)}
          </span>
          <div>
            <h1 className="text-3xl font-bold leading-tight">{store.name}</h1>
            <p className="mt-1 text-stone-600">
              {store.address}, {cityName(dict.cities, store.city)}
              {hasLocation && (
                <>
                  {" · "}
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${store.latitude}&mlon=${store.longitude}#map=17/${store.latitude}/${store.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-dark underline underline-offset-2"
                  >
                    {t.onMap}
                  </a>
                </>
              )}
            </p>
            {store.description && <p className="mt-2 max-w-2xl text-stone-700">{store.description}</p>}
          </div>
        </div>
        <FavoriteButton storeId={store.id} back={`/stores/${store.id}`} />
      </div>

      {store.schedules.length > 0 && (
        <section className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
          <h2 className="font-semibold">🔁 {t.regular}</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {store.schedules.map((schedule) => {
              const days = parseWeekdays(schedule.weekdays);
              const next = nextWindow(schedule);
              return (
                <li key={schedule.id}>
                  <span className="font-medium">
                    {CATEGORY_EMOJI[schedule.category]} {schedule.title}
                  </span>
                  <span className="text-stone-600">
                    {" · "}
                    {days.length === 7 ? dict.dashboard.everyDay : days.map((day) => dict.dashboard.weekdays[day - 1]).join(", ")}{" "}
                    {schedule.startTime}–{schedule.endTime} · {f.price(schedule.price)}
                  </span>
                  {next && (
                    <span className="block text-brand-dark">{fill(t.nextBag, { when: f.pickupWindow(next.start, next.end) })}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold">{t.availableNow}</h2>
        {available.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-stone-500">
            {t.noBags}
          </p>
        ) : (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((bag) => (
              <BagCard key={bag.id} bag={bag} />
            ))}
          </div>
        )}
      </section>

      {soldOut.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">{t.soldOutToday}</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {soldOut.map((bag) => (
              <BagCard key={bag.id} bag={bag} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10">
        <Link href="/" className="text-sm font-medium text-stone-600 hover:text-brand-dark">
          {dict.bag.back}
        </Link>
      </p>
    </main>
  );
}
