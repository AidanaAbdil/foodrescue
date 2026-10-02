"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { useI18n } from "@/i18n/client";
import { FormField, submitButtonClass } from "./FormField";

// `next` = where to go after success (e.g. back to the bag being reserved).
export function LoginForm({ next }: { next: string }) {
  // state = whatever the login action last returned (errors), pending = submitting.
  const [state, action, pending] = useActionState(login, undefined);
  const t = useI18n().dict.auth;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      {state?.errors?.form && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.errors.form}
        </p>
      )}
      <FormField
        name="email"
        label={t.email}
        type="email"
        autoComplete="email"
        required
        defaultValue={state?.values?.email}
      />
      <div>
        <FormField name="password" label={t.password} type="password" autoComplete="current-password" required />
        <Link href="/forgot-password" className="mt-1 inline-block text-sm font-medium text-brand-dark hover:underline">
          {t.forgot}
        </Link>
      </div>
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {pending ? t.loggingIn : t.login}
      </button>
    </form>
  );
}
