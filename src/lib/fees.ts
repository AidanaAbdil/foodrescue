// What stores pay the service: a commission on every bag sold
// (platformFeePercent in src/lib/earnings.ts) plus a yearly fee. The first
// FOUNDING_PARTNERS stores approved get FOUNDING_FREE_MONTHS without the fee.
//
// Change in .env (then restart the site):
//   PLATFORM_FEE_PERCENT=20   YEARLY_FEE_TENGE=25000
//   FOUNDING_PARTNERS=50      FOUNDING_FREE_MONTHS=12
//
// Yearly fees are paid outside the app for now (transfer, Kaspi); an admin
// records each payment on /admin/fees, which extends the store by a year.

const envNumber = (name: string, fallback: number, min: number, max: number) => {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

export const yearlyFee = () => Math.round(envNumber("YEARLY_FEE_TENGE", 25_000, 0, 10_000_000)) * 100; // tiyn
export const foundingPartners = () => Math.round(envNumber("FOUNDING_PARTNERS", 50, 0, 10_000));
export const foundingFreeMonths = () => Math.round(envNumber("FOUNDING_FREE_MONTHS", 12, 0, 120));

export const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

type StoreFees = { feeFreeUntil: Date | null; feePaidUntil: Date | null };
export type FeeStatus =
  | { kind: "PAID"; until: Date }
  | { kind: "FREE"; until: Date }
  | { kind: "DUE"; since: Date | null };

// Paid beats free; otherwise the fee is due (since the free year or last payment ended).
export function feeStatus(store: StoreFees, now = new Date()): FeeStatus {
  if (store.feePaidUntil && store.feePaidUntil > now) return { kind: "PAID", until: store.feePaidUntil };
  if (store.feeFreeUntil && store.feeFreeUntil > now) return { kind: "FREE", until: store.feeFreeUntil };
  const ended = [store.feeFreeUntil, store.feePaidUntil].filter((d): d is Date => d !== null);
  return { kind: "DUE", since: ended.length ? new Date(Math.max(...ended.map((d) => d.getTime()))) : null };
}

// A payment covers the year after whatever is already covered (free or paid).
export function nextPaidUntil(store: StoreFees, now = new Date()) {
  const from = Math.max(now.getTime(), store.feeFreeUntil?.getTime() ?? 0, store.feePaidUntil?.getTime() ?? 0);
  return addMonths(new Date(from), 12);
}
