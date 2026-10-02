"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";

type Props = {
  label: string;
  links: { href: string; label: string }[];
  user: { name: string } | null;
  logoutLabel: string;
};

// ☰ menu for phones. Keyed by the current page, so it closes after navigating.
export function MobileMenu({ label, links, user, logoutLabel }: Props) {
  const pathname = usePathname();

  return (
    <details key={pathname} className="group relative lg:hidden">
      <summary
        aria-label={label}
        className="grid size-10 cursor-pointer list-none place-items-center rounded-lg text-stone-700 hover:bg-stone-100 [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6" aria-hidden>
          <path className="group-open:hidden" d="M4 6h16M4 12h16M4 18h16" />
          <path className="hidden group-open:block" d="M6 6l12 12M18 6 6 18" />
        </svg>
      </summary>
      <div className="absolute right-0 top-12 w-60 rounded-2xl bg-white p-2 text-base shadow-lg ring-1 ring-stone-200">
        {user && <p className="px-3 pb-2 pt-1 text-sm text-stone-500">{user.name}</p>}
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="block rounded-lg px-3 py-2.5 hover:bg-stone-100">
            {link.label}
          </Link>
        ))}
        {user && (
          <form action={logout}>
            <button type="submit" className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-stone-100">
              {logoutLabel}
            </button>
          </form>
        )}
      </div>
    </details>
  );
}
