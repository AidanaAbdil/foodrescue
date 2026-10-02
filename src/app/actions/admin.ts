"use server";
// Admin actions: reviewing stores and refunding orders a store couldn't
// hand over. Every action checks the ADMIN role first.

import { redirect } from "next/navigation";
import { storeCancelOrder } from "@/lib/payments/service";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function approveStore(formData: FormData) {
  await requireAdmin();
  await prisma.store.updateMany({
    where: { id: text(formData, "storeId") },
    data: { status: "APPROVED", rejectionReason: null, reviewedAt: new Date() },
  });
  redirect("/admin");
}

// Reject a new store, or hide an approved one. The owner sees the reason.
export async function rejectStore(formData: FormData) {
  await requireAdmin();
  const reason = text(formData, "reason").slice(0, 500);
  if (!reason) redirect("/admin?error=reason");
  await prisma.store.updateMany({
    where: { id: text(formData, "storeId") },
    data: { status: "REJECTED", rejectionReason: reason, reviewedAt: new Date() },
  });
  redirect("/admin");
}

export async function cancelAndRefund(formData: FormData) {
  await requireAdmin();
  await storeCancelOrder(text(formData, "orderId"), "admin");
  redirect("/admin#orders");
}
