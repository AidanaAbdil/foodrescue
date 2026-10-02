import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { SignupForm } from "@/components/auth/SignupForm";
import { getCurrentUser, safeReturnPath } from "@/lib/session";

export const metadata: Metadata = { title: "Sign up · FoodRescue" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  // Where to send the user afterwards, e.g. /login?next=/bags/abc
  const next = safeReturnPath((await searchParams).next);
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthCard
      title="Create your account"
      subtitle="Join FoodRescue and help stop food waste."
      footer={
        <>
          Already have an account?{" "}
          <Link href={next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-dark hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm next={next} />
    </AuthCard>
  );
}
