import type { BagCategory } from "@/generated/prisma/enums";

// Emoji for each bag category, in the order shown in the filter bar.
// The names are translated: see `categories` in src/i18n/dictionaries.
export const CATEGORY_EMOJI: Record<BagCategory, string> = {
  MEALS: "🍲",
  BAKERY: "🥐",
  GROCERIES: "🛒",
  PRODUCE: "🥕",
  MIXED: "🎁",
};

export const CATEGORY_LIST = Object.keys(CATEGORY_EMOJI) as BagCategory[];

// Narrow an untrusted string (e.g. from the URL) to a real category.
export const isCategory = (value: unknown): value is BagCategory =>
  typeof value === "string" && Object.hasOwn(CATEGORY_EMOJI, value);
