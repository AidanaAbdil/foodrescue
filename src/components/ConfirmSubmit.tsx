"use client";

import type { ReactNode } from "react";

// A form whose submit asks "are you sure?" first (for costly mistakes like
// refunding an order). Works with Server Actions passed as `action`.
export function ConfirmSubmit({ action, message, hidden, className, children }: {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  hidden: Record<string, string>;
  className: string;
  children: ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
