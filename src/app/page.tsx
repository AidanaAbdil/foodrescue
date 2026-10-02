import Link from "next/link";
import { connection } from "next/server";
import { BagCard } from "@/components/BagCard";
import { NearMeButton } from "@/components/search/NearMeButton";
import { CATEGORIES, isCategory } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
import { distanceMiles, parseCoords } from "@/lib/geo";
import { prisma } from "@/lib/prisma";

const STEPS = [
  { emoji: "🔍", title: "Find a bag", text: "Browse surprise bags from bakeries, cafés and shops near you." },
  { emoji: "📱", title: "Reserve it", text: "Pay a fraction of the price and get a pickup code." },
  { emoji: "🛍️", title: "Pick it up", text: "Show your code at the store during the pickup window. Enjoy!" },
];

// This is a Server Component: it runs on the server, so it can query the
// database directly. No API route needed.
export default async function Home({ searchParams }: PageProps<"/">) {
  // Render on every request so the list is always fresh.
  await connection();

  // All filters live in the URL, e.g. /?q=bread&city=Springfield&category=BAKERY&near=39.8,-89.6
  // so they survive a refresh and can be shared as a link.
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const city = typeof params.city === "string" ? params.city : "";
  const selected = isCategory(params.category) ? params.category : undefined;
  const near = parseCoords(params.near);

  const bags = await prisma.surpriseBag.findMany({
    where: { isActive: true, quantityAvailable: { gt: 0 }, pickupEnd: { gt: new Date() } },
    include: { store: true },
    orderBy: { pickupStart: "asc" },
  });
  const cities = [...new Set(bags.map((bag) => bag.store.city))].sort();

  // Filtering in JavaScript is fine at this size (a few hundred bags). With
  // thousands we'd move these conditions into the database query instead.
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = bags
    .filter((bag) => !selected || bag.category === selected)
    .filter((bag) => !city || bag.store.city === city)
    .filter((bag) => {
      const text = `${bag.title} ${bag.description ?? ""} ${bag.store.name}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .map((bag) => ({
      bag,
      distance:
        near && bag.store.latitude != null && bag.store.longitude != null
          ? distanceMiles(near, { lat: bag.store.latitude, lng: bag.store.longitude })
          : undefined,
    }));
  // Nearest first; stores without a location go last.
  if (near) shown.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

  // Build a link to this page with some filters changed (undefined = remove).
  const current = { q, city, category: selected, near: params.near as string | undefined };
  const hrefWith = (changes: Partial<typeof current>) => {
    const merged = { ...current, ...changes };
    const query = new URLSearchParams(
      Object.entries(merged).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    return query ? `/?${query}` : "/";
  };
  const isFiltered = Boolean(q || city || selected);

  const totalSavings = bags.reduce(
    (sum, bag) => sum + (bag.originalPrice - bag.price) * bag.quantityAvailable,
    0,
  );

  return (
    <main>
      {/* Hero banner */}
      <section className="bg-brand text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest text-white">Save food · Save money</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            Rescue delicious food before it goes to waste.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white">
            Local stores sell their unsold food in surprise bags at up to 70% off. You save money, they cut waste.
          </p>
          <dl className="mt-8 flex flex-wrap gap-4">
            <div className="rounded-xl bg-black/15 px-5 py-3">
              <dt className="text-sm text-white">Bags available now</dt>
              <dd className="text-2xl font-bold">{bags.length}</dd>
            </div>
            <div className="rounded-xl bg-black/15 px-5 py-3">
              <dt className="text-sm text-white">Up for grabs in savings</dt>
              <dd className="text-2xl font-bold">{formatPrice(totalSavings)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="browse" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-10">
        <h2 className="text-2xl font-bold">{near ? "Closest to you" : "Available now"}</h2>

        {/* A plain GET form: submitting it just updates the URL's ?q= and ?city=. */}
        <form action="/#browse" className="mt-4 flex flex-col gap-3 sm:flex-row">
          {selected && <input type="hidden" name="category" value={selected} />}
          {near && <input type="hidden" name="near" value={current.near} />}
          <label className="relative flex-1">
            <span className="sr-only">Search bags and stores</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input type="search" name="q" defaultValue={q} placeholder="Search bread, pizza, a store…"
              className="w-full rounded-lg border border-stone-300 bg-white py-2.5 pl-10 pr-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand-light" />
          </label>
          <label className="sm:w-48">
            <span className="sr-only">City</span>
            <select name="city" defaultValue={city}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 outline-none focus:border-brand focus:ring-2 focus:ring-brand-light">
              <option value="">All cities</option>
              {cities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark">
            Search
          </button>
        </form>

        <div className="mt-3">
          <NearMeButton active={Boolean(near)} hrefWithout={hrefWith({ near: undefined })} />
        </div>

        {/* Category filter: each chip is a link that changes ?category= in the URL */}
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Filter by category">
          <FilterChip href={hrefWith({ category: undefined })} active={!selected}>
            All
          </FilterChip>
          {Object.entries(CATEGORIES).map(([value, { label, emoji }]) => (
            <FilterChip key={value} href={hrefWith({ category: value as typeof selected })} active={selected === value}>
              {emoji} {label}
            </FilterChip>
          ))}
        </nav>

        {isFiltered && (
          <p className="mt-2 text-sm text-stone-600">
            {shown.length} {shown.length === 1 ? "bag" : "bags"} found{" "}
            <Link href={hrefWith({ q: undefined, city: undefined, category: undefined })} scroll={false}
              className="font-medium text-brand-dark underline underline-offset-2">
              Clear filters
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
            {isFiltered ? (
              <>
                <p className="mt-3 font-semibold">No bags match your search</p>
                <p className="mt-1 text-sm text-stone-500">Try another word, city or category.</p>
              </>
            ) : (
              <>
                <p className="mt-3 font-semibold">No bags available right now</p>
                <p className="mt-1 text-sm text-stone-500">Check back later, stores add new bags throughout the day.</p>
              </>
            )}
          </div>
        )}
      </section>

      <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pt-16">
        <h2 className="text-2xl font-bold">How it works</h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
              <span className="text-3xl" aria-hidden>
                {step.emoji}
              </span>
              <h3 className="mt-3 font-semibold">
                {i + 1}. {step.title}
              </h3>
              <p className="mt-1 text-sm text-stone-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
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
