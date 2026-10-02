"use server";

import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

type BrowserSubscription = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

// Remember this device for push notifications (in the current language).
export async function savePushSubscription(sub: BrowserSubscription) {
  const user = await requireUser("/dashboard");
  const { endpoint, keys } = sub ?? {};
  if (!endpoint?.startsWith("https://") || !keys?.p256dh || !keys?.auth) return false;
  const locale = await getLocale();
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, locale, userId: user.id },
    update: { p256dh: keys.p256dh, auth: keys.auth, locale, userId: user.id },
  });
  return true;
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser("/dashboard");
  await prisma.pushSubscription.deleteMany({ where: { endpoint: String(endpoint), userId: user.id } });
}
