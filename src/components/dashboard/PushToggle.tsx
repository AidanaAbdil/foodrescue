"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "@/app/actions/push";
import { useI18n } from "@/i18n/client";

type Status = "checking" | "unsupported" | "ios-install" | "blocked" | "off" | "on" | "working";

// The server's public key is base64url; browsers want raw bytes.
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

// "🔔 Notifications on this device": turns push notifications for new
// orders on or off for the phone/computer it's tapped on.
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const t = useI18n().dict.push;
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const installed = window.matchMedia("(display-mode: standalone)").matches;
      if (!supported || !publicKey) return setStatus(isIos && !installed ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return setStatus("blocked");
      const registration = await navigator.serviceWorker.ready;
      setStatus((await registration.pushManager.getSubscription()) ? "on" : "off");
    })();
  }, [publicKey]);

  async function turnOn() {
    setStatus("working");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setStatus("blocked");
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) });
      await savePushSubscription(JSON.parse(JSON.stringify(sub)));
      setStatus("on");
    } catch (error) {
      console.error(error);
      setStatus("off");
    }
  }

  async function turnOff() {
    setStatus("working");
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus("off");
  }

  if (status === "checking") return null;
  if (status === "unsupported" || status === "ios-install" || status === "blocked") {
    return (
      <p className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm text-stone-600">
        {status === "blocked" ? t.blocked : status === "ios-install" ? t.iosInstall : t.unsupported}
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "on" ? (
        <>
          <span className="rounded-xl bg-brand-light px-4 py-2.5 text-sm font-semibold text-brand-dark">{t.enabled}</span>
          <button type="button" onClick={turnOff} className="text-sm font-medium text-stone-500 underline underline-offset-2">
            {t.disable}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={turnOn}
          disabled={status === "working"}
          title={t.hint}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-60"
        >
          {t.enable}
        </button>
      )}
    </div>
  );
}
