"use client";

import type { SelectHTMLAttributes } from "react";

// A <select> that applies its form as soon as a new option is picked
// (e.g. choosing a city updates the list without pressing "Search").
export function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(event) => event.currentTarget.form?.requestSubmit()} />;
}
