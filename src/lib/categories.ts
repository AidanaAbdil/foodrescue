import type { DoodleName } from "@/components/Doodle";
import type { BagCategory } from "@/generated/prisma/enums";

// The doodle for each bag category, in the order shown in the filter bar.
// The names are translated: see `categories` in src/i18n/dictionaries.
export const CATEGORY_DOODLE: Record<BagCategory, DoodleName> = {
  MEALS: "bowl",
  BAKERY: "croissant",
  GROCERIES: "basket",
  PRODUCE: "carrot",
  MIXED: "gift",
};

export const CATEGORY_LIST = Object.keys(CATEGORY_DOODLE) as BagCategory[];

// Narrow an untrusted string (e.g. from the URL) to a real category.
export const isCategory = (value: unknown): value is BagCategory =>
  typeof value === "string" && Object.hasOwn(CATEGORY_DOODLE, value);
