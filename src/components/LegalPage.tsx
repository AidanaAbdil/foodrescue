import { getI18n } from "@/i18n/server";
import { LEGAL, LEGAL_IS_DRAFT } from "@/content/legal";

// Renders the privacy policy or terms of use in the visitor's language.
export async function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const { locale } = await getI18n();
  const texts = LEGAL[locale];
  const { title, sections } = texts[doc];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-stone-500">{texts.updated}</p>
      {LEGAL_IS_DRAFT && (
        <p role="note" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          {texts.draftNote}
        </p>
      )}
      <div className="mt-8 space-y-6">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph} className="mt-2 leading-relaxed text-stone-700">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
