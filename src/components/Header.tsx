import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/session";

export async function Header() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="flex items-center gap-1 whitespace-nowrap text-sm font-medium text-stone-600 sm:gap-3">
          <Link href="/#how-it-works" className="hidden hover:text-brand md:block">
            How it works
          </Link>
          <span className="hidden items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-stone-700 sm:flex">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Springfield
          </span>

          {user ? (
            <>
              {user.role === "STORE_OWNER" && (
                <Link href="/dashboard" className="rounded-lg px-2 py-2 hover:bg-stone-100 sm:px-3 hover:text-stone-900">
                  Dashboard
                </Link>
              )}
              {/* On phones, owners only get Dashboard so the header fits. */}
              <Link
                href="/orders"
                className={`rounded-lg px-2 py-2 hover:bg-stone-100 sm:px-3 hover:text-stone-900 ${
                  user.role === "STORE_OWNER" ? "hidden sm:block" : ""
                }`}
              >
                My orders
              </Link>
              <span className="hidden items-center gap-2 text-stone-800 sm:flex">
                <span className="grid size-8 place-items-center rounded-full bg-brand-light font-bold text-brand-dark">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
              </span>
              {/* Logging out changes data, so it's a form POST, not a link. */}
              <form action={logout}>
                <button type="submit" className="whitespace-nowrap rounded-lg px-2 py-2 hover:bg-stone-100 sm:px-3 hover:text-stone-900">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-lg px-2 py-2 hover:bg-stone-100 sm:px-3 hover:text-stone-900">
                Log in
              </Link>
              <Link href="/signup" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
