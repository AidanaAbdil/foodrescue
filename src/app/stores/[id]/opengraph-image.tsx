import { getI18n } from "@/i18n/server";
import { cityName } from "@/lib/cities";
import { OG_SIZE, ogImage } from "@/lib/og";
import { prisma } from "@/lib/prisma";

// Shared store link: name, address and how many bags are on sale now.
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "FoodRescue";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [store, { dict, plural }] = await Promise.all([
    prisma.store.findUnique({
      where: { id },
      include: {
        bags: {
          where: { isActive: true, quantityAvailable: { gt: 0 }, pickupEnd: { gt: new Date() } },
          select: { imageUrl: true },
        },
      },
    }),
    getI18n(),
  ]);
  if (!store || store.status !== "APPROVED") {
    return ogImage({ eyebrow: dict.home.eyebrow, title: dict.home.title, letter: "F" });
  }
  return ogImage({
    eyebrow: cityName(dict.cities, store.city),
    title: store.name,
    lines: [store.address, store.bags.length > 0 ? plural(store.bags.length, dict.home.onSale) : dict.home.noBagsNow],
    photo: store.imageUrl ?? store.bags.find((bag) => bag.imageUrl)?.imageUrl,
    letter: store.name.charAt(0),
  });
}
