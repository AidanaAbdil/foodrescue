import type { MetadataRoute } from "next";
import { getI18n } from "@/i18n/server";

// The web app manifest: what phones use when the site is installed to the
// home screen (name, icon, colours, opening full screen without browser bars).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { locale, dict } = await getI18n();
  return {
    name: "FoodRescue",
    short_name: "FoodRescue",
    description: dict.meta.description,
    lang: locale,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf6f1", // splash screen while the app opens
    theme_color: "#ffffff",
    categories: ["food", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
