"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setStoreLocation } from "@/app/actions/dashboard";
import { useI18n } from "@/i18n/client";
import { useCurrentLocation } from "./LocationPicker";

// Dashboard button for stores that don't have a location yet.
export function SetLocationButton({ storeId }: { storeId: string }) {
  const router = useRouter();
  const t = useI18n().dict.location;
  const { locate, locating, error } = useCurrentLocation();
  const [saving, startSaving] = useTransition();

  async function handleClick() {
    const coords = await locate();
    if (!coords) return;
    startSaving(async () => {
      await setStoreLocation(storeId, coords.lat, coords.lng); // Server Action called directly
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={locating || saving}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-60"
      >
        {locating ? t.finding : saving ? t.saving : t.use}
      </button>
      {error && <span className="mt-1 text-sm text-red-600">{error}</span>}
    </span>
  );
}
