"use server";
// Admin actions: reviewing stores, refunds, problem reports, blocking users
// and hiding bags. Every action checks the ADMIN role first and is written to
// the activity log (/admin/log).

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { logAdmin } from "@/lib/admin-log";
import { refundForReport, storeCancelOrder } from "@/lib/payments/service";
import { notifyReportResolved } from "@/lib/push";
import { prisma } from "@/lib/prisma";
import { requireAdmin, safeReturnPath } from "@/lib/session";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
// Back to where the admin clicked (search results, the admin page…).
const back = (formData: FormData, fallback: string) => safeReturnPath(formData.get("back") || fallback);

export async function approveStore(formData: FormData) {
  const admin = await requireAdmin();
  const store = await prisma.store.findUnique({ where: { id: text(formData, "storeId") } });
  if (store) {
    await prisma.store.update({ where: { id: store.id }, data: { status: "APPROVED", rejectionReason: null, reviewedAt: new Date() } });
    await logAdmin(admin.id, "store.approve", { type: "store", id: store.id }, store.name);
  }
  refresh(); // also redraws the header count
  redirect("/admin");
}

// Reject a new store, or hide an approved one. The owner sees the reason.
export async function rejectStore(formData: FormData) {
  const admin = await requireAdmin();
  const reason = text(formData, "reason").slice(0, 500);
  if (!reason) redirect("/admin?error=reason");
  const store = await prisma.store.findUnique({ where: { id: text(formData, "storeId") } });
  if (store) {
    await prisma.store.update({ where: { id: store.id }, data: { status: "REJECTED", rejectionReason: reason, reviewedAt: new Date() } });
    await logAdmin(admin.id, "store.reject", { type: "store", id: store.id }, `${store.name}: ${reason}`);
  }
  refresh(); // also redraws the header count
  redirect("/admin");
}

export async function cancelAndRefund(formData: FormData) {
  const admin = await requireAdmin();
  const orderId = text(formData, "orderId");
  if (await storeCancelOrder(orderId, "admin")) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { pickupCode: true } });
    await logAdmin(admin.id, "order.refund", { type: "order", id: orderId }, order?.pickupCode);
  }
  refresh(); // also redraws the header count
  redirect(back(formData, "/admin#orders"));
}

// A problem report: refund the customer, or close it without a refund.
export async function resolveReport(formData: FormData) {
  const admin = await requireAdmin();
  const decision = text(formData, "decision") === "refund" ? "REFUNDED" : "CLOSED";
  const report = await prisma.problemReport.findUnique({ where: { id: text(formData, "reportId") }, include: { order: { select: { pickupCode: true } } } });
  // Only open reports, and only once (two admins clicking at the same time).
  const { count } = report
    ? await prisma.problemReport.updateMany({ where: { id: report.id, status: "OPEN" }, data: { status: decision, resolvedAt: new Date() } })
    : { count: 0 };
  if (report && count === 1) {
    if (decision === "REFUNDED") await refundForReport(report.orderId);
    await notifyReportResolved(report.orderId, decision === "REFUNDED");
    await logAdmin(admin.id, decision === "REFUNDED" ? "report.refund" : "report.close", { type: "order", id: report.orderId }, report.order.pickupCode);
  }
  refresh();
  redirect("/admin#reports");
}

// Block a customer or store owner: they're logged out everywhere and can't log
// in. A blocked owner's stores are hidden too (unblocking doesn't show them
// again: approve them on the admin page once you're sure).
export async function blockUser(formData: FormData) {
  const admin = await requireAdmin();
  const reason = text(formData, "reason").slice(0, 300);
  const user = await prisma.user.findUnique({ where: { id: text(formData, "userId") } });
  // Admins can't be blocked here (not even by mistake, yourself).
  if (reason && user && user.role !== "ADMIN" && !user.blockedAt) {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { blockedAt: new Date(), blockedReason: reason } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.store.updateMany({
        where: { ownerId: user.id, status: { not: "REJECTED" } },
        data: { status: "REJECTED", rejectionReason: reason, reviewedAt: new Date() },
      }),
    ]);
    await logAdmin(admin.id, "user.block", { type: "user", id: user.id }, `${user.email}: ${reason}`);
  }
  refresh();
  redirect(back(formData, "/admin/search"));
}

export async function unblockUser(formData: FormData) {
  const admin = await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: text(formData, "userId") } });
  if (user?.blockedAt) {
    await prisma.user.update({ where: { id: user.id }, data: { blockedAt: null, blockedReason: null } });
    await logAdmin(admin.id, "user.unblock", { type: "user", id: user.id }, user.email);
  }
  refresh();
  redirect(back(formData, "/admin/search"));
}

// Take a bag off sale for breaking the rules; the store can't put it back.
// Existing orders for it stay as they are.
export async function hideBag(formData: FormData) {
  const admin = await requireAdmin();
  const reason = text(formData, "reason").slice(0, 300);
  const bag = await prisma.surpriseBag.findUnique({ where: { id: text(formData, "bagId") }, include: { store: { select: { name: true } } } });
  if (bag && !bag.hiddenByAdminAt) {
    await prisma.surpriseBag.update({ where: { id: bag.id }, data: { isActive: false, hiddenByAdminAt: new Date() } });
    await logAdmin(admin.id, "bag.hide", { type: "bag", id: bag.id }, `${bag.title} (${bag.store.name})${reason ? `: ${reason}` : ""}`);
  }
  refresh();
  redirect(back(formData, "/admin/search"));
}

export async function unhideBag(formData: FormData) {
  const admin = await requireAdmin();
  const bag = await prisma.surpriseBag.findUnique({ where: { id: text(formData, "bagId") }, include: { store: { select: { name: true } } } });
  if (bag?.hiddenByAdminAt) {
    await prisma.surpriseBag.update({ where: { id: bag.id }, data: { isActive: true, hiddenByAdminAt: null } });
    await logAdmin(admin.id, "bag.unhide", { type: "bag", id: bag.id }, `${bag.title} (${bag.store.name})`);
  }
  refresh();
  redirect(back(formData, "/admin/search"));
}

// Partner requests: "we called them" or "closed" (not interested, duplicate…).
export async function handlePartnerRequest(formData: FormData) {
  const admin = await requireAdmin();
  const status = text(formData, "status") === "CONTACTED" ? "CONTACTED" : "CLOSED";
  const request = await prisma.partnerRequest.findUnique({ where: { id: text(formData, "requestId") } });
  if (request && request.status !== status) {
    await prisma.partnerRequest.update({ where: { id: request.id }, data: { status, handledAt: new Date() } });
    await logAdmin(admin.id, status === "CONTACTED" ? "partner.contacted" : "partner.closed", { type: "partner", id: request.id }, `${request.storeName}, ${request.phone}`);
  }
  refresh();
  redirect("/admin#partners");
}
