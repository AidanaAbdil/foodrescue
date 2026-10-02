// Food labels on surprise bags: halal / vegetarian / vegan, plus "may
// contain" allergens. Names are translated in the dictionaries (`labels`).

export const ALLERGENS = ["NUTS", "MILK", "GLUTEN", "EGGS", "FISH", "SESAME", "SOY"] as const;
export type Allergen = (typeof ALLERGENS)[number];

// "GLUTEN,MILK" (as stored) → ["GLUTEN", "MILK"], ignoring anything unknown.
export const parseAllergens = (stored: string): Allergen[] =>
  ALLERGENS.filter((code) => stored.split(",").includes(code));

// Form values → stored string, keeping only known codes in a fixed order.
export const serializeAllergens = (codes: string[]) => ALLERGENS.filter((code) => codes.includes(code)).join(",");
