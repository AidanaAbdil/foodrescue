"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { useI18n } from "@/i18n/client";
import { FormField, submitButtonClass } from "./FormField";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  const { dict } = useI18n();

  if (state?.sent) {
    return (
      <p role="status" className="rounded-lg bg-brand-light/60 px-4 py-3 text-stone-800">
        {dict.reset.sent}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <FormField
        name="email"
        label={dict.auth.email}
        type="email"
        autoComplete="email"
        required
        defaultValue={state?.email}
        error={state?.error}
      />
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {pending ? dict.reset.sending : dict.reset.sendLink}
      </button>
    </form>
  );
}
