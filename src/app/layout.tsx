import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ConsentBanner } from "@/components/ConsentBanner";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import { siteUrl } from "@/lib/mailer";
import "./globals.css";
import { Doodle } from "@/components/Doodle";

// cyrillic-ext includes the extra Kazakh letters (ә, ғ, қ, ң, ө, ұ, ү, һ, і).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

const OG_LOCALE = { ru: "ru_KZ", kk: "kk_KZ", en: "en_US" } as const;

export async function generateMetadata(): Promise<Metadata> {
  const { locale, dict } = await getI18n();
  return {
    // Link previews need full addresses (https://…/bags/1/opengraph-image).
    metadataBase: new URL(await siteUrl()),
    openGraph: { siteName: "FoodRescue", type: "website", locale: OG_LOCALE[locale] },
    // Pages set their own title; "%s · FoodRescue" adds the brand after it.
    title: { default: dict.meta.title, template: "%s · FoodRescue" },
    description: dict.meta.description,
    // Demo site (DEMO=true): ask search engines not to list it.
    ...(process.env.DEMO === "true" && { robots: { index: false, follow: false } }),
    // Installed on an iPhone home screen: open full screen, with this name.
    appleWebApp: { capable: true, title: "FoodRescue", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff", // browser/status bar colour, matching the white header
  viewportFit: "cover", // use the whole screen on phones with a notch (see safe-area padding)
};

// The layout wraps every page: the header and footer here appear site-wide.
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dict } = await getI18n();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) add
          attributes to <body>; this ignores those on this one element only. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {/* Makes the language available to client components (useI18n). */}
        <I18nProvider locale={locale} dict={dict}>
          {process.env.DEMO === "true" && (
            <p className="bg-amber-100 px-4 pt-[env(safe-area-inset-top)] text-center text-xs font-medium leading-7 text-amber-900">
              <Doodle name="flask" size={14} className="mr-1" />{dict.footer.demo}
            </p>
          )}
          <Header />
          <ConsentBanner />

          <div className="flex-1">{children}</div>

          <ServiceWorkerRegistration />

          {/* Bottom padding: room for the iPhone home bar when installed as an app */}
          <footer className="mt-16 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-stone-500 sm:flex-row">
              <Logo />
              <p>{dict.footer.tagline}</p>
              <nav className="flex gap-4">
                <Link href="/help" className="hover:text-brand-dark hover:underline">{dict.footer.help}</Link>
                <Link href="/privacy" className="hover:text-brand-dark hover:underline">{dict.footer.privacy}</Link>
                <Link href="/terms" className="hover:text-brand-dark hover:underline">{dict.footer.terms}</Link>
              </nav>
            </div>
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
