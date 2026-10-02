"use client";

import { useEffect } from "react";

// Switches on the service worker (public/sw.js): offline page and push
// notifications. It only handles full page loads, so live reloading in
// development keeps working.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);
  return null;
}
