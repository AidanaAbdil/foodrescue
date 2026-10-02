import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { getI18n } from "@/i18n/server";
import { findValidResetToken } from "@/lib/reset-tokens";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).dict.meta.resetPassword };
}

// Opened from the link in the reset email: /reset-password?token=…
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const t = (await getI18n()).dict.reset;
  const valid = typeof token === "string" && (await findValidResetToken(token)) !== null;

  return (
    <AuthCard
      title={t.newTitle}
      subtitle={valid ? t.newSubtitle : ""}
      footer={
        <Link href="/login" className="font-semibold text-brand-dark hover:underline">
          {t.backToLogin}
        </Link>
      }
    >
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="space-y-3">
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {t.invalidLink}
          </p>
          <Link href="/forgot-password" className="font-semibold text-brand-dark hover:underline">
            {t.requestNew}
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
