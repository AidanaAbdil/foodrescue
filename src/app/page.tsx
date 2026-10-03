import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { BagCard } from "@/components/BagCard";
import { InstallHint } from "@/components/InstallHint";
import { RatingBadge } from "@/components/RatingBadge";
import { publicRatings } from "@/lib/ratings";
import { communityBagsRescued } from "@/lib/impact";
import { AutoSubmitSelect } from "@/components/search/AutoSubmitSelect";
import { NearMeButton } from "@/components/search/NearMeButton";
import { ResultsMapLoader } from "@/components/search/ResultsMapLoader";
import type { MapPlace } from "@/components/search/ResultsMap";
import { StatCard } from "@/components/StatCard";
import { getI18n } from "@/i18n/server";
import { CATEGORY_EMOJI, CATEGORY_LIST, isCategory } from "@/lib/categories";
import { CITIES, CITY_LIST, cityName, isCity } from "@/lib/cities";
import { distanceKm, parseCoords } from "@/lib/geo";
import { nextWindow } from "@/lib/schedules";
import { runHousekeeping } from "@/lib/housekeeping";
import { prisma } from "@/lib/prisma";
import { searchWords } from "@/lib/search";
import type { Store, SurpriseBag } from "@/generated/prisma/client";

const STEP_EMOJI = ["🔍", "📱", "🛍️"];
const PAGE_SIZE = 12; // "Show more" adds this many each time
const MAX_SHOWN = 240;
const MAX_NEAR = 500; // "near me" sorts this many of the matches by distance

type Tab = "bags" | "stores";

// This is a Server Component: it runs on the server, so it can query the
// database directly. No API route needed.
export default async function Home({ searchParams }: PageProps<"/">) {
  // Render on every request so the list is always fresh.
  await connection();
  const { dict, f, fill, plural } = await getI18n();
  const t = dict.home;

  // All filters live in the URL, e.g. /?tab=stores&q=абая&city=ALMATY&near=43.24,76.95
  // so they survive a refresh and can be shared as a link.
  const params = await searchParams;
  const tab: Tab = params.tab === "stores" ? "stores" : "bags";
  const view = params.view === "map" ? "map" : "list"; // ?view=map shows the results on a map
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const city = isCity(params.city) ? params.city : "";
  const selected = isCategory(params.category) ? params.category : undefined;
  const near = parseCoords(params.near);
  // Food label filters: ?halal=1, ?veg=1 (vegetarian, incl. vegan), ?vegan=1
  const halal = params.halal === "1";
  const veg = params.veg === "1";
  const vegan = params.vegan === "1";
  // How many results to show: 12, then 24, 36… with "Show more".
  const show = Math.min(MAX_SHOWN, Math.max(PAGE_SIZE, Math.ceil(Number(params.show) / PAGE_SIZE) * PAGE_SIZE || PAGE_SIZE));
  await runHousekeeping(); // bags held by unpaid orders past their deadline go back on sale

  // Every filter runs inside the database, so this stays fast with thousands
  // of bags. Search words must each appear in the bag's or its store's text.
  const now = new Date();
  const words = searchWords(q);
  const storeWhere = { status: "APPROVED" as const, ...(city && { city }) }; // stores under review stay hidden
  const bagWhere = {
    isActive: true,
    pickupEnd: { gt: now },
    store: storeWhere,
    ...(tab === "bags" && selected && { category: selected }),
    ...(tab === "bags" && halal && { isHalal: true }),
    ...(tab === "bags" && veg && { isVegetarian: true }),
    ...(tab === "bags" && vegan && { isVegan: true }),
    ...(tab === "bags" && {
      AND: words.map((word) => ({
        OR: [{ searchText: { contains: word } }, { store: { searchText: { contains: word } } }],
      })),
    }),
  };
  const available = { ...bagWhere, quantityAvailable: { gt: 0 } };
  const storeSearch = {
    ...storeWhere,
    ...(tab === "stores" && { AND: words.map((word) => ({ searchText: { contains: word } })) }),
  };
  // Stores with something on sale right now come first in the store list.
  const liveBag = { isActive: true, quantityAvailable: { gt: 0 }, pickupEnd: { gt: now } };

  const [bagTotal, storeTotal, heroBags, rescued] = await Promise.all([
    prisma.surpriseBag.count({ where: available }),
    prisma.store.count({ where: storeSearch }),
    // The hero's "N bags · save X" numbers cover everything on sale.
    prisma.surpriseBag.findMany({
      where: { isActive: true, quantityAvailable: { gt: 0 }, pickupEnd: { gt: now }, store: { status: "APPROVED" } },
      select: { price: true, originalPrice: true, quantityAvailable: true },
    }),
    communityBagsRescued(),
  ]);
  const totalSavings = heroBags.reduce((sum, bag) => sum + (bag.originalPrice - bag.price) * bag.quantityAvailable, 0);

  const withDistance = <T extends { latitude: number | null; longitude: number | null }>(place: T) =>
    near && place.latitude != null && place.longitude != null
      ? distanceKm(near, { lat: place.latitude, lng: place.longitude })
      : undefined;
  // Nearest first; places without a location go last.
  const byDistance = (a: { distance?: number }, b: { distance?: number }) =>
    (a.distance ?? Infinity) - (b.distance ?? Infinity);

  // ── Bags tab ──
  let shown: { bag: SurpriseBag & { store: Store }; distance?: number }[] = [];
  let soldOut: (SurpriseBag & { store: Store })[] = [];
  if (tab === "bags" && view === "list") {
    const bags = await prisma.surpriseBag.findMany({
      where: available,
      include: { store: true },
      orderBy: { pickupStart: "asc" },
      take: near ? MAX_NEAR : show,
    });
    shown = bags.map((bag) => ({ bag, distance: withDistance(bag.store) }));
    if (near) shown = shown.sort(byDistance).slice(0, show);
    // Today's bags that already sold out stay visible (greyed) once the list
    // is fully shown, so customers still find the store and can favourite it.
    if (shown.length >= bagTotal) {
      soldOut = await prisma.surpriseBag.findMany({
        where: { ...bagWhere, quantityAvailable: 0 },
        include: { store: true },
        orderBy: { pickupStart: "asc" },
        take: PAGE_SIZE,
      });
    }
  }

  // ── Stores tab ──
  // Every live store, including those with nothing on sale right now.
  let directory: { store: Store; onSale: number; next?: { start: Date; end: Date }; distance?: number }[] = [];
  if (tab === "stores" && view === "list") {
    const include = { _count: { select: { bags: { where: liveBag } } }, schedules: { where: { isActive: true } } };
    let stores;
    if (near) {
      stores = await prisma.store.findMany({ where: storeSearch, include, take: MAX_NEAR });
    } else {
      // Stores with bags on sale first (A–Z), then the rest (A–Z).
      const withBags = { ...storeSearch, bags: { some: liveBag } };
      const first = await prisma.store.findMany({ where: withBags, include, orderBy: { name: "asc" }, take: show });
      const rest =
        first.length < show
          ? await prisma.store.findMany({
              where: { ...storeSearch, bags: { none: liveBag } },
              include,
              orderBy: { name: "asc" },
              take: show - first.length,
            })
          : [];
      stores = [...first, ...rest];
    }
    directory = stores.map((store) => ({
      store,
      onSale: store._count.bags,
      next: store.schedules
        .map((schedule) => nextWindow(schedule))
        .filter((window) => window !== null)
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0],
      distance: withDistance(store),
    }));
    if (near) directory = directory.sort(byDistance).slice(0, show);
  }

  // ── Map view: one pin per store, with the same filters ──
  const places: MapPlace[] = [];
  let notOnMap = 0; // stores without a map point
  if (view === "map") {
    const pins: { id: string; name: string; lat: number | null; lng: number | null; count: number; minPrice?: number }[] = [];
    if (tab === "bags") {
      const bags = await prisma.surpriseBag.findMany({
        where: available,
        select: { storeId: true, price: true, store: { select: { name: true, latitude: true, longitude: true } } },
        take: 2000,
      });
      const byStore = new Map<string, (typeof pins)[number]>();
      for (const bag of bags) {
        const pin = byStore.get(bag.storeId) ?? { id: bag.storeId, name: bag.store.name, lat: bag.store.latitude, lng: bag.store.longitude, count: 0, minPrice: bag.price };
        pin.count += 1;
        pin.minPrice = Math.min(pin.minPrice!, bag.price);
        byStore.set(bag.storeId, pin);
      }
      pins.push(...byStore.values());
    } else {
      const stores = await prisma.store.findMany({
        where: storeSearch,
        select: { id: true, name: true, latitude: true, longitude: true, _count: { select: { bags: { where: liveBag } } } },
        take: 1000,
      });
      pins.push(...stores.map((store) => ({ id: store.id, name: store.name, lat: store.latitude, lng: store.longitude, count: store._count.bags })));
    }
    for (const pin of pins) {
      if (pin.lat == null || pin.lng == null) {
        notOnMap += 1;
        continue;
      }
      const onSale = pin.count > 0 ? plural(pin.count, t.onSale) : t.noBagsNow;
      places.push({
        id: pin.id,
        name: pin.name,
        lat: pin.lat,
        lng: pin.lng,
        count: pin.count,
        label: pin.minPrice !== undefined ? `${onSale} · ${fill(t.fromPrice, { price: f.price(pin.minPrice) })}` : onSale,
        href: `/stores/${pin.id}`,
      });
    }
  }

  // "★ 4.6 (12)" for stores with enough ratings.
  const ratings = await publicRatings([
    ...shown.map(({ bag }) => bag.storeId),
    ...soldOut.map((bag) => bag.storeId),
    ...directory.map(({ store }) => store.id),
  ]);

  // Build a link to this page with some filters changed (undefined = remove).
  const current = {
    tab: tab === "stores" ? "stores" : undefined,
    view: view === "map" ? "map" : undefined,
    q,
    city,
    category: selected,
    near: params.near as string | undefined,
    halal: halal ? "1" : undefined,
    veg: veg ? "1" : undefined,
    vegan: vegan ? "1" : undefined,
    show: undefined as string | undefined, // any other change starts again from the first page
  };
  const hrefWith = (changes: Partial<typeof current>) => {
    const merged = { ...current, ...changes };
    const query = new URLSearchParams(
      Object.entries(merged).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return query ? `/?${query}` : "/";
  };
  const isFiltered = Boolean(q || city || (tab === "bags" && (selected || halal || veg || vegan)));
  const total = tab === "bags" ? bagTotal : storeTotal;
  const shownCount = view === "map" ? places.length + notOnMap : tab === "bags" ? shown.length : directory.length;

  return (
    <main>
      {/* Hero banner */}
      <section className="bg-brand text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-white">{t.eyebrow}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">{t.title}</h1>
          <p className="mt-4 max-w-xl text-lg text-white">{t.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <StatCard variant="onBrand" template={t.statBags} value={heroBags.length} />
            <StatCard variant="onBrand" template={t.statSavings} value={f.price(totalSavings)} />
            {rescued > 0 && <StatCard variant="onBrand" template={dict.impact.community} value={rescued} />}
          </div>
        </div>
      </section>

      <section id="browse" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-10">
        <h2 className="sr-only">{near ? t.closest : t.availableNow}</h2>

        <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Bags | Stores. The search below only searches the open tab. */}
        <nav className="inline-flex rounded-xl bg-stone-200/70 p-1" aria-label={t.searchLabel}>
          {(["bags", "stores"] as const).map((value) => (
            <Link
              key={value}
              href={hrefWith({ tab: value === "stores" ? "stores" : undefined })}
              scroll={false}
              aria-current={tab === value ? "page" : undefined}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                tab === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {value === "bags" ? t.tabBags : t.tabStores}{" "}
              <span className="font-normal text-stone-500">{value === "bags" ? bagTotal : storeTotal}</span>
            </Link>
          ))}
        </nav>
        {/* List | Map */}
        <nav className="inline-flex rounded-xl bg-stone-200/70 p-1 text-sm font-semibold" aria-label={t.viewMap}>
          {(["list", "map"] as const).map((value) => (
            <Link
              key={value}
              href={hrefWith({ view: value === "map" ? "map" : undefined })}
              scroll={false}
              aria-current={view === value ? "page" : undefined}
              className={`rounded-lg px-4 py-2 transition ${view === value ? "bg-white text-stone-900 shadow-sm" : "text-stone-600 hover:text-stone-900"}`}
            >
              {value === "list" ? t.viewList : t.viewMap}
            </Link>
          ))}
        </nav>
        </div>

        {/* A GET form: it updates the URL (?q=…&city=…) without reloading the page. */}
        <Form action="/" scroll={false} className="mt-4 flex flex-col gap-3 sm:flex-row">
          {tab === "stores" && <input type="hidden" name="tab" value="stores" />}
          {view === "map" && <input type="hidden" name="view" value="map" />}
          {tab === "bags" && selected && <input type="hidden" name="category" value={selected} />}
          {tab === "bags" && halal && <input type="hidden" name="halal" value="1" />}
          {tab === "bags" && veg && <input type="hidden" name="veg" value="1" />}
          {tab === "bags" && vegan && <input type="hidden" name="vegan" value="1" />}
          {near && <input type="hidden" name="near" value={current.near} />}
          <label className="relative flex-1">
            <span className="sr-only">{t.searchLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input type="search" name="q" defaultValue={q} placeholder={tab === "bags" ? t.searchPlaceholder : t.searchStoresPlaceholder}
              className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-10 pr-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand-light" />
          </label>
          <label className="sm:w-48">
            <span className="sr-only">{t.cityLabel}</span>
            <AutoSubmitSelect name="city" defaultValue={city}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand-light">
              <option value="">{t.allCities}</option>
              {CITY_LIST.map((code) => (
                <option key={code} value={code}>
                  {dict.cities[code]}
                </option>
              ))}
            </AutoSubmitSelect>
          </label>
          <button type="submit" className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark">
            {t.search}
          </button>
        </Form>

        <div className="mt-3">
          <NearMeButton active={Boolean(near)} hrefWithout={hrefWith({ near: undefined })} />
        </div>

        {tab === "bags" && (
          <>
            {/* Category filter: each chip is a link that changes ?category= in the URL */}
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label={t.filterLabel}>
              <FilterChip href={hrefWith({ category: undefined })} active={!selected}>
                {t.all}
              </FilterChip>
              {CATEGORY_LIST.map((value) => (
                <FilterChip key={value} href={hrefWith({ category: value })} active={selected === value}>
                  {CATEGORY_EMOJI[value]} {dict.categories[value]}
                </FilterChip>
              ))}
            </nav>

            {/* Food label filters: each chip switches its filter on or off. */}
            <nav className="mt-1 flex gap-2 overflow-x-auto pb-2" aria-label={dict.labels.title}>
              <FilterChip href={hrefWith({ halal: halal ? undefined : "1" })} active={halal}>
                {dict.labels.halal}
              </FilterChip>
              <FilterChip href={hrefWith({ veg: veg ? undefined : "1" })} active={veg}>
                🌱 {dict.labels.vegetarian}
              </FilterChip>
              <FilterChip href={hrefWith({ vegan: vegan ? undefined : "1" })} active={vegan}>
                🌱 {dict.labels.vegan}
              </FilterChip>
            </nav>
          </>
        )}
        {tab === "stores" && <p className="mt-4 text-sm text-stone-500">{t.storesHint}</p>}

        {isFiltered && (
          <p className="mt-2 text-sm text-stone-600">
            {plural(total, tab === "bags" ? t.found : t.storesFound)}{" "}
            <Link href={hrefWith({ q: undefined, city: undefined, category: undefined, halal: undefined, veg: undefined, vegan: undefined })} scroll={false}
              className="font-medium text-brand-dark underline underline-offset-2">
              {t.clearFilters}
            </Link>
          </p>
        )}

        {view === "map" && shownCount > 0 && (
          <div className="mt-6">
            <ResultsMapLoader places={places} center={city ? CITIES[city] : null} me={near}
              labels={{ open: t.openStore, you: t.youAreHere }} />
            {notOnMap > 0 && <p className="mt-2 text-sm text-stone-500">{fill(t.notOnMap, { n: notOnMap })}</p>}
          </div>
        )}

        {tab === "bags" && view === "list" && (
          <>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map(({ bag, distance }) => (
                <BagCard key={bag.id} bag={bag} distance={distance} rating={ratings.get(bag.storeId)} />
              ))}
            </div>

            <ShowMore shown={shownCount} total={total} href={hrefWith({ show: String(show + PAGE_SIZE) })} label={t.showMore}
              status={fill(t.shownOf, { shown: shownCount, total })} />

            {soldOut.length > 0 && (
              <div className="mt-10">
                <h3 className="text-lg font-semibold">{t.soldOutTitle}</h3>
                <p className="text-sm text-stone-500">{t.soldOutHint}</p>
                <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {soldOut.map((bag) => (
                    <BagCard key={bag.id} bag={bag} rating={ratings.get(bag.storeId)} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "stores" && view === "list" && (
          <>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {directory.map(({ store, onSale, next, distance }) => (
                <li key={store.id}>
                  <Link
                    href={`/stores/${store.id}`}
                    className="flex h-full items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-stone-200 transition hover:ring-brand"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-light font-bold text-brand-dark">
                      {store.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold">{store.name}</span>
                        <RatingBadge rating={ratings.get(store.id)} className="mr-auto" />
                        {distance !== undefined && (
                          <span className="shrink-0 text-sm text-brand-dark">{f.distance(distance)}</span>
                        )}
                      </span>
                      <span className="block truncate text-sm text-stone-500">
                        {store.address}, {cityName(dict.cities, store.city)}
                      </span>
                      <span className={`mt-1 block text-sm font-medium ${onSale > 0 ? "text-accent" : "text-stone-500"}`}>
                        {onSale > 0
                          ? plural(onSale, t.onSale)
                          : next
                            ? fill(dict.store.nextBag, { when: f.pickupWindow(next.start, next.end) })
                            : t.noBagsNow}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <ShowMore shown={shownCount} total={total} href={hrefWith({ show: String(show + PAGE_SIZE) })} label={t.showMore}
              status={fill(t.shownOf, { shown: shownCount, total })} />
          </>
        )}

        {shownCount === 0 && soldOut.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
            <p className="text-4xl" aria-hidden>
              {tab === "bags" ? "🥡" : "🏪"}
            </p>
            <p className="mt-3 font-semibold">
              {tab === "stores" ? t.noStoresTitle : isFiltered ? t.noMatchTitle : t.emptyTitle}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {tab === "stores" ? t.noStoresText : isFiltered ? t.noMatchText : t.emptyText}
            </p>
          </div>
        )}
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-16">
        <h2 className="text-2xl font-bold">{t.howTitle}</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* For customers */}
          <div className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
            <h3 className="text-lg font-semibold text-brand-dark">{t.forCustomers}</h3>
            <ol className="mt-4 space-y-4">
              {t.steps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="text-3xl" aria-hidden>{STEP_EMOJI[i]}</span>
                  <span>
                    <span className="block font-semibold">{i + 1}. {step.title}</span>
                    <span className="block text-sm text-stone-600">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {/* For businesses */}
          <div className="rounded-2xl bg-brand-light/60 p-6 ring-1 ring-accent/20">
            <h3 className="text-lg font-semibold text-brand-dark">{t.forPartners}</h3>
            <ol className="mt-4 space-y-4">
              {t.partnerSteps.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent font-bold text-white" aria-hidden>{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{step.title}</span>
                    <span className="block text-sm text-stone-600">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Link href="/partners" className="mt-5 inline-block rounded-xl bg-accent px-5 py-2.5 font-semibold text-white hover:opacity-90">
              {t.becomePartner}
            </Link>
          </div>
        </div>
      </section>

      <InstallHint />
    </main>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-brand text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-100"
      }`}
    >
      {children}
    </Link>
  );
}

// "Showing 12 of 40 · Show more": a link that asks for the next page too.
function ShowMore({ shown, total, href, label, status }: { shown: number; total: number; href: string; label: string; status: string }) {
  if (shown >= total || shown === 0) return null;
  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <Link
        href={href}
        scroll={false}
        className="rounded-xl bg-white px-6 py-2.5 font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50"
      >
        {label}
      </Link>
      <p className="text-sm text-stone-500">{status}</p>
    </div>
  );
}
