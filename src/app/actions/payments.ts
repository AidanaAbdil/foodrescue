"use server";
// Buttons on the test payment page. With a real provider these outcomes
// arrive from the provider instead (a webhook calling confirmPayment or
// failPayment), and this file is not used.

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { confirmPayment, failPayment } from "@/lib/payments/service";
import { requireUser } from "@/lib/session";

// Only the customer's own test payment.
async function ownTestPayment(formData: FormData) {
  const paymentId = String(formData.get("paymentId") ?? "");
  const user = await requireUser(`/pay/test/${paymentId}`);
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment || payment.provider !== "test" || payment.order.userId !== user.id) redirect("/orders");
  return payment;
}

export async function testPaySucceed(formData: FormData) {
  const payment = await ownTestPayment(formData);
  const result = await confirmPayment(payment.id);
  redirect(result === "RESERVED" ? `/orders?new=${payment.orderId}` : "/orders");
}

export async function testPayDecline(formData: FormData) {
  const payment = await ownTestPayment(formData);
  await failPayment(payment.id);
  redirect("/orders?declined=1");
}
