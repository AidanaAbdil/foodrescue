"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const POLL_MS = 15_000;

// Keeps the header's "(2)" current: checks the number every few seconds and
// when the tab comes back into view, and redraws the page if it changed.
export function LiveCount({ count }: { count: number }) {
  const router = useRouter();

  useEffect(() => {
    let stopped = false;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/counts", { cache: "no-store" });
        if (!response.ok || stopped) return;
        const latest = (await response.json()) as { count: number };
        if (latest.count !== count) router.refresh();
      } catch {
        // offline for a moment: try again next time
      }
    }
    const timer = setInterval(check, POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [count, router]);

  return null;
}
