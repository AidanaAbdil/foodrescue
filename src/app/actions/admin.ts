"use server";
// Admin actions: reviewing stores and refunding orders a store couldn't
// hand over. Every action checks the ADMIN role first.

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { refundForReport, storeCancelOrder } from "@/lib/payments/service";
import { notifyReportResolved } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function approveStore(formData: FormData) {
  await requireAdmin();
  await prisma.store.updateMany({
    where: { id: text(formData, "storeId") },
    data: { status: "APPROVED", rejectionReason: null, reviewedAt: new Date() },
  });
  refresh(); // also redraws the header count
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
  refresh(); // also redraws the header count
  redirect("/admin");
}

export async function cancelAndRefund(formData: FormData) {
  await requireAdmin();
  await storeCancelOrder(text(formData, "orderId"), "admin");
  refresh(); // also redraws the header count
  redirect("/admin#orders");
}

// A problem report: refund the customer, or close it without a refund.
export async function resolveReport(formData: FormData) {
  await requireAdmin();
  const decision = text(formData, "decision") === "refund" ? "REFUNDED" : "CLOSED";
  const report = await prisma.problemReport.findUnique({ where: { id: text(formData, "reportId") } });
  // Only open reports, and only once (two admins clicking at the same time).
  const { count } = report
    ? await prisma.problemReport.updateMany({ where: { id: report.id, status: "OPEN" }, data: { status: decision, resolvedAt: new Date() } })
    : { count: 0 };
  if (report && count === 1) {
    if (decision === "REFUNDED") await refundForReport(report.orderId);
    await notifyReportResolved(report.orderId, decision === "REFUNDED");
  }
  refresh();
  redirect("/admin#reports");
}
