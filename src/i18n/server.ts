// Server-side: which language is this request in?
import "server-only";

import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { en } from "./dictionaries/en";
import { kk } from "./dictionaries/kk";
import { ru } from "./dictionaries/ru";
import { fill, formatters, plural } from "./shared";

const DICTIONARIES = { ru, kk, en };

// 1. The language the user picked (cookie), else 2. their browser's
// preferred language, else 3. Russian.
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  // Accept-Language looks like "kk-KZ,kk;q=0.9,ru;q=0.8,en;q=0.7" (already in preference order).
  const accepted = (await headers()).get("accept-language") ?? "";
  for (const part of accepted.split(",")) {
    const language = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(language)) return language;
  }
  return DEFAULT_LOCALE;
});

// Everything a server component or action needs to show text.
export const getI18n = cache(async () => {
  const locale = await getLocale();
  const dict = DICTIONARIES[locale];
  return {
    locale,
    dict,
    f: formatters(locale, dict),
    fill,
    plural: (n: number, forms: Parameters<typeof plural>[2], vars?: Record<string, string | number>) =>
      plural(locale, n, forms, vars),
  };
});

export const getDictionaryFor = (locale: Locale) => DICTIONARIES[locale];
