import type { Metadata } from "next";
import Link from "next/link";
import { Doodle } from "@/components/Doodle";
import { getI18n } from "@/i18n/server";
import { FEEDBACK_DAYS } from "@/lib/feedback";
import { MAX_PER_ORDER } from "@/lib/orders";
import { HOLD_MINUTES } from "@/lib/payments/service";
import { priceLevels, valueMultiplier } from "@/lib/pricing";
import { formatPhone } from "@/lib/phone";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.help.title, description: dict.help.sub };
}

// Contact details for the help page, from .env (shown only when set):
//   SUPPORT_EMAIL=help@example.kz  SUPPORT_PHONE=+77001234567  SUPPORT_TELEGRAM=foodrescue_help
const contact = () => ({
  email: process.env.SUPPORT_EMAIL?.trim() || null,
  phone: process.env.SUPPORT_PHONE?.trim() || null,
  telegram: process.env.SUPPORT_TELEGRAM?.trim().replace(/^@/, "") || null,
});

// Help: customers' common questions, answered with the site's real rules.
export default async function HelpPage() {
  const { dict, f, fill } = await getI18n();
  const t = dict.help;
  const vars = {
    levels: priceLevels().map((level) => f.price(level.price)).join(", "),
    multiplier: valueMultiplier(),
    hold: HOLD_MINUTES,
    max: MAX_PER_ORDER,
    days: FEEDBACK_DAYS,
  };
  const { email, phone, telegram } = contact();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="flex items-center gap-3 text-3xl font-bold">
        <Doodle name="search" size={30} className="text-brand" />{t.title}
      </h1>
      <p className="mt-2 text-stone-600">{t.sub}</p>

      {t.sections.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-xl font-semibold">{section.title}</h2>
          <div className="mt-3 divide-y divide-stone-200 rounded-2xl bg-white ring-1 ring-stone-200">
            {section.items.map((item) => (
              <details key={item.q} className="group p-5">
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  <span className="mr-2 inline-block text-brand transition group-open:rotate-90" aria-hidden>›</span>
                  {item.q}
                </summary>
                <p className="mt-2 text-stone-700">{fill(item.a, vars)}</p>
              </details>
            ))}
          </div>
        </section>
      ))}

      {(email || phone || telegram) && (
        <section className="mt-10 rounded-2xl bg-brand-light/60 p-6 ring-1 ring-accent/20">
          <h2 className="text-xl font-semibold">{t.contactTitle}</h2>
          <p className="mt-1 text-stone-700">{t.contactText}</p>
          <ul className="mt-3 space-y-1">
            {email && <li>{t.email}: <a href={`mailto:${email}`} className="font-semibold text-brand-dark underline underline-offset-2">{email}</a></li>}
            {phone && <li>{t.phone}: <a href={`tel:${phone}`} className="font-semibold text-brand-dark underline underline-offset-2">{formatPhone(phone)}</a></li>}
            {telegram && <li>{t.telegram}: <a href={`https://t.me/${encodeURIComponent(telegram)}`} target="_blank" rel="noreferrer" className="font-semibold text-brand-dark underline underline-offset-2">@{telegram}</a></li>}
          </ul>
        </section>
      )}

      <p className="mt-8">
        <Link href="/partners" className="font-semibold text-brand-dark underline underline-offset-2">{t.forBusiness}</Link>
      </p>
    </main>
  );
}
