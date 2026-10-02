import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { getI18n } from "@/i18n/server";
import { getCurrentUser, safeReturnPath } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.login };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Where to send the user afterwards, e.g. /login?next=/bags/abc
  const next = safeReturnPath((await searchParams).next);
  // Already logged in? Nothing to do here.
  if (await getCurrentUser()) redirect(next);
  const t = (await getI18n()).dict.auth;

  return (
    <AuthCard
      title={t.loginTitle}
      subtitle={t.loginSubtitle}
      footer={
        <>
          {t.newHere}{" "}
          <Link href={next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-dark hover:underline">
            {t.createAccount}
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
