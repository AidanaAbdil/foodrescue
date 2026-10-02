"use client"; // error screens must be client components

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/i18n/client";

// Shown instead of a page when something breaks while loading it.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { dict, fill } = useI18n();
  const t = dict.errorPage;

  useEffect(() => {
    console.error(error); // shows up in the server/browser logs
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>
        🥡
      </p>
      <h1 className="mt-4 text-2xl font-bold">{t.title}</h1>
      <p className="mt-2 text-stone-600">{t.text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark"
        >
          {t.retry}
        </button>
        <Link href="/" className="rounded-xl px-5 py-2.5 font-semibold text-stone-700 ring-1 ring-stone-300 hover:bg-stone-100">
          {t.home}
        </Link>
      </div>
      {/* The code matches the server log entry, which helps when someone reports a problem. */}
      {error.digest && <p className="mt-6 text-xs text-stone-400">{fill(t.code, { code: error.digest })}</p>}
    </main>
  );
}
