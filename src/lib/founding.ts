// Founding partners: the first stores approved get a free year (src/lib/fees.ts).
import "server-only";

import { foundingFreeMonths, foundingPartners, addMonths } from "@/lib/fees";
import { prisma } from "@/lib/prisma";

// How many founding places are still open.
export async function foundingPlacesLeft() {
  const taken = await prisma.store.count({ where: { foundingNumber: { not: null } } });
  return Math.max(0, foundingPartners() - taken);
}

// Called when a store is approved for the first time: give it the next
// founding place and its free year, if any are left. A store that was ever
// given a place (or a free year) keeps what it had.
export async function claimFoundingPlace(storeId: string) {
  return prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({ where: { id: storeId } });
    if (!store || store.foundingNumber !== null || store.feeFreeUntil !== null) return null;
    const last = await tx.store.aggregate({ _max: { foundingNumber: true } });
    const number = (last._max.foundingNumber ?? 0) + 1;
    if (number > foundingPartners()) return null;
    await tx.store.update({
      where: { id: storeId },
      data: { foundingNumber: number, feeFreeUntil: addMonths(new Date(), foundingFreeMonths()) },
    });
    return number;
  });
}
