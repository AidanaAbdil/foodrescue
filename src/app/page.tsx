import Link from "next/link";
import { connection } from "next/server";
import { BagCard } from "@/components/BagCard";
import { CATEGORIES, isCategory } from "@/lib/categories";
import { formatPrice } from "@/lib/format";
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

  // The selected filter comes from the URL, e.g. /?category=BAKERY
  const { category } = await searchParams;
  const selected = isCategory(category) ? category : undefined;

  const bags = await prisma.surpriseBag.findMany({
    where: { isActive: true, quantityAvailable: { gt: 0 }, pickupEnd: { gt: new Date() } },
    include: { store: true },
    orderBy: { pickupStart: "asc" },
  });

  const shown = selected ? bags.filter((bag) => bag.category === selected) : bags;
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

      <section className="mx-auto w-full max-w-6xl px-4 pt-10">
        <h2 className="text-2xl font-bold">Available near you</h2>

        {/* Category filter: each chip is a link that changes ?category= in the URL */}
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label="Filter by category">
          <FilterChip href="/" active={!selected}>
            All
          </FilterChip>
          {Object.entries(CATEGORIES).map(([value, { label, emoji }]) => (
            <FilterChip key={value} href={`/?category=${value}`} active={selected === value}>
              {emoji} {label}
            </FilterChip>
          ))}
        </nav>

        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((bag) => (
            <BagCard key={bag.id} bag={bag} />
          ))}
        </div>

        {shown.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white py-16 text-center">
            <p className="text-4xl" aria-hidden>
              🥡
            </p>
            <p className="mt-3 font-semibold">No bags available right now</p>
            <p className="mt-1 text-sm text-stone-500">Check back later, stores add new bags throughout the day.</p>
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
