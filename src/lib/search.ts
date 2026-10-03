// Search that understands Russian and Kazakh letters.
//
// SQLite can only lowercase English letters, so "Хлеб" wouldn't match "хлеб"
// inside the database. Instead each bag and store keeps a `searchText`
// column: its words already lowercased here in JavaScript (and ё → е, so
// "ещё" matches "еще"). Searching is then a plain "contains" in the database.
//
// Whenever a bag's title/description or a store's name/description/address
// is saved, save searchText with it (bagSearchText / storeSearchText).
import type { PrismaClient } from "@/generated/prisma/client";

export const normalize = (text: string) => text.toLowerCase().replaceAll("ё", "е");

const join = (...parts: (string | null | undefined)[]) => normalize(parts.filter(Boolean).join(" "));

export const bagSearchText = (bag: { title: string; description?: string | null }) =>
  join(bag.title, bag.description);

export const storeSearchText = (store: { name: string; description?: string | null; address: string }) =>
  join(store.name, store.description, store.address);

// The words of a search box query, ready to compare with searchText.
export const searchWords = (query: string) => normalize(query).split(/\s+/).filter(Boolean).slice(0, 8);

// Recompute every searchText (after a migration or seeding).
export async function refreshSearchText(db: PrismaClient) {
  const [bags, stores] = await Promise.all([
    db.surpriseBag.findMany({ select: { id: true, title: true, description: true } }),
    db.store.findMany({ select: { id: true, name: true, description: true, address: true } }),
  ]);
  for (const bag of bags) await db.surpriseBag.update({ where: { id: bag.id }, data: { searchText: bagSearchText(bag) } });
  for (const store of stores) await db.store.update({ where: { id: store.id }, data: { searchText: storeSearchText(store) } });
  return { bags: bags.length, stores: stores.length };
}
