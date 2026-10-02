import Image from "next/image";
import Link from "next/link";
import type { Store, SurpriseBag } from "@/generated/prisma/client";
import { CATEGORIES } from "@/lib/categories";
import { discountPercent, formatDay, formatPrice, formatTime } from "@/lib/format";

type Props = { bag: SurpriseBag & { store: Store } };

// One surprise bag in the listing grid; the whole card links to its page.
export function BagCard({ bag }: Props) {
  const category = CATEGORIES[bag.category];
  const fewLeft = bag.quantityAvailable <= 2;

  return (
    <Link
      href={`/bags/${bag.id}`}
      className="group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="relative aspect-[16/10] bg-brand-light">
        {bag.imageUrl ? (
          <Image
            src={bag.imageUrl}
            alt={bag.title}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          // No photo yet: show the category emoji instead.
          <div className="grid h-full place-items-center text-6xl" aria-hidden>
            {category.emoji}
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white shadow">
          −{discountPercent(bag.originalPrice, bag.price)}%
        </span>
        <span
          className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow ${
            fewLeft ? "bg-stone-800 text-white" : "bg-white/95 text-stone-700"
          }`}
        >
          {fewLeft ? `Only ${bag.quantityAvailable} left` : `${bag.quantityAvailable} left`}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-light text-xs font-bold text-brand-dark">
            {bag.store.name.charAt(0)}
          </span>
          <p className="truncate text-sm font-medium text-stone-600">{bag.store.name}</p>
        </div>

        <h3 className="mt-2 text-lg font-semibold leading-snug">{bag.title}</h3>

        <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          {formatDay(bag.pickupStart)} {formatTime(bag.pickupStart)}–{formatTime(bag.pickupEnd)}
        </p>

        <div className="mt-4 flex items-end justify-between border-t border-stone-100 pt-3">
          <span className="text-xs font-medium text-stone-500">
            {category.emoji} {category.label}
          </span>
          <span className="text-right">
            <span className="block text-xs text-stone-400 line-through">{formatPrice(bag.originalPrice)}</span>
            <span className="text-xl font-bold text-brand">{formatPrice(bag.price)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
