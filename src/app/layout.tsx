import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Logo } from "@/components/Logo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FoodRescue",
  description: "Rescue surplus food from local stores at a discount.",
};

// The layout wraps every page: the header and footer here appear site-wide.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla) add
          attributes to <body>; this ignores those on this one element only. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Header />

        <div className="flex-1">{children}</div>

        <footer className="mt-16 border-t border-stone-200 bg-white">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-stone-500 sm:flex-row">
            <Logo />
            <p>Good food belongs in bellies, not bins.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
