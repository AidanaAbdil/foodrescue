import Link from "next/link";

// A leaf icon + the app name. Links back to the homepage.
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-brand-dark">
      <span className="grid size-9 place-items-center rounded-full bg-brand text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
        </svg>
      </span>
      <span className="text-xl tracking-tight">FoodRescue</span>
    </Link>
  );
}
