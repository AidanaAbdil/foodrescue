// Small display helpers shared across pages.

// Turn cents (499) into a display string ($4.99).
export const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export const formatTime = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// "Today", "Tomorrow", or a short date like "Mon, Oct 5".
export function formatDay(date: Date) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Values for <input type="date"> ("2026-10-02") and <input type="time"> ("14:30"),
// in the server's local time zone.
const pad = (n: number) => String(n).padStart(2, "0");
export const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Cents → "4.99" for a price input.
export const toPriceInput = (cents: number) => (cents / 100).toFixed(2);

// Percentage saved, e.g. 1500 → 499 gives 67.
export const discountPercent = (originalPrice: number, price: number) =>
  Math.round((1 - price / originalPrice) * 100);
