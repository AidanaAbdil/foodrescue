import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
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
  };
}

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
          <Header />

          <div className="flex-1">{children}</div>

          <footer className="mt-16 border-t border-stone-200 bg-white">
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
