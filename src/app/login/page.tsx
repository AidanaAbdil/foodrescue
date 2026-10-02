import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser, safeReturnPath } from "@/lib/session";

export const metadata: Metadata = { title: "Log in · FoodRescue" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Where to send the user afterwards, e.g. /login?next=/bags/abc
  const next = safeReturnPath((await searchParams).next);
  // Already logged in? Nothing to do here.
  if (await getCurrentUser()) redirect(next);

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Log in to reserve surprise bags."
      footer={
        <>
          New to FoodRescue?{" "}
          <Link href={next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-dark hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}
