import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";
import { getI18n } from "@/i18n/server";
import { getCurrentUser, safeReturnPath } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.signup };
}

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  // Where to send the user afterwards, e.g. /login?next=/bags/abc
  const params = await searchParams;
  const next = safeReturnPath(params.next);
  // /signup?as=store opens with "I have a business" selected (from the partners page).
  const initialRole = params.as === "store" ? "STORE_OWNER" : "CUSTOMER";
  if (await getCurrentUser()) redirect(next);
  const t = (await getI18n()).dict.auth;

  return (
    <AuthCard
      title={t.signupTitle}
      subtitle={t.signupSubtitle}
      footer={
        <>
          {t.haveAccount}{" "}
          <Link href={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-dark hover:underline">
            {t.login}
          </Link>
        </>
      }
    >
      <SignupForm next={next} initialRole={initialRole} />
    </AuthCard>
  );
}
