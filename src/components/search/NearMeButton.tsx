"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  active: boolean; // already sorting by distance?
  hrefWithout: string; // current URL minus the location, for "Clear"
};

// Asks the browser for the user's location and adds it to the URL as
// ?near=lat,lng so the server can sort bags by distance.
export function NearMeButton({ active, hrefWithout }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [message, setMessage] = useState("");

  function locate() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setMessage("Your browser can't share its location.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        // ~100 m precision is plenty for sorting and keeps the URL less exact.
        const near = `${coords.latitude.toFixed(3)},${coords.longitude.toFixed(3)}`;
        const separator = hrefWithout.includes("?") ? "&" : "?";
        router.push(`${hrefWithout}${separator}near=${near}`, { scroll: false });
        setStatus("idle");
      },
      (error) => {
        setStatus("error");
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location is blocked. Allow it in your browser's site settings to sort by distance."
            : "Couldn't get your location. Please try again.",
        );
      },
      { timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {active ? (
        <span className="flex items-center gap-2 rounded-lg bg-brand-light px-3 py-2.5 text-sm font-medium text-brand-dark">
          📍 Sorted by distance
          <Link href={hrefWithout} scroll={false} className="underline underline-offset-2 hover:no-underline">
            Clear
          </Link>
        </span>
      ) : (
        <button
          type="button"
          onClick={locate}
          disabled={status === "locating"}
          className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-60"
        >
          {status === "locating" ? "Finding you…" : "📍 Near me"}
        </button>
      )}
      {status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}
