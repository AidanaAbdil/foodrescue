"use client";

import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { useI18n } from "@/i18n/client";
import { FormField, submitButtonClass } from "./FormField";


// `next` = where to go after success (e.g. back to the bag being reserved).
export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signup, undefined);
  const t = useI18n().dict.auth;
  const roles = [
    { value: "CUSTOMER", emoji: "🛍️", title: t.customerTitle, text: t.customerText },
    { value: "STORE_OWNER", emoji: "🏪", title: t.ownerTitle, text: t.ownerText },
  ];
  const errors = state?.errors;
  const role = state?.values?.role ?? "CUSTOMER";

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <fieldset>
        <legend className="text-sm font-medium text-stone-700">{t.accountType}</legend>
        <div className="mt-1 grid grid-cols-2 gap-3">
          {roles.map((option) => (
            <label
              key={option.value}
              className="cursor-pointer rounded-xl border border-stone-300 bg-white p-3 transition has-checked:border-brand has-checked:bg-brand-light/40 has-checked:ring-1 has-checked:ring-brand"
            >
              <input
                type="radio"
                name="role"
                value={option.value}
                defaultChecked={option.value === role}
                className="sr-only"
              />
              <span className="text-2xl" aria-hidden>
                {option.emoji}
              </span>
              <span className="mt-1 block text-sm font-semibold">{option.title}</span>
              <span className="block text-xs text-stone-500">{option.text}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        name="name"
        label={t.name}
        autoComplete="name"
        required
        defaultValue={state?.values?.name}
        error={errors?.name}
      />
      <FormField
        name="email"
        label={t.email}
        type="email"
        autoComplete="email"
        required
        defaultValue={state?.values?.email}
        error={errors?.email}
      />
      <FormField
        name="password"
        label={t.password}
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint={t.passwordHint}
        error={errors?.password}
      />
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {pending ? t.signingUp : t.signupButton}
      </button>
    </form>
  );
}
