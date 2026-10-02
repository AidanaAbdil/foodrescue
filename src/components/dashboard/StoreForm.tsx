"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { saveStore } from "@/app/actions/dashboard";
import { lookupAddress, lookupPoint } from "@/app/actions/geocode";
import { FormField, inputClass, submitButtonClass } from "@/components/auth/FormField";
import { useI18n } from "@/i18n/client";
import { CITY_LIST, cityAt, isCity, type City } from "@/lib/cities";
import type { Coords } from "@/lib/geo";
import { formatPhone } from "@/lib/phone";
import { MapPicker } from "./MapPicker";

type StoreDefaults = {
  id: string;
  phone: string | null;
  openingHours: string | null;
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
    phone: store?.phone ? formatPhone(store.phone) : "",
    openingHours: store?.openingHours ?? "",
  };
  const { dict, fill } = useI18n();
  const [city, setCity] = useState<City>(isCity(values.city) ? values.city : "ALMATY");
  const [coords, setCoords] = useState<Coords | null>(
    store?.latitude != null && store.longitude != null ? { lat: store.latitude, lng: store.longitude } : null,
  );
  // Address ↔ map (OpenStreetMap): "Find on map", and the address at a new pin.
  const [address, setAddress] = useState(values.address ?? "");
  const addressRef = useRef(address); // latest value, for the async pin lookup below
  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  const [searching, startSearch] = useTransition();
  const [findResult, setFindResult] = useState<"found" | "notFound" | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const loc = dict.location;

  function findOnMap() {
    startSearch(async () => {
      const point = await lookupAddress(address, city);
      setFindResult(point ? "found" : "notFound");
      if (point) {
        setCoords(point);
        setSuggestion(null);
      }
    });
  }

  // Choosing another city clears a pin that's outside it, so the map moves to
  // the new city and the owner taps the right spot.
  function chooseCity(next: City) {
    setCity(next);
    if (coords && cityAt(coords.lat, coords.lng) !== next) setCoords(null);
  }
  // Picking a point on the map also picks its city.
  function pick(point: Coords) {
    setCoords(point);
    setFindResult(null);
    const found = cityAt(point.lat, point.lng);
    if (found) setCity(found);
    // Suggest the street address at the pin (fill it in if the field is empty).
    lookupPoint(point.lat, point.lng).then((street) => {
      const current = addressRef.current;
      if (!street || current === street) return setSuggestion(null);
      if (current.trim() === "") {
        setAddress(street);
        setSuggestion(null);
      } else {
        setSuggestion(street);
      }
    });
  }
  const errors = state?.errors ?? {};

  return (
    <form key={JSON.stringify(values)} action={action} className="space-y-4">
      {store && <input type="hidden" name="storeId" value={store.id} />}
      <FormField name="name" label={t.storeName} required defaultValue={values.name} error={errors.name}
        placeholder={t.storeNamePlaceholder} />
      {/* City first: "Find on map" searches within the chosen city. */}
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
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
        <div>
          <FormField name="address" label={t.street} required autoComplete="street-address"
            value={address} onChange={(event) => { setAddress(event.target.value); setFindResult(null); }}
            error={errors.address} />
          <button
            type="button"
            onClick={findOnMap}
            disabled={searching || address.trim().length < 3}
            className="mt-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-50"
          >
            {searching ? loc.searching : loc.findOnMap}
          </button>
          {findResult && (
            <p className={`mt-1 text-sm ${findResult === "found" ? "text-accent" : "text-amber-800"}`}>
              {findResult === "found" ? loc.found : loc.notFound}
            </p>
          )}
          {suggestion && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-stone-700">
              {fill(loc.addressFromMap, { address: suggestion })}
              <button
                type="button"
                onClick={() => { setAddress(suggestion); setSuggestion(null); }}
                className="rounded-md px-2 py-0.5 font-semibold text-brand-dark ring-1 ring-brand-light hover:bg-brand-light/50"
              >
                {loc.useAddress}
              </button>
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <FormField name="phone" label={t.phone} type="tel" required autoComplete="tel" inputMode="tel"
          placeholder="+7 701 123 45 67" defaultValue={values.phone} error={errors.phone} />
        <FormField name="openingHours" label={t.hours} maxLength={200}
          placeholder={t.hoursPlaceholder} defaultValue={values.openingHours} />
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
