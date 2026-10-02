import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.resetPassword };
}

export default async function ForgotPasswordPage() {
  const t = (await getI18n()).dict.reset;
  return (
    <AuthCard
      title={t.forgotTitle}
      subtitle={t.forgotSubtitle}
      footer={
        <Link href="/login" className="font-semibold text-brand-dark hover:underline">
          {t.backToLogin}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
