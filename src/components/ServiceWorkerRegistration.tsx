"use client";

import { useEffect } from "react";

// Switches on the service worker (public/sw.js) that shows the offline page.
// Production only: in development it would get in the way of live reloading.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);
  return null;
}
