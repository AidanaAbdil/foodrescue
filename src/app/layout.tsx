import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import "./globals.css";

// cyrillic-ext includes the extra Kazakh letters (ә, ғ, қ, ң, ө, ұ, ү, һ, і).
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return {
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
              🧪 {dict.footer.demo}
            </p>
          )}
          <Header />

          <div className="flex-1">{children}</div>

          <ServiceWorkerRegistration />

          {/* Bottom padding: room for the iPhone home bar when installed as an app */}
          <footer className="mt-16 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-stone-500 sm:flex-row">
              <Logo />
              <p>{dict.footer.tagline}</p>
            </div>
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
