"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import { Doodle } from "@/components/Doodle";

const DISMISSED_KEY = "installHintDismissed";

// iPhones don't offer an "Install app" button, so iPhone users get a small,
// dismissible tip. Android browsers show their own install prompt instead.
export function InstallHint() {
  const t = useI18n().dict.install;
  const [show, setShow] = useState(false);

  useEffect(() => {
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const installed = ("standalone" in navigator && navigator.standalone === true) ||
      window.matchMedia("(display-mode: standalone)").matches;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // private mode etc.: just show it
    }
    // Reading the browser has to happen after the first render (effect), so
    // the server-rendered HTML always matches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos && !installed && !dismissed) setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {}
  }

  return (
    <div
      role="note"
      className="fixed inset-x-3 bottom-3 z-20 mb-[env(safe-area-inset-bottom)] flex items-start gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-stone-200"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
      <img src="/icons/icon-192.png" alt="" className="size-10 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">{t.title}</p>
        <p className="mt-0.5 text-stone-600">{t.ios}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.close}
        className="-m-1 grid size-8 shrink-0 place-items-center rounded-lg text-stone-500 hover:bg-stone-100"
      >
        <Doodle name="close" size={16} />
      </button>
    </div>
  );
}
