// Translation and formatting helpers used by both server and client code.
import { CURRENCY, INTL_LOCALE, TIME_ZONE, TIME_ZONE_OFFSET, type Locale } from "./config";
import type { Dictionary, Plural } from "./dictionaries/ru";

// Fill placeholders: fill("Show code {code}", { code: "AB-1234" }).
export function fill(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

// Pick the right plural form for the language, e.g. Russian 1 сумка / 3 сумки / 5 сумок.
export function plural(locale: Locale, n: number, forms: Plural, vars: Record<string, string | number> = {}) {
  const category = new Intl.PluralRules(INTL_LOCALE[locale]).select(n) as keyof Plural;
  return fill(forms[category] ?? forms.other, { n, ...vars });
}

// "2026-10-02" for a date, in Kazakhstan time.
export function dayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date);
}

// Midnight today, Kazakhstan time.
export const startOfToday = () => new Date(`${dayKey(new Date())}T00:00:00${TIME_ZONE_OFFSET}`);

// Read a date + time typed in a form ("2026-10-02", "18:00") as Kazakhstan time.
export function parseLocalDateTime(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const result = new Date(`${date}T${time}:00${TIME_ZONE_OFFSET}`);
  return Number.isNaN(result.getTime()) ? null : result;
}

// Values for <input type="date"> and <input type="time">, in Kazakhstan time.
export const toDateInput = (date: Date) => dayKey(date);
export const toTimeInput = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .format(date);

// Locale-aware display formatters. Prices are stored in tiyn (1/100 tenge).
export function formatters(locale: Locale, dict: Dictionary) {
  const intl = INTL_LOCALE[locale];
  const money = new Intl.NumberFormat(intl, {
    style: "currency",
    currency: CURRENCY,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  });
  const time = new Intl.DateTimeFormat(intl, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const shortDate = new Intl.DateTimeFormat(intl, { timeZone: TIME_ZONE, weekday: "short", day: "numeric", month: "short" });
  const km = new Intl.NumberFormat(intl, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  return {
    price: (tiyn: number) => money.format(tiyn / 100),
    time: (date: Date) => time.format(date),
    date: (date: Date) => shortDate.format(date), // "пт, 3 окт."
    // "Today", "Tomorrow", or a short date.
    day: (date: Date) => {
      const days = Math.round(
        (new Date(dayKey(date)).getTime() - new Date(dayKey(new Date())).getTime()) / 86_400_000,
      );
      if (days === 0) return dict.common.today;
      if (days === 1) return dict.common.tomorrow;
      return shortDate.format(date);
    },
    // "Today, 18:00–20:00"
    pickupWindow(start: Date, end: Date) {
      return `${this.day(start)}, ${this.time(start)}–${this.time(end)}`;
    },
    distance: (kmValue: number) => (kmValue < 0.1 ? fill(dict.common.lessThanKm, { n: km.format(0.1) }) : fill(dict.common.km, { n: km.format(kmValue) })),
  };
}

export type Formatters = ReturnType<typeof formatters>;
