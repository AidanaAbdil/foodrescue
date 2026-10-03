"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/i18n/client";
import { CITIES, type City } from "@/lib/cities";
import type { Coords } from "@/lib/geo";
import { useCurrentLocation } from "./LocationPicker";
import { Doodle } from "@/components/Doodle";

// Leaflet touches `window`, so the map only loads in the browser.
const StoreMap = dynamic(() => import("./StoreMap"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-stone-100" />,
});

type Props = { city: City; coords: Coords | null; onPick: (coords: Coords) => void };

// Store location: tap the map / drag the pin, or use the phone's location.
// The chosen point travels with the form in hidden latitude/longitude fields.
export function MapPicker({ city, coords, onPick }: Props) {
  const t = useI18n().dict.location;
  const { locate, locating, error } = useCurrentLocation();

  return (
    <div>
      <p className="text-sm font-medium text-stone-700">{t.label}</p>
      <p className="text-sm text-stone-500">{t.mapHint}</p>
      {coords && (
        <>
          <input type="hidden" name="latitude" value={coords.lat} />
          <input type="hidden" name="longitude" value={coords.lng} />
        </>
      )}
      <div className="mt-2">
        <StoreMap center={CITIES[city]} coords={coords} onPick={onPick} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={locating}
          onClick={async () => {
            const found = await locate();
            if (found) onPick(found);
          }}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-60"
        >
          {!locating && <Doodle name="pin" size={15} className="mr-1.5 text-brand" />}
          {locating ? t.finding : t.use}
        </button>
        {coords && <span className="text-sm text-accent"><Doodle name="check" size={15} className="mr-1" />{t.pinSet}</span>}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
