import Link from "next/link";
import { acceptTerms } from "@/app/actions/auth";
import { LEGAL_VERSION } from "@/content/legal";
import { getI18n } from "@/i18n/server";
import { rich } from "@/i18n/rich";
import { getCurrentUser } from "@/lib/session";

// Asks logged-in users to agree if they haven't accepted the current version
// of the terms and privacy policy (older accounts, or after a policy change).
export async function ConsentBanner() {
  const user = await getCurrentUser();
  if (!user || user.consentVersion === LEGAL_VERSION) return null;
  const t = (await getI18n()).dict.consent;
  const link = "font-semibold underline underline-offset-2";

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <form
        action={acceptTerms}
        className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-amber-950"
      >
        <p>
          {rich(t.updated, {
            terms: <Link href="/terms" className={link}>{t.termsLink}</Link>,
            privacy: <Link href="/privacy" className={link}>{t.privacyLink}</Link>,
          })}
        </p>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark">
          {t.accept}
        </button>
      </form>
    </div>
  );
}
