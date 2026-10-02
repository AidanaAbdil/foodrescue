import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
};

// A labelled text input with an optional hint and error message.
export function FormField({ name, label, error, hint, ...inputProps }: Props) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-stone-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClass(error)}
        {...inputProps}
      />
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${name}-hint`} className="mt-1 text-sm text-stone-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

// Shared look for text inputs, selects and textareas.
export const inputClass = (error?: string) =>
  `mt-1 block w-full rounded-lg border bg-white px-3 py-2.5 text-stone-900 outline-none transition focus:ring-2 ${
    error ? "border-red-400 focus:ring-red-200" : "border-stone-300 focus:border-brand focus:ring-brand-light"
  }`;

export const submitButtonClass =
  "w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60";
