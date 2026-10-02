"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Coords } from "@/lib/geo";

// Gets the browser's location. Owners use this while standing in their store.
export function useCurrentLocation() {
  const t = useI18n().dict.location;
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState("");

  const locate = () =>
    new Promise<Coords | null>((resolve) => {
      if (!("geolocation" in navigator)) {
        setStatus("error");
        setError(t.unsupported);
        return resolve(null);
      }
      setStatus("locating");
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setStatus("idle");
          resolve({ lat: coords.latitude, lng: coords.longitude });
        },
        (err) => {
          setStatus("error");
          setError(
            err.code === err.PERMISSION_DENIED ? t.denied : t.failed,
          );
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15_000 },
      );
    });

  return { locate, locating: status === "locating", error: status === "error" ? error : "" };
}

// Form field: a button that fills hidden latitude/longitude inputs.
export function LocationPicker({ defaultCoords = null }: { defaultCoords?: Coords | null }) {
  const t = useI18n().dict.location;
  const { locate, locating, error } = useCurrentLocation();
  const [coords, setCoords] = useState<Coords | null>(defaultCoords);

  return (
    <div>
      <p className="text-sm font-medium text-stone-700">{t.label}</p>
      <p className="text-sm text-stone-500">{t.hint}</p>
      {coords && (
        <>
          <input type="hidden" name="latitude" value={coords.lat} />
          <input type="hidden" name="longitude" value={coords.lng} />
        </>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={locating}
          onClick={async () => setCoords((await locate()) ?? coords)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-60"
        >
          {locating ? t.finding : coords ? t.update : t.use}
        </button>
        {coords && (
          <span className="text-sm text-accent">
            {t.set} ({coords.lat.toFixed(3)}, {coords.lng.toFixed(3)})
          </span>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
