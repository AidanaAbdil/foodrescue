"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";
import { useI18n } from "@/i18n/client";
import { Doodle } from "@/components/Doodle";

type Status = "checking" | "unsupported" | "ios-install" | "blocked" | "off" | "on" | "working";

// The server's public key is base64url; browsers want raw bytes.
function keyBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

// The service worker (public/sw.js), registering it if needed. Gives up after
// a while instead of waiting forever, so the button never silently vanishes.
async function serviceWorker() {
  if (!(await navigator.serviceWorker.getRegistration("/"))) {
    await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  }
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("service worker not ready")), 10_000),
  );
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

// "🔔 Notifications on this device": turns push notifications on or off for
// the phone/computer it's tapped on. Store owners get new orders; customers
// hear when a store can't hand over their order.
export function PushToggle({ publicKey, hint }: { publicKey: string | null; hint: string }) {
  const { dict, fill } = useI18n();
  const t = dict.push;
  const [status, setStatus] = useState<Status>("checking");
  const [problem, setProblem] = useState(""); // why turning on failed, shown to the user
  const [testResult, setTestResult] = useState<"sent" | "failed" | null>(null);

  useEffect(() => {
    (async () => {
      // iPhones only allow notifications in the app added to the Home Screen.
      const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
      const installed = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && navigator.standalone === true);
      if (isIos && !installed) return setStatus("ios-install");
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported || !publicKey) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("blocked");
      try {
        const registration = await serviceWorker();
        setStatus((await registration.pushManager.getSubscription()) ? "on" : "off");
      } catch {
        setStatus("off"); // show the button; tapping it reports what's wrong
      }
    })();
  }, [publicKey]);

  async function turnOn() {
    setStatus("working");
    setProblem("");
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") return setStatus("blocked");
      if (permission !== "granted") throw new Error("permission not given");
      const registration = await serviceWorker();
      const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey!) });
      if (!(await savePushSubscription(JSON.parse(JSON.stringify(sub))))) throw new Error("not saved");
      setStatus("on");
    } catch (error) {
      console.error(error);
      setProblem(error instanceof Error ? error.message : String(error));
      setStatus("off");
    }
  }

  async function turnOff() {
    setStatus("working");
    setTestResult(null);
    try {
      const registration = await serviceWorker();
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
    } catch (error) {
      console.error(error);
    }
    setStatus("off");
  }

  async function test() {
    setTestResult(null);
    try {
      const sub = await (await serviceWorker()).pushManager.getSubscription();
      // Not saved on the server (e.g. turned on before logging in): save it again.
      const ok = sub && (await sendTestPush(sub.endpoint) || ((await savePushSubscription(JSON.parse(JSON.stringify(sub)))) && (await sendTestPush(sub.endpoint))));
      setTestResult(ok ? "sent" : "failed");
    } catch (error) {
      console.error(error);
      setTestResult("failed");
    }
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
          <span className="rounded-xl bg-brand-light px-4 py-2.5 text-sm font-semibold text-brand-dark"><Doodle name="bell" size={16} className="mr-1.5" />{t.enabled}</span>
          <button type="button" onClick={test} className="text-sm font-medium text-brand-dark underline underline-offset-2">
            {t.test}
          </button>
          <button type="button" onClick={turnOff} className="text-sm font-medium text-stone-500 underline underline-offset-2">
            {t.disable}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={turnOn}
          disabled={status === "working"}
          title={hint}
          className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-60"
        >
          <Doodle name="bell" size={16} className="mr-1.5 text-brand" />
          {t.enable}
        </button>
      )}
      {problem && <p className="w-full text-sm text-red-700">{fill(t.failed, { reason: problem })}</p>}
      {testResult && (
        <p role="status" className={`w-full text-sm ${testResult === "sent" ? "text-brand-dark" : "text-red-700"}`}>
          {testResult === "sent" ? t.testSent : t.testFailed}
        </p>
      )}
    </div>
  );
}
