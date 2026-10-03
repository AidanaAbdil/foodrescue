// "Your impact": what customers rescued by picking up bags.
import "server-only";

import { prisma } from "@/lib/prisma";

// No CO₂ figure on purpose: without knowing how much food a bag holds (and
// what kind), any number would be a guess. Add it back with a sourced method,
// e.g. stores entering bag weight × a published emission factor.

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
  };
}

// All customers together, for the homepage.
export async function communityBagsRescued() {
  const result = await prisma.order.aggregate({ where: { status: "COLLECTED" }, _sum: { quantity: true } });
  return result._sum.quantity ?? 0;
}
