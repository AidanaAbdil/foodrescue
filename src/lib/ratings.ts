// Stores' average ratings, for showing "★ 4.6 (12)".
import "server-only";

import { MIN_PUBLIC_REVIEWS, roundRating } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";

export type StoreRating = { average: number; count: number };

// Ratings of these stores that are public (enough reviews), by store id.
export async function publicRatings(storeIds: string[]) {
  const ids = [...new Set(storeIds)];
  const groups = ids.length
    ? await prisma.review.groupBy({ by: ["storeId"], where: { storeId: { in: ids } }, _avg: { rating: true }, _count: true })
    : [];
  return new Map<string, StoreRating>(
    groups
      .filter((group) => group._count >= MIN_PUBLIC_REVIEWS)
      .map((group) => [group.storeId, { average: roundRating(group._avg.rating ?? 0), count: group._count }]),
  );
}
