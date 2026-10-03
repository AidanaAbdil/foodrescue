import { getI18n } from "@/i18n/server";
import { OG_SIZE, ogImage } from "@/lib/og";

// The link preview for the homepage and any page without its own.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "FoodRescue";

export default async function Image() {
  const { dict } = await getI18n();
  return ogImage({ eyebrow: dict.home.eyebrow, title: dict.home.title, lines: [dict.meta.description], letter: "F" });
}
