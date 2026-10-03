// "Your impact": what customers rescued by picking up bags.
import "server-only";

import { prisma } from "@/lib/prisma";

// CO₂ avoided per rescued bag, in kg. An estimate (wasted food's footprint
// from growing, transport and landfill); adjust when you have a better figure.
export const CO2_KG_PER_BAG = 2.5;

// Only orders actually handed over count.
export async function customerImpact(userId: string) {
  const orders = await prisma.order.findMany({
    where: { userId, status: "COLLECTED" },
    select: { quantity: true, totalPrice: true, bag: { select: { originalPrice: true } } },
  });
  const bags = orders.reduce((sum, o) => sum + o.quantity, 0);
  return {
    bags,
    saved: orders.reduce((sum, o) => sum + o.bag.originalPrice * o.quantity - o.totalPrice, 0), // tiyn
    co2Kg: bags * CO2_KG_PER_BAG,
  };
}

// All customers together, for the homepage.
export async function communityBagsRescued() {
  const result = await prisma.order.aggregate({ where: { status: "COLLECTED" }, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}
