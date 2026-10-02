import Link from "next/link";
import { connection } from "next/server";
import { BagCard } from "@/components/BagCard";
import { InstallHint } from "@/components/InstallHint";
import { NearMeButton } from "@/components/search/NearMeButton";
import { StatCard } from "@/components/StatCard";
import { getI18n } from "@/i18n/server";
import { CATEGORY_EMOJI, CATEGORY_LIST, isCategory } from "@/lib/categories";
import { distanceKm, parseCoords } from "@/lib/geo";
import { runHousekeeping } from "@/lib/housekeeping";
import { prisma } from "@/lib/prisma";

const STEP_EMOJI = ["🔍", "📱", "🛍️"];

// Lowercase and treat ё as е, so "ещё" matches "еще".
const normalize = (text: string) => text.toLowerCase().replaceAll("ё", "е");

// This is a Server Component: it runs on the server, so it can query the
// database directly. No API route needed.
export default async function Home({ searchParams }: PageProps<"/">) {
  // Render on every request so the list is always fresh.
  await connection();
  const { dict, f, plural } = await getI18n();
  const t = dict.home;

  // All filters live in the URL, e.g. /?q=хлеб&city=Алматы&category=BAKERY&near=43.24,76.95
  // so they survive a refresh and can be shared as a link.
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const city = typeof params.city === "string" ? params.city : "";
  const selected = isCategory(params.category) ? params.category : undefined;
  const near = parseCoords(params.near);
  // Food label filters: ?halal=1, ?veg=1 (vegetarian, incl. vegan), ?vegan=1
  const halal = params.halal === "1";
  const veg = params.veg === "1";
  const vegan = params.vegan === "1";
  await runHousekeeping(); // bags held by unpaid orders past their deadline go back on sale

  const bags = await prisma.surpriseBag.findMany({
    where: {
      isActive: true,
      quantityAvailable: { gt: 0 },
      pickupEnd: { gt: new Date() },
      store: { status: "APPROVED" }, // stores under review stay hidden
    },
    include: { store: true },
    orderBy: { pickupStart: "asc" },
  });
  const cities = [...new Set(bags.map((bag) => bag.store.city))].sort((a, b) => a.localeCompare(b));

  // Filtering in JavaScript is fine at this size (a few hundred bags). With
  // thousands we'd move these conditions into the database query instead.
  const words = normalize(q).split(/\s+/).filter(Boolean);
  const shown = bags
    .filter((bag) => !selected || bag.category === selected)
    .filter((bag) => !city || bag.store.city === city)
    .filter((bag) => (!halal || bag.isHalal) && (!veg || bag.isVegetarian) && (!vegan || bag.isVegan))
    .filter((bag) => {
      const text = normalize(`${bag.title} ${bag.description ?? ""} ${bag.store.name}`);
      return words.every((word) => text.includes(word));
    })
    .map((bag) => ({
      bag,
      distance:
        near && bag.store.latitude != null && bag.store.longitude != null
          ? distanceKm(near, { lat: bag.store.latitude, lng: bag.store.longitude })
          : undefined,
    }));
  // Nearest first; stores without a location go last.
  if (near) shown.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  // Build a link to this page with some filters changed (undefined = remove).
  const current = {
    q,
    city,
    category: selected,
    near: params.near as string | undefined,
    halal: halal ? "1" : undefined,
    veg: veg ? "1" : undefined,
    vegan: vegan ? "1" : undefined,
  };
  const hrefWith = (changes: Partial<typeof current>) => {
    const merged = { ...current, ...changes };
    const query = new URLSearchParams(
      Object.entries(merged).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return query ? `/?${query}` : "/";
  };
  const isFiltered = Boolean(q || city || selected || halal || veg || vegan);

  const totalSavings = bags.reduce(
    (sum, bag) => sum + (bag.originalPrice - bag.price) * bag.quantityAvailable,
    0,
  );

  return (
    <main>
      {/* Hero banner */}
      <section className="bg-brand text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-white">{t.eyebrow}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">{t.title}</h1>
          <p className="mt-4 max-w-xl text-lg text-white">{t.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            <StatCard variant="onBrand" template={t.statBags} value={bags.length} />
            <StatCard variant="onBrand" template={t.statSavings} value={f.price(totalSavings)} />
          </div>
        </div>
      </section>

      <section id="browse" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-10">
        <h2 className="text-2xl font-bold">{near ? t.closest : t.availableNow}</h2>

        {/* A plain GET form: submitting it just updates the URL's ?q= and ?city=. */}
        <form action="/#browse" className="mt-4 flex flex-col gap-3 sm:flex-row">
          {selected && <input type="hidden" name="category" value={selected} />}
          {halal && <input type="hidden" name="halal" value="1" />}
          {veg && <input type="hidden" name="veg" value="1" />}
          {vegan && <input type="hidden" name="vegan" value="1" />}
          {near && <input type="hidden" name="near" value={current.near} />}
          <label className="relative flex-1">
            <span className="sr-only">{t.searchLabel}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input type="search" name="q" defaultValue={q} placeholder={t.searchPlaceholder}
              className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-10 pr-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand-light" />
          </label>
          <label className="sm:w-48">
            <span className="sr-only">{t.cityLabel}</span>
            <select name="city" defaultValue={city}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand-light">
              <option value="">{t.allCities}</option>
              {cities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark">
            {t.search}
          </button>
        </form>

        <div className="mt-3">
          <NearMeButton active={Boolean(near)} hrefWithout={hrefWith({ near: undefined })} />
        </div>

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

        {isFiltered && (
          <p className="mt-2 text-sm text-stone-600">
            {plural(shown.length, t.found)}{" "}
            <Link href={hrefWith({ q: undefined, city: undefined, category: undefined, halal: undefined, veg: undefined, vegan: undefined })} scroll={false}
              className="font-medium text-brand-dark underline underline-offset-2">
              {t.clearFilters}
            </Link>
          </p>
        )}

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(({ bag, distance }) => (
            <BagCard key={bag.id} bag={bag} distance={distance} />
          ))}
        </div>

        {shown.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
            <p className="text-4xl" aria-hidden>
              🥡
            </p>
            <p className="mt-3 font-semibold">{isFiltered ? t.noMatchTitle : t.emptyTitle}</p>
            <p className="mt-1 text-sm text-stone-500">{isFiltered ? t.noMatchText : t.emptyText}</p>
          </div>
        )}
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-16">
        <h2 className="text-2xl font-bold">{t.howTitle}</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {t.steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <span className="text-3xl" aria-hidden>
                {STEP_EMOJI[i]}
              </span>
              <h3 className="mt-3 font-semibold">
                {i + 1}. {step.title}
              </h3>
              <p className="mt-1 text-sm text-stone-600">{step.text}</p>
            </li>
          ))}
        </ol>
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
