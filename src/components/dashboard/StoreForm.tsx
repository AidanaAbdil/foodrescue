"use client";

import { useActionState } from "react";
import { saveStore } from "@/app/actions/dashboard";
import { FormField, inputClass, submitButtonClass } from "@/components/auth/FormField";
import { useI18n } from "@/i18n/client";
import { LocationPicker } from "./LocationPicker";

type StoreDefaults = {
  id: string;
  name: string;
  address: string;
  city: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
};

// Store setup (no `store`) or editing an existing store.
export function StoreForm({ store }: { store?: StoreDefaults }) {
  const [state, action, pending] = useActionState(saveStore, undefined);
  const t = useI18n().dict.dashboard;
  const values = state?.values ?? {
    name: store?.name ?? "",
    address: store?.address ?? "",
    city: store?.city ?? "",
    description: store?.description ?? "",
  };
  const coords =
    store?.latitude != null && store.longitude != null ? { lat: store.latitude, lng: store.longitude } : null;
  const errors = state?.errors ?? {};

  return (
    <form key={JSON.stringify(values)} action={action} className="space-y-4">
      {store && <input type="hidden" name="storeId" value={store.id} />}
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
      <LocationPicker defaultCoords={coords} />
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {store ? (pending ? t.savingStore : t.saveStore) : pending ? t.creatingStore : t.createStore}
      </button>
    </form>
  );
}
