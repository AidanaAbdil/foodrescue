"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPassword } from "@/app/actions/auth";
import { useI18n } from "@/i18n/client";
import { FormField, submitButtonClass } from "./FormField";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, undefined);
  const { dict } = useI18n();

  // The link was used or expired while the page was open.
  if (state?.invalid) {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {dict.reset.invalidLink}
        </p>
        <Link href="/forgot-password" className="font-semibold text-brand-dark hover:underline">
          {dict.reset.requestNew}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <FormField
        name="password"
        label={dict.reset.newPassword}
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint={dict.auth.passwordHint}
        error={state?.error}
      />
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {pending ? dict.reset.saving : dict.reset.save}
      </button>
    </form>
  );
}
