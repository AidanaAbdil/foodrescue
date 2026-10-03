import Image from "next/image";
import Link from "next/link";
import type { Store, SurpriseBag } from "@/generated/prisma/client";
import { FoodLabels } from "@/components/FoodLabels";
import { RatingBadge } from "@/components/RatingBadge";
import type { StoreRating } from "@/lib/ratings";
import { getI18n } from "@/i18n/server";
import { CATEGORY_DOODLE } from "@/lib/categories";
import { discountPercent } from "@/lib/format";
import { Doodle } from "@/components/Doodle";

type Props = {
  bag: SurpriseBag & { store: Store };
  distance?: number; // km from the customer, when "near me" is on
  rating?: StoreRating; // the store's public rating, if it has one
};

// One surprise bag in the listing grid; the whole card links to its page.
export async function BagCard({ bag, distance, rating }: Props) {
  const { dict, f, plural } = await getI18n();
  const doodle = CATEGORY_DOODLE[bag.category];
  const soldOut = bag.quantityAvailable === 0;
  const fewLeft = bag.quantityAvailable <= 2;

  return (
    <Link
      href={`/bags/${bag.id}`}
      className={`group block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        soldOut ? "opacity-60 grayscale-[60%]" : ""
      }`}
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
          // No photo yet: show the category doodle instead.
          <div className="grid h-full place-items-center text-brand" aria-hidden>
            <Doodle name={doodle} size={96} />
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
          {soldOut ? dict.bag.soldOut : plural(bag.quantityAvailable, fewLeft ? dict.bag.onlyLeft : dict.bag.left)}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-light text-xs font-bold text-brand-dark">
            {bag.store.name.charAt(0)}
          </span>
          <p className="truncate text-sm font-medium text-stone-600">{bag.store.name}</p>
          <RatingBadge rating={rating} />
          {distance !== undefined && (
            <span className="ml-auto shrink-0 text-sm font-medium text-brand-dark">{f.distance(distance)}</span>
          )}
        </div>

        <h3 className="mt-2 text-lg font-semibold leading-snug">{bag.title}</h3>

        <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-500">
          <Doodle name="clock" size={15} />
          {f.pickupWindow(bag.pickupStart, bag.pickupEnd)}
        </p>
        <FoodLabels bag={bag} className="mt-2" />

        <div className="mt-4 flex items-end justify-between border-t border-stone-100 pt-3">
          <span className="text-xs font-medium text-stone-500">
            <Doodle name={doodle} size={14} className="mr-1" /> {dict.categories[bag.category]}
          </span>
          <span className="text-right">
            <span className="block text-xs text-stone-400 line-through">{f.price(bag.originalPrice)}</span>
            <span className="text-xl font-bold text-brand">{f.price(bag.price)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
