"use client";

import { useActionState, useState } from "react";
import { saveStore } from "@/app/actions/dashboard";
import { FormField, inputClass, submitButtonClass } from "@/components/auth/FormField";
import { useI18n } from "@/i18n/client";
import { CITY_LIST, cityAt, isCity, type City } from "@/lib/cities";
import type { Coords } from "@/lib/geo";
import { MapPicker } from "./MapPicker";

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
  const dict = useI18n().dict;
  const [city, setCity] = useState<City>(isCity(values.city) ? values.city : "ALMATY");
  const [coords, setCoords] = useState<Coords | null>(
    store?.latitude != null && store.longitude != null ? { lat: store.latitude, lng: store.longitude } : null,
  );
  // Choosing another city clears a pin that's outside it, so the map moves to
  // the new city and the owner taps the right spot.
  function chooseCity(next: City) {
    setCity(next);
    if (coords && cityAt(coords.lat, coords.lng) !== next) setCoords(null);
  }
  // Picking a point on the map also picks its city.
  function pick(point: Coords) {
    setCoords(point);
    const found = cityAt(point.lat, point.lng);
    if (found) setCity(found);
  }
  const errors = state?.errors ?? {};

  return (
    <form key={JSON.stringify(values)} action={action} className="space-y-4">
      {store && <input type="hidden" name="storeId" value={store.id} />}
      <FormField name="name" label={t.storeName} required defaultValue={values.name} error={errors.name}
        placeholder={t.storeNamePlaceholder} />
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <FormField name="address" label={t.street} required autoComplete="street-address"
          defaultValue={values.address} error={errors.address} />
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-stone-700">
            {t.city}
          </label>
          <select id="city" name="city" value={city} onChange={(event) => chooseCity(event.target.value as City)}
            className={inputClass(errors.city)}>
            {CITY_LIST.map((code) => (
              <option key={code} value={code}>
                {dict.cities[code]}
              </option>
            ))}
          </select>
          {errors.city && <p className="mt-1 text-sm text-red-600">{errors.city}</p>}
        </div>
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-stone-700">
          {t.storeDescription}
        </label>
        <textarea id="description" name="description" rows={2} defaultValue={values.description}
          placeholder={t.storeDescriptionPlaceholder} className={inputClass()} />
      </div>
      <MapPicker city={city} coords={coords} onPick={pick} />
      <button type="submit" disabled={pending} className={submitButtonClass}>
        {store ? (pending ? t.savingStore : t.saveStore) : pending ? t.creatingStore : t.createStore}
      </button>
    </form>
  );
}
