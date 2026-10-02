import { setLocale } from "@/app/actions/locale";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/config";

// РУС · ҚАЗ · ENG buttons. Each submits a tiny form that saves the choice in a cookie.
export function LanguageSwitcher({ current, label }: { current: Locale; label: string }) {
  return (
    <form action={setLocale} aria-label={label} className="flex rounded-lg bg-stone-100 p-0.5 text-xs font-semibold">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="submit"
          name="locale"
          value={locale}
          lang={locale}
          title={LOCALE_LABELS[locale].name}
          aria-pressed={locale === current}
          className={`rounded-md px-2 py-1.5 transition ${
            locale === current ? "bg-white text-brand-dark shadow-sm" : "text-stone-500 hover:text-stone-800"
          }`}
        >
          {LOCALE_LABELS[locale].short}
        </button>
      ))}
    </form>
  );
}
