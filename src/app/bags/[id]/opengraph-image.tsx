import { getI18n } from "@/i18n/server";
import { cityName } from "@/lib/cities";
import { discountPercent } from "@/lib/format";
import { OG_SIZE, ogImage } from "@/lib/og";
import { prisma } from "@/lib/prisma";

// Shared bag link: photo, title, price, store and pickup time.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "FoodRescue";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bag, { dict, f }] = await Promise.all([
    prisma.surpriseBag.findUnique({ where: { id }, include: { store: true } }),
    getI18n(),
  ]);
  // Stores under review stay private, so their links get the general card.
  if (!bag || bag.store.status !== "APPROVED") {
    return ogImage({ eyebrow: dict.home.eyebrow, title: dict.home.title, letter: "F" });
  }
  return ogImage({
    eyebrow: `${bag.store.name} · ${cityName(dict.cities, bag.store.city)}`,
    title: bag.title,
    // A real date, not "Today": chat apps keep previews for days.
    lines: [`${dict.bag.pickup}: ${f.date(bag.pickupStart)}, ${f.time(bag.pickupStart)}–${f.time(bag.pickupEnd)}`, bag.store.address],
    price: f.price(bag.price),
    oldPrice: f.price(bag.originalPrice),
    badge: `−${discountPercent(bag.originalPrice, bag.price)}%`,
    photo: bag.imageUrl,
    letter: bag.store.name.charAt(0),
  });
}
