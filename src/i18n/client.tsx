"use client";
// Client-side: client components read the language from this context, which
// the root layout fills in from the server.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import type { Dictionary, Plural } from "./dictionaries/ru";
import { fill, formatters, plural } from "./shared";

const I18nContext = createContext<{ locale: Locale; dict: Dictionary } | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>");
  const { locale, dict } = context;
  return {
    locale,
    dict,
    f: formatters(locale, dict),
    fill,
    plural: (n: number, forms: Plural, vars?: Record<string, string | number>) => plural(locale, n, forms, vars),
  };
}
