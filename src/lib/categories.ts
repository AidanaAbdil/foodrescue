import type { BagCategory } from "@/generated/prisma/enums";

// Display label and emoji for each bag category, in the order shown in the filter bar.
export const CATEGORIES: Record<BagCategory, { label: string; emoji: string }> = {
  MEALS: { label: "Meals", emoji: "🍲" },
  BAKERY: { label: "Bakery", emoji: "🥐" },
  GROCERIES: { label: "Groceries", emoji: "🛒" },
  PRODUCE: { label: "Fruit & Veg", emoji: "🥕" },
  MIXED: { label: "Mixed", emoji: "🎁" },
};

// Narrow an untrusted string (e.g. from the URL) to a real category.
export const isCategory = (value: unknown): value is BagCategory =>
  typeof value === "string" && Object.hasOwn(CATEGORIES, value);
