"use client";

import dynamic from "next/dynamic";

// Leaflet only works in the browser: load the map there, with a grey placeholder meanwhile.
export const ResultsMapLoader = dynamic(() => import("./ResultsMap"), {
  ssr: false,
  loading: () => <div className="h-[65vh] min-h-80 w-full animate-pulse rounded-2xl bg-stone-100" />,
});
