"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { saveBag } from "@/app/actions/dashboard";
import { FormField, inputClass, submitButtonClass } from "@/components/auth/FormField";
import { PhotoField } from "@/components/dashboard/PhotoField";
import { useI18n } from "@/i18n/client";
import { CATEGORY_EMOJI, CATEGORY_LIST } from "@/lib/categories";
import { ALLERGENS } from "@/lib/labels";

type Props = {
  stores: { id: string; name: string }[];
  // "new": add a bag (one-off or regular) · "bag": edit one bag · "schedule": edit a regular bag
  mode: "new" | "bag" | "schedule";
  bagId?: string;
  scheduleId?: string;
  fromScheduleId?: string | null; // editing one bag that a regular bag published
  defaults: Record<string, string>; // initial field values
};

export function BagForm({ stores, mode, bagId, scheduleId, fromScheduleId, defaults }: Props) {
  const [state, action, pending] = useActionState(saveBag, undefined);
  const { dict } = useI18n();
  const t = dict.dashboard;
  const values = state?.values ?? defaults;
  // Regular bag? Chosen with the Once / Regularly switch when adding a bag or
  // editing a one-off bag (which can then become a regular one).
  const canChooseRepeat = mode === "new" || (mode === "bag" && !fromScheduleId);
  const [repeat, setRepeat] = useState(mode === "schedule" || values.repeat === "1");
  const errors = state?.errors ?? {};
  // With one store there's no store picker to show its error next to.
  const formError = errors.form ?? (stores.length > 1 ? undefined : errors.storeId);

  return (
    // `key` remounts the fields after an error so they show what was submitted.
    <form key={JSON.stringify(values)} action={action} className="space-y-5">
      {bagId && <input type="hidden" name="bagId" value={bagId} />}
      {scheduleId && <input type="hidden" name="scheduleId" value={scheduleId} />}
      {canChooseRepeat && <input type="hidden" name="repeat" value={repeat ? "1" : ""} />}

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

      <PhotoField defaultUrl={values.imageUrl} />

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

      <fieldset>
        <legend className="text-sm font-medium text-stone-700">{dict.labels.title}</legend>
        <p className="text-sm text-stone-500">{dict.labels.hint}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["isHalal", "isVegetarian", "isVegan"] as const).map((name) => (
            <Check key={name} name={name} value="true" defaultChecked={values[name] === "true"}>
              {dict.labels[name === "isHalal" ? "halal" : name === "isVegetarian" ? "vegetarian" : "vegan"]}
            </Check>
          ))}
        </div>
        <p className="mt-3 text-sm font-medium text-stone-700">{dict.labels.mayContain}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALLERGENS.map((code) => (
            <Check key={code} name="allergens" value={code}
              defaultChecked={(values.allergens ?? "").split(",").includes(code)}>
              {dict.labels.allergens[code]}
            </Check>
          ))}
        </div>
      </fieldset>

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

        {fromScheduleId && (
          <p className="mt-1 text-sm text-stone-600">
            🔁 {t.fromScheduleNote}{" "}
            <Link href={`/dashboard/schedules/${fromScheduleId}/edit`} className="font-medium text-brand-dark underline underline-offset-2">
              {t.fromScheduleLink}
            </Link>
          </p>
        )}
        {canChooseRepeat && (
          <div className="mt-1 inline-flex rounded-lg bg-stone-100 p-1 text-sm font-medium" role="radiogroup" aria-label={t.repeat}>
            {[false, true].map((option) => (
              <button
                key={String(option)}
                type="button"
                role="radio"
                aria-checked={repeat === option}
                onClick={() => setRepeat(option)}
                className={`rounded-md px-4 py-1.5 ${repeat === option ? "bg-white text-brand-dark shadow-sm" : "text-stone-600"}`}
              >
                {option ? `🔁 ${t.repeatWeekly}` : t.repeatOnce}
              </button>
            ))}
          </div>
        )}

        {repeat && (
          <div className="mt-3">
            <p className="text-sm text-stone-500">{t.repeatHint}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {t.weekdays.map((label, i) => (
                <Check key={label} name="weekdays" value={String(i + 1)}
                  defaultChecked={(values.weekdays ?? "").split(",").includes(String(i + 1))}>
                  {label}
                </Check>
              ))}
            </div>
            {errors.weekdays && <p className="mt-1 text-sm text-red-600">{errors.weekdays}</p>}
          </div>
        )}

        <div className={`mt-3 grid gap-4 ${repeat ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
          {!repeat && (
            <input aria-label={t.formDate} type="date" name="date" required defaultValue={values.date}
              className={inputClass(errors.end)} />
          )}
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

// A checkbox styled as a toggle chip.
function Check({ name, value, defaultChecked, children }: {
  name: string; value: string; defaultChecked: boolean; children: React.ReactNode;
}) {
  return (
    <label className="cursor-pointer rounded-full px-3 py-1.5 text-sm font-medium text-stone-700 ring-1 ring-stone-300 transition has-checked:bg-accent has-checked:text-white has-checked:ring-accent">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />
      {children}
    </label>
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
