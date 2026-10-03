import type { Metadata } from "next";
import Link from "next/link";
import { PartnerForm } from "@/components/partners/PartnerForm";
import { getI18n } from "@/i18n/server";
import { platformFeePercent } from "@/lib/earnings";
import { Doodle } from "@/components/Doodle";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.partners.title, description: dict.partners.sub };
}

const BENEFIT_DOODLES = ["coin", "star", "clock", "sprout"] as const;

// "For businesses": why join, how it works, common questions, and a request form.
export default async function PartnersPage({ searchParams }: PageProps<"/partners">) {
  const { dict, fill } = await getI18n();
  const t = dict.partners;
  const { sent } = await searchParams;
  const fee = platformFeePercent();
  const faq = [{ q: t.faqCostQ, a: fee > 0 ? fill(t.faqCostSet, { percent: fee }) : t.faqCostUnset }, ...t.faq];

  return (
    <main>
      <section className="bg-brand text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-widest">{t.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">{t.heading}</h1>
          <p className="mt-4 max-w-2xl text-lg">{t.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#request" className="rounded-xl bg-white px-5 py-3 font-semibold text-brand-dark hover:bg-brand-light">{t.ctaForm}</a>
            <Link href="/signup?as=store" className="rounded-xl px-5 py-3 font-semibold text-white ring-2 ring-white/80 hover:bg-white/10">{t.ctaSignup}</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-14">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.benefits.map((benefit, i) => (
            <li key={benefit.title} className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
              <span className="grid size-12 place-items-center rounded-full bg-brand-light text-brand-dark"><Doodle name={BENEFIT_DOODLES[i]} size={26} /></span>
              <h2 className="mt-3 font-semibold">{benefit.title}</h2>
              <p className="mt-1 text-sm text-stone-600">{benefit.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-14">
        <h2 className="text-2xl font-bold">{t.howTitle}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl bg-white p-6 ring-1 ring-stone-200">
              <span className="grid size-9 place-items-center rounded-full bg-brand font-bold text-white" aria-hidden>{i + 1}</span>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-stone-600">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold">{t.faqTitle}</h2>
          <div className="mt-4 divide-y divide-stone-200 rounded-2xl bg-white ring-1 ring-stone-200">
            {faq.map((item) => (
              <details key={item.q} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="mr-2 inline-block text-brand transition group-open:rotate-90" aria-hidden>›</span>
                  {item.q}
                </summary>
                <p className="mt-2 text-sm text-stone-600">{item.a}</p>
              </details>
            ))}
          </div>
        </div>

        <div id="request" className="scroll-mt-24 rounded-2xl bg-white p-6 ring-1 ring-stone-200 sm:p-8">
          <h2 className="text-2xl font-bold">{t.formTitle}</h2>
          {sent ? (
            <p role="status" className="mt-4 rounded-xl bg-accent px-4 py-3 font-medium text-white">{t.sent}</p>
          ) : (
            <>
              <p className="mt-1 text-stone-600">{t.formHint}</p>
              <div className="mt-6"><PartnerForm /></div>
            </>
          )}
          <p className="mt-6 text-sm text-stone-600">
            {t.readyNow}{" "}
            <Link href="/signup?as=store" className="font-semibold text-brand-dark underline underline-offset-2">{t.ctaSignup} →</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
