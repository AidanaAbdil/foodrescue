import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { MobileMenu } from "@/components/MobileMenu";
import { getI18n } from "@/i18n/server";
import { getCurrentUser } from "@/lib/session";

const linkClass = "rounded-lg px-3 py-2 hover:bg-stone-100 hover:text-stone-900";

export async function Header() {
  const [user, { locale, dict }] = await Promise.all([getCurrentUser(), getI18n()]);
  const t = dict.header;

  // The same links power the desktop nav and the phone menu.
  const links = [
    { href: "/#how-it-works", label: t.howItWorks },
    ...(user?.role === "STORE_OWNER" ? [{ href: "/dashboard", label: t.dashboard }] : []),
    // "My orders" is for customers; store accounts don't order.
    ...(user?.role === "CUSTOMER" ? [{ href: "/orders", label: t.myOrders }] : []),
    ...(user
      ? []
      : [
          { href: "/login", label: t.login },
          { href: "/signup", label: t.signup },
        ]),
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />

        <div className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-stone-600">
          {/* Wide screens: links inline */}
          <nav className="hidden items-center gap-1 lg:flex">
            {links
              .filter((link) => link.href !== "/signup")
              .map((link) => (
                <Link key={link.href} href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              ))}
            {user && (
              <>
                <span className="ml-2 flex items-center gap-2 text-stone-800">
                  <span className="grid size-8 place-items-center rounded-full bg-brand-light font-bold text-brand-dark">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  {user.name.split(" ")[0]}
                </span>
                {/* Logging out changes data, so it's a form POST, not a link. */}
                <form action={logout}>
                  <button type="submit" className={linkClass}>
                    {t.logout}
                  </button>
                </form>
              </>
            )}
            {!user && (
              <Link href="/signup" className="ml-1 rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark">
                {t.signup}
              </Link>
            )}
          </nav>

          <LanguageSwitcher current={locale} label={t.language} />

          {/* Phones: everything in a ☰ menu */}
          <MobileMenu
            label={t.menu}
            links={links}
            user={user ? { name: user.name } : null}
            logoutLabel={t.logout}
          />
        </div>
      </div>
    </header>
  );
}
