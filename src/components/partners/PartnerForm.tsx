"use client";

import { useActionState } from "react";
import { submitPartnerRequest } from "@/app/actions/partners";
import { FormField, inputClass, submitButtonClass } from "@/components/auth/FormField";
import { useI18n } from "@/i18n/client";
import { CITY_LIST } from "@/lib/cities";
import { BUSINESS_KINDS } from "@/lib/partners";

// "Request to join": a store leaves its details and we call back.
export function PartnerForm() {
  const [state, action, pending] = useActionState(submitPartnerRequest, undefined);
  const { dict } = useI18n();
  const t = dict.partners;
  const values = state?.values ?? {};
  const errors = state?.errors ?? {};

  return (
    <form key={JSON.stringify(values)} action={action} className="space-y-4">
      {errors.form && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{errors.form}</p>
      )}
      {/* Spam trap: hidden from people, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>Website <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField name="storeName" label={t.fields.storeName} required defaultValue={values.storeName} error={errors.storeName} />
        <FormField name="contactName" label={t.fields.contactName} required autoComplete="name" defaultValue={values.contactName} error={errors.contactName} />
        <FormField name="phone" label={t.fields.phone} type="tel" required autoComplete="tel" inputMode="tel" placeholder="+7 701 123 45 67"
          defaultValue={values.phone} error={errors.phone} />
        <FormField name="email" label={t.fields.email} type="email" autoComplete="email" defaultValue={values.email} error={errors.email} />
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-stone-700">{t.fields.city}</label>
          <select id="city" name="city" defaultValue={values.city ?? CITY_LIST[0]} className={inputClass(errors.city)}>
            {CITY_LIST.map((code) => <option key={code} value={code}>{dict.cities[code]}</option>)}
          </select>
          {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
        </div>
        <div>
          <label htmlFor="kind" className="block text-sm font-medium text-stone-700">{t.fields.kind}</label>
          <select id="kind" name="kind" defaultValue={values.kind ?? "BAKERY"} className={inputClass(errors.kind)}>
            {BUSINESS_KINDS.map((kind) => <option key={kind} value={kind}>{t.kinds[kind]}</option>)}
          </select>
          {errors.kind && <p className="mt-1 text-sm text-red-600">{errors.kind}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-stone-700">{t.fields.message}</label>
        <textarea id="message" name="message" rows={3} maxLength={1000} defaultValue={values.message}
          placeholder={t.fields.messagePlaceholder} className={inputClass()} />
      </div>
      <button type="submit" disabled={pending} className={submitButtonClass}>{pending ? t.sending : t.submit}</button>
    </form>
  );
}
