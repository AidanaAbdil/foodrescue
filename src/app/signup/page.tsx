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
  const next = safeReturnPath((await searchParams).next);
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
      <SignupForm next={next} />
    </AuthCard>
  );
}
