"use client";

import { useActionState } from "react";
import { createStore } from "@/app/actions/dashboard";
import { FormField, inputClass, submitButtonClass } from "@/components/auth/FormField";

// Shown on the dashboard until the owner has created their first store.
export function StoreSetupForm() {
  const [state, action, pending] = useActionState(createStore, undefined);
  const values = state?.values ?? {};
  const errors = state?.errors ?? {};

  return (
    <form key={JSON.stringify(values)} action={action} className="space-y-4">
      <FormField name="name" label="Store name" required defaultValue={values.name} error={errors.name}
        placeholder="e.g. Golden Crust Bakery" />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <FormField name="address" label="Street address" required autoComplete="street-address"
          defaultValue={values.address} error={errors.address} />
        <FormField name="city" label="City" required autoComplete="address-level2"
          defaultValue={values.city} error={errors.city} />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-700">
          Short description (optional)
        </label>
        <textarea id="description" name="description" rows={2} defaultValue={values.description}
          placeholder="What do you sell?" className={inputClass()} />
      </div>
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {pending ? "Creating…" : "Create my store"}
      </button>
    </form>
  );
}
