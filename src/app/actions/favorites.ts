"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, safeReturnPath } from "@/lib/session";

// ♡ / ♥: add a store to the customer's favourites, or remove it.
export async function toggleFavorite(formData: FormData) {
  const back = safeReturnPath(formData.get("back"));
  const user = await requireUser(back);
  const storeId = String(formData.get("storeId") ?? "");
  // Favourites are for customer accounts, and only for live stores.
  const store = await prisma.store.findFirst({ where: { id: storeId, status: "APPROVED" } });
  if (user.role === "CUSTOMER" && store) {
    const key = { userId_storeId: { userId: user.id, storeId } };
    const existing = await prisma.favorite.findUnique({ where: key });
    if (existing) await prisma.favorite.delete({ where: key });
    else await prisma.favorite.create({ data: { userId: user.id, storeId } });
  }
  redirect(back);
}
