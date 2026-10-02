"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

// A button that asks "are you sure?" right on the page before submitting
// (for costly mistakes like refunding an order). Works with Server Actions.
export function ConfirmSubmit({ action, message, hidden, className, yes, no, children }: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  hidden: Record<string, string>;
  className: string;
  yes: string;
  no: string;
  children: ReactNode;
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={className}>
        {children}
      </button>
    );
  }
  return (
    <form
      action={action}
      role="alertdialog"
      onKeyDown={(event) => event.key === "Escape" && setAsking(false)}
      className="basis-full rounded-xl bg-stone-100 p-3 text-sm"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className="text-stone-800">{message}</p>
      <div className="mt-2 flex gap-2">
        <YesButton label={yes} />
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="rounded-lg px-4 py-2 font-medium text-stone-700 ring-1 ring-stone-300 hover:bg-white"
        >
          {no}
        </button>
      </div>
    </form>
  );
}

function YesButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      autoFocus
      disabled={pending}
      className="rounded-lg bg-stone-800 px-4 py-2 font-semibold text-white hover:bg-stone-900 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
