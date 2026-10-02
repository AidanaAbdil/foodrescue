// Languages and regional settings. Safe to import anywhere (server or client).

export const LOCALES = ["ru", "kk", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ru";
export const LOCALE_COOKIE = "locale";

// Short labels for the language switcher, each in its own language.
export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  ru: { short: "РУС", name: "Русский" },
  kk: { short: "ҚАЗ", name: "Қазақша" },
  en: { short: "ENG", name: "English" },
};

// Region-specific locales for number/date formatting ("1 990 ₸", "0,3 км").
export const INTL_LOCALE: Record<Locale, string> = { ru: "ru-KZ", kk: "kk-KZ", en: "en-KZ" };

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

// All of Kazakhstan uses UTC+5 (no daylight saving). Every time shown or
// entered in the app is in this zone, whatever the server's own clock says.
export const TIME_ZONE = "Asia/Almaty";
export const TIME_ZONE_OFFSET = "+05:00";
export const CURRENCY = "KZT";
