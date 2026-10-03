"use client";

import { useActionState, type ReactNode } from "react";
import { deleteAccount, updateEmail, updateName, updatePassword, type AccountState } from "@/app/actions/account";
import { FormField, submitButtonClass } from "@/components/auth/FormField";
import { useI18n } from "@/i18n/client";
import { Doodle } from "@/components/Doodle";

type Action = (prev: AccountState, formData: FormData) => Promise<AccountState>;

// One card with a small form: shows the action's error or "saved" message.
function Section({ title, action, button, danger = false, okText, children }: {
  title: string;
  action: Action;
  button: string;
  danger?: boolean;
  okText: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <section className={`rounded-2xl bg-white p-6 ring-1 ${danger ? "ring-red-200" : "ring-stone-200"}`}>
      <h2 className={`text-lg font-semibold ${danger ? "text-red-800" : ""}`}>{title}</h2>
      <form action={formAction} className="mt-4 space-y-4">
        {children}
        {state?.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="text-sm font-medium text-accent">
            <Doodle name="check" size={15} className="mr-1" />{okText}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className={danger
            ? "w-full rounded-lg bg-red-700 px-4 py-2.5 font-semibold text-white hover:bg-red-800 disabled:opacity-60 sm:w-auto"
            : `${submitButtonClass} sm:w-auto sm:px-8`}
        >
          {button}
        </button>
      </form>
    </section>
  );
}

export function AccountForms({ name, email }: { name: string; email: string }) {
  const { dict } = useI18n();
  const t = dict.account;
  return (
    <div className="space-y-6">
      <Section title={t.profile} action={updateName} button={t.save} okText={t.saved}>
        <FormField name="name" label={dict.auth.name} defaultValue={name} required autoComplete="name" />
      </Section>

      <Section title={t.emailTitle} action={updateEmail} button={t.save} okText={t.saved}>
        <FormField name="email" label={t.newEmail} type="email" defaultValue={email} required autoComplete="email" />
        <FormField name="password" label={t.currentPassword} type="password" required autoComplete="current-password" />
      </Section>

      <Section title={t.passwordTitle} action={updatePassword} button={t.save} okText={t.passwordChanged}>
        <FormField name="password" label={t.currentPassword} type="password" required autoComplete="current-password" />
        <FormField name="newPassword" label={t.newPassword} type="password" required minLength={8}
          autoComplete="new-password" hint={dict.auth.passwordHint} />
      </Section>

      <Section title={t.deleteTitle} action={deleteAccount} button={t.deleteButton} okText="" danger>
        <p className="text-sm text-stone-600">{t.deleteText}</p>
        <FormField name="password" label={t.deleteConfirm} type="password" required autoComplete="current-password" />
      </Section>
    </div>
  );
}
