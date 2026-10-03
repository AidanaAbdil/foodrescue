import { getI18n } from "@/i18n/server";
import type { StoreRating } from "@/lib/ratings";

// "★ 4.6 (12)" next to a store's name.
export async function RatingBadge({ rating, className = "" }: { rating?: StoreRating; className?: string }) {
  if (!rating) return null;
  const { dict, plural, locale } = await getI18n();
  const value = rating.average.toLocaleString(locale === "en" ? "en" : "ru", { minimumFractionDigits: 1 });
  return (
    <span className={`inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-stone-700 ${className}`}
      title={plural(rating.count, dict.feedback.ratingLabel, { rating: value })}>
      <span aria-hidden className="text-amber-400">★</span>
      <span className="sr-only">{plural(rating.count, dict.feedback.ratingLabel, { rating: value })}</span>
      <span aria-hidden>
        {value} <span className="font-normal text-stone-500">({rating.count})</span>
      </span>
    </span>
  );
}
