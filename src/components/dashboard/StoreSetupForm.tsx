"use client";

import { useActionState } from "react";
import { createStore } from "@/app/actions/dashboard";
import { FormField, inputClass, submitButtonClass } from "@/components/auth/FormField";
import { useI18n } from "@/i18n/client";
import { LocationPicker } from "./LocationPicker";

// Shown on the dashboard until the owner has created their first store.
export function StoreSetupForm() {
  const [state, action, pending] = useActionState(createStore, undefined);
  const t = useI18n().dict.dashboard;
  const values = state?.values ?? {};
  const errors = state?.errors ?? {};

  return (
    <form key={JSON.stringify(values)} action={action} className="space-y-4">
      <FormField name="name" label={t.storeName} required defaultValue={values.name} error={errors.name}
        placeholder={t.storeNamePlaceholder} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <FormField name="address" label={t.street} required autoComplete="street-address"
          defaultValue={values.address} error={errors.address} />
        <FormField name="city" label={t.city} required autoComplete="address-level2"
          defaultValue={values.city} error={errors.city} />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-700">
          {t.storeDescription}
        </label>
        <textarea id="description" name="description" rows={2} defaultValue={values.description}
          placeholder={t.storeDescriptionPlaceholder} className={inputClass()} />
      </div>
      <LocationPicker />
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {pending ? t.creatingStore : t.createStore}
      </button>
    </form>
  );
}
