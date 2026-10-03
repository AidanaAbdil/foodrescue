import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BagCard } from "@/components/BagCard";
import { PushToggle } from "@/components/PushToggle";
import { pushPublicKey } from "@/lib/push";
import { getI18n } from "@/i18n/server";
import { runHousekeeping } from "@/lib/housekeeping";
import { prisma } from "@/lib/prisma";
import { nextWindow } from "@/lib/schedules";
import { requireUser } from "@/lib/session";
import { cityName } from "@/lib/cities";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.favorites };
}

// The customer's favourite stores, with what's on sale now or when the next bag comes.
export default async function FavoritesPage() {
  const user = await requireUser("/favorites");
  if (user.role !== "CUSTOMER") redirect("/");
  await runHousekeeping();
  const { dict, f, fill } = await getI18n();
  const t = dict.favorites;
  const now = new Date();

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id, store: { status: "APPROVED" } },
    orderBy: { createdAt: "desc" },
    include: {
      store: {
        include: {
          bags: {
            where: { isActive: true, quantityAvailable: { gt: 0 }, pickupEnd: { gt: now } },
            include: { store: true },
            orderBy: { pickupStart: "asc" },
          },
          schedules: { where: { isActive: true } },
        },
      },
    },
  });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">♥ {t.title}</h1>
        {/* "❤️ New bag" alerts from these stores (src/lib/push.ts, notifyFavoritesAboutBag). */}
        <PushToggle publicKey={pushPublicKey()} hint={dict.push.favoritesHint} />
      </div>
      {favorites.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white px-4 py-12 text-center text-stone-600">
          {t.empty}
        </p>
      ) : (
        <div className="mt-6 space-y-10">
          {favorites.map(({ store }) => {
            // The soonest upcoming bag from any of the store's regular bags.
            const next = store.schedules
              .map((schedule) => nextWindow(schedule))
              .filter((window) => window !== null)
              .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
            return (
              <section key={store.id}>
                <Link href={`/stores/${store.id}`} className="group inline-flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand-light font-bold text-brand-dark">
                    {store.name.charAt(0)}
                  </span>
                  <span>
                    <span className="block text-lg font-semibold group-hover:underline">{store.name}</span>
                    <span className="block text-sm text-stone-500">
                      {store.address}, {cityName(dict.cities, store.city)}
                    </span>
                  </span>
                </Link>
                {store.bags.length > 0 ? (
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {store.bags.map((bag) => (
                      <BagCard key={bag.id} bag={bag} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-stone-600">
                    {t.nothingNow}{" "}
                    {next && (
                      <span className="font-medium text-brand-dark">
                        {fill(dict.store.nextBag, { when: f.pickupWindow(next.start, next.end) })}
                      </span>
                    )}
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
