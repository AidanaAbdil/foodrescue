import { getI18n } from "@/i18n/server";

// Halal / vegetarian / vegan chips for a bag. Vegan replaces vegetarian.
export async function FoodLabels({ bag, className = "" }: {
  bag: { isHalal: boolean; isVegetarian: boolean; isVegan: boolean };
  className?: string;
}) {
  const t = (await getI18n()).dict.labels;
  const chips = [
    bag.isHalal && t.halal,
    bag.isVegan ? `🌱 ${t.vegan}` : bag.isVegetarian && `🌱 ${t.vegetarian}`,
  ].filter(Boolean);
  if (chips.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {chips.map((chip) => (
        <li key={String(chip)} className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-accent">
          {chip}
        </li>
      ))}
    </ul>
  );
}
