"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveBag } from "@/app/actions/dashboard";
import { FormField, inputClass, submitButtonClass } from "@/components/auth/FormField";
import { useI18n } from "@/i18n/client";
import { CATEGORY_EMOJI, CATEGORY_LIST } from "@/lib/categories";

type Props = {
  stores: { id: string; name: string }[];
  bagId?: string; // set when editing
  defaults: Record<string, string>; // initial field values
};

export function BagForm({ stores, bagId, defaults }: Props) {
  const [state, action, pending] = useActionState(saveBag, undefined);
  const { dict } = useI18n();
  const t = dict.dashboard;
  const values = state?.values ?? defaults;
  const errors = state?.errors ?? {};
  // With one store there's no store picker to show its error next to.
  const formError = errors.form ?? (stores.length > 1 ? undefined : errors.storeId);

  return (
    // `key` remounts the fields after an error so they show what was submitted.
    <form key={JSON.stringify(values)} action={action} className="space-y-5">
      {bagId && <input type="hidden" name="bagId" value={bagId} />}

      {formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {formError}
        </p>
      )}

      {stores.length > 1 ? (
        <Field label={t.formStore} name="storeId" error={errors.storeId}>
          <select id="storeId" name="storeId" defaultValue={values.storeId} className={inputClass(errors.storeId)}>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <input type="hidden" name="storeId" value={stores[0]?.id} />
      )}

      <FormField name="title" label={t.formTitle} required defaultValue={values.title} error={errors.title}
        placeholder={t.formTitlePlaceholder} />

      <Field label={t.formDescription} name="description">
        <textarea id="description" name="description" rows={3} defaultValue={values.description}
          placeholder={t.formDescriptionPlaceholder} className={inputClass()} />
      </Field>

      <Field label={t.formCategory} name="category" error={errors.category}>
        <select id="category" name="category" defaultValue={values.category} className={inputClass(errors.category)}>
          {CATEGORY_LIST.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_EMOJI[value]} {dict.categories[value]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField name="originalPrice" label={t.formOriginalPrice} inputMode="decimal" required
          defaultValue={values.originalPrice} error={errors.originalPrice} placeholder="4500" />
        <FormField name="price" label={t.formPrice} inputMode="decimal" required
          defaultValue={values.price} error={errors.price} placeholder="1490" />
        <FormField name="quantity" label={t.formQuantity} type="number" min={0} max={100} required
          defaultValue={values.quantity} error={errors.quantity} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-stone-700">{t.formPickup}</legend>
        <div className="mt-1 grid gap-4 sm:grid-cols-3">
          <input aria-label={t.formDate} type="date" name="date" required defaultValue={values.date}
            className={inputClass(errors.end)} />
          <input aria-label={t.formFrom} type="time" name="start" required defaultValue={values.start}
            className={inputClass(errors.end)} />
          <input aria-label={t.formUntil} type="time" name="end" required defaultValue={values.end}
            className={inputClass(errors.end)} />
        </div>
        {errors.end && <p className="mt-1 text-sm text-red-600">{errors.end}</p>}
      </fieldset>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Link href="/dashboard" className="rounded-lg px-4 py-2.5 text-center font-medium text-stone-600 hover:bg-stone-100">
          {dict.common.cancel}
        </Link>
        <button type="submit" disabled={pending} className={`${submitButtonClass} sm:w-auto sm:px-8`}>
          {pending ? t.saving : bagId ? t.saveChanges : t.publish}
        </button>
      </div>
    </form>
  );
}

// Label + error wrapper for selects and textareas.
function Field({ label, name, error, children }: { label: string; name: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
