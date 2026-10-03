"use server";
// Customers rate an order or report a problem with it (from My orders).

import { refresh } from "next/cache";
import { canRate, canReport, isProblemKind } from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// The customer's own order (or null).
async function ownOrder(formData: FormData) {
  const user = await requireUser("/orders");
  return prisma.order.findFirst({ where: { id: text(formData, "orderId"), userId: user.id }, include: { bag: true } });
}

export async function rateOrder(formData: FormData) {
  const order = await ownOrder(formData);
  const rating = Number(formData.get("rating"));
  if (!order || !canRate(order) || !Number.isInteger(rating) || rating < 1 || rating > 5) return;
  const comment = text(formData, "comment").slice(0, 1000) || null;
  try {
    await prisma.review.create({ data: { orderId: order.id, storeId: order.bag.storeId, rating, comment } });
  } catch {
    // Already rated (one rating per order): keep the first one.
  }
  refresh();
}

export async function reportProblem(formData: FormData) {
  const order = await ownOrder(formData);
  const kind = text(formData, "kind");
  const description = text(formData, "text").slice(0, 2000);
  if (!order || !canReport(order) || !isProblemKind(kind) || description.length < 3) return;
  try {
    await prisma.problemReport.create({ data: { orderId: order.id, kind, text: description } });
  } catch {
    // Already reported (one report per order).
  }
  refresh();
}
