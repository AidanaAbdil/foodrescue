// Push notifications (Web Push) to the devices a user turned them on for.
// Keys live in .env (VAPID_*). Notifications are written in the language each
// device used when it subscribed. Sending never throws: a failed notification
// must not break the order that triggered it.
import "server-only";

import webpush from "web-push";
import { isLocale } from "@/i18n/config";
import { getDictionaryFor } from "@/i18n/server";
import { fill, formatters } from "@/i18n/shared";
import { prisma } from "@/lib/prisma";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
const enabled = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(VAPID_SUBJECT ?? "mailto:admin@example.com", VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);

export const pushPublicKey = () => VAPID_PUBLIC_KEY ?? null;

type Message = { title: string; body: string; url: string; tag?: string };
type Build = (dict: ReturnType<typeof getDictionaryFor>, f: ReturnType<typeof formatters>) => Message;

// Returns how many devices accepted the notification.
export async function notifyUser(userId: string, build: Build, where: { endpoint?: string } = {}) {
  if (!enabled) return 0;
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId, ...where } });
  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      const locale = isLocale(sub.locale) ? sub.locale : "ru";
      const dict = getDictionaryFor(locale);
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(build(dict, formatters(locale, dict))),
          { TTL: 60 * 60 }, // drop it if the device stays offline for an hour
        );
        return true;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: the browser unsubscribed or the subscription expired.
        if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        else console.error("Push notification failed", status ?? error);
        return false;
      }
    }),
  );
  return results.filter(Boolean).length;
}

// "🔔 New order TX-4821 · Хлебный сюрприз × 1 · pickup Today, 18:00–20:00" to the store owner.
export async function notifyNewOrder(orderId: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { bag: { include: { store: true } } } });
    if (!order) return;
    await notifyUser(order.bag.store.ownerId, (dict, f) => ({
      title: fill(dict.push.newOrderTitle, { code: order.pickupCode }),
      body: fill(dict.push.newOrderBody, {
        bag: order.bag.title,
        n: order.quantity,
        window: f.pickupWindow(order.bag.pickupStart, order.bag.pickupEnd),
      }),
      url: "/dashboard",
      tag: order.id, // one notification per order, even if sent twice
    }));
  } catch (error) {
    console.error("New-order notification failed", error);
  }
}

// "Order TX-4821 cancelled · Bowl Bar can't hand over your order" to the customer.
export async function notifyStoreCancelled(orderId: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { bag: { include: { store: true } } } });
    if (!order) return;
    await notifyUser(order.userId, (dict) => ({
      title: fill(dict.push.cancelledTitle, { code: order.pickupCode }),
      body: fill(dict.push.cancelledBody, { store: order.bag.store.name }),
      url: "/orders",
      tag: order.id,
    }));
  } catch (error) {
    console.error("Cancellation notification failed", error);
  }
}
