// Bag prices are fixed levels, like Too Good To Go: a store picks one, and
// promises food worth at least VALUE_MULTIPLIER × the price inside.
//
// To change them, set in .env (then restart the site):
//   PRICE_LEVELS=990,1490,1990,2990   (tenge)
//   VALUE_MULTIPLIER=2                (2 = at least 50% off, 3 = about 66% off)
// Existing bags keep their price until edited; `npm run prices:apply` moves
// upcoming bags and regular bags to the nearest level.

const DEFAULT_LEVELS = [990, 1490, 1990, 2990];
const DEFAULT_MULTIPLIER = 2;

export type PriceLevel = { price: number; value: number }; // both in tiyn (1 ₸ = 100)

export function valueMultiplier() {
  const n = Number(process.env.VALUE_MULTIPLIER ?? DEFAULT_MULTIPLIER);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : DEFAULT_MULTIPLIER;
}

export function priceLevels(): PriceLevel[] {
  const fromEnv = (process.env.PRICE_LEVELS ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((tenge) => Number.isInteger(tenge) && tenge > 0);
  const tenge = fromEnv.length > 0 ? [...new Set(fromEnv)].sort((a, b) => a - b) : DEFAULT_LEVELS;
  const multiplier = valueMultiplier();
  return tenge.map((t) => ({ price: t * 100, value: Math.round(t * multiplier) * 100 }));
}

// The level for a price (tiyn) chosen in the form, or null if it isn't one.
export const levelFor = (price: number, levels = priceLevels()) => levels.find((level) => level.price === price) ?? null;

// The closest level to an old free-form price (for editing older bags).
export function nearestLevel(price: number, levels = priceLevels()) {
  return levels.reduce((best, level) => (Math.abs(level.price - price) < Math.abs(best.price - price) ? level : best));
}
