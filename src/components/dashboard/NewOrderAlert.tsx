"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { LatestOrder } from "@/lib/new-orders";

const POLL_MS = 10_000;
const SOUND_KEY = "newOrderSound";

// A short two-tone chime made in the browser (no sound file needed).
function chime(audio: AudioContext) {
  [880, 1320].forEach((frequency, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = frequency;
    const start = audio.currentTime + i * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
    osc.connect(gain).connect(audio.destination);
    osc.start(start);
    osc.stop(start + 0.32);
  });
}

// While the dashboard is open, checks for new paid orders and announces them.
export function NewOrderAlert({ initial }: { initial: LatestOrder }) {
  const { dict, fill } = useI18n();
  const t = dict.dashboard;
  const router = useRouter();
  const lastSeen = useRef(initial?.paidAt ?? "");
  const audio = useRef<AudioContext | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  // Sound is on, but the browser is waiting for a click before it may play.
  const [waitingForTap, setWaitingForTap] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Polling loop.
  useEffect(() => {
    const baseTitle = () => document.title.replace(/^🔔 /, "");
    const timer = setInterval(async () => {
      try {
        const response = await fetch("/dashboard/updates", { cache: "no-store" });
        if (!response.ok) return;
        const { latest } = (await response.json()) as { latest: LatestOrder };
        if (!latest || latest.paidAt <= lastSeen.current) return;
        lastSeen.current = latest.paidAt;
        setToast(fill(t.newOrder, { code: latest.code, bag: latest.bag, n: latest.quantity }));
        if (audio.current) chime(audio.current);
        router.refresh(); // reload the pickup list and stats
        // Mark the tab (after the refresh, which resets the title) until the
        // owner comes back to it.
        setTimeout(() => {
          if (!document.hasFocus()) document.title = `🔔 ${baseTitle()}`;
        }, 1500);
      } catch {
        // offline for a moment: try again next time
      }
    }, POLL_MS);
    const resetTitle = () => (document.title = baseTitle());
    window.addEventListener("focus", resetTitle);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", resetTitle);
    };
  }, [router, fill, t.newOrder]);

  // Remember the sound choice across reloads. Browsers only allow sound after
  // a click, so a remembered "on" starts paused and wakes up on the first
  // click or key press anywhere on the page.
  useEffect(() => {
    try {
      if (localStorage.getItem(SOUND_KEY) !== "1") return;
    } catch {
      return;
    }
    const context = new AudioContext();
    audio.current = context;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring a saved choice once
    setSoundOn(true);
    if (context.state === "running") return;
    setWaitingForTap(true);
    const wake = (event: Event) => {
      if (button.current?.contains(event.target as Node)) return; // the button handles its own click
      context.resume().then(() => setWaitingForTap(false));
    };
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    context.addEventListener("statechange", () => {
      if (context.state !== "running") return;
      setWaitingForTap(false);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  function toggleSound() {
    if (waitingForTap && audio.current) {
      // Sound was already on: this click just lets the browser play it.
      audio.current.resume().then(() => audio.current && chime(audio.current));
      setWaitingForTap(false);
      return;
    }
    if (soundOn) {
      setSoundOn(false);
      audio.current?.close();
      audio.current = null;
    } else {
      audio.current = new AudioContext();
      chime(audio.current); // a sample, so the owner knows what to listen for
      setSoundOn(true);
    }
    try {
      localStorage.setItem(SOUND_KEY, soundOn ? "0" : "1");
    } catch {}
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggleSound}
        title={waitingForTap ? t.soundTapHint : undefined}
        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100"
      >
        {waitingForTap ? t.soundTap : soundOn ? t.soundOn : t.soundOff}
      </button>
      {toast && (
        <button
          type="button"
          role="status"
          onClick={() => setToast(null)}
          className="fixed inset-x-3 top-20 z-30 mx-auto block max-w-md rounded-2xl bg-accent px-5 py-4 text-left font-semibold text-white shadow-lg sm:inset-x-auto sm:right-4"
        >
          🔔 {toast}
        </button>
      )}
    </>
  );
}
