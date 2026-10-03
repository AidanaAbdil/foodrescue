import { getI18n } from "@/i18n/server";
import { Doodle } from "@/components/Doodle";

// Halal / vegetarian / vegan chips for a bag. Vegan replaces vegetarian.
export async function FoodLabels({ bag, className = "" }: {
  bag: { isHalal: boolean; isVegetarian: boolean; isVegan: boolean };
  className?: string;
}) {
  const t = (await getI18n()).dict.labels;
  const chips = [
    bag.isHalal && { text: t.halal, sprout: false },
    bag.isVegan ? { text: t.vegan, sprout: true } : bag.isVegetarian && { text: t.vegetarian, sprout: true },
  ].filter((chip) => chip !== false);
  if (chips.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {chips.map((chip) => (
        <li key={chip.text} className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-accent">
          {chip.sprout && <Doodle name="sprout" size={13} className="mr-1" />}
          {chip.text}
        </li>
      ))}
    </ul>
  );
}
