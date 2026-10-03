// Number helpers that don't depend on the language. Text, dates and prices
// are formatted by `f` from src/i18n (getI18n() on the server, useI18n() in
// client components).

// Prices are stored in tiyn (1/100 tenge) as whole numbers, which avoids
// rounding errors.

// "1490", "1 490" or "1490.50" tenge → tiyn, or null if it isn't a valid amount.
export function parsePrice(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

// Percentage saved, e.g. 4500 → 1490 gives 67.
export const discountPercent = (originalPrice: number, price: number) =>
  Math.round((1 - price / originalPrice) * 100);
