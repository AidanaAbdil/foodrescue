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
