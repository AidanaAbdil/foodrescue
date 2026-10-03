"use server";
// The /partners page's request form: a store asks to join; an admin calls back.

import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { isCity } from "@/lib/cities";
import { isBusinessKind } from "@/lib/partners";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { clientIp, recordAttempt, retryAfterMinutes } from "@/lib/rate-limit";

export type PartnerFormState = { errors: Record<string, string>; values: Record<string, string> } | undefined;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELDS = ["storeName", "contactName", "phone", "email", "city", "kind", "message"] as const;

export async function submitPartnerRequest(_prev: PartnerFormState, formData: FormData): Promise<PartnerFormState> {
  const values = Object.fromEntries(FIELDS.map((key) => [key, String(formData.get(key) ?? "").trim()]));
  // A hidden field people never see: only bots fill it in. Pretend it worked.
  if (String(formData.get("website") ?? "")) redirect("/partners?sent=1#request");

  const { dict, fill } = await getI18n();
  const t = dict.partners.errors;
  const ip = await clientIp();
  const wait = ip ? await retryAfterMinutes("partner", ip) : 0;
  if (wait > 0) return { errors: { form: fill(dict.errors.tooManyAttempts, { n: wait }) }, values };

  const errors: Record<string, string> = {};
  const phone = normalizePhone(values.phone);
  if (values.storeName.length < 2) errors.storeName = t.storeName;
  if (values.contactName.length < 2) errors.contactName = t.contactName;
  if (!phone) errors.phone = dict.errors.phone;
  if (values.email && !EMAIL_PATTERN.test(values.email)) errors.email = dict.errors.email;
  if (!isCity(values.city)) errors.city = dict.errors.storeCity;
  if (!isBusinessKind(values.kind)) errors.kind = t.kind;
  if (Object.keys(errors).length > 0) return { errors, values };

  await prisma.partnerRequest.create({
    data: {
      storeName: values.storeName.slice(0, 120),
      contactName: values.contactName.slice(0, 120),
      phone: phone!,
      email: values.email.toLowerCase().slice(0, 200) || null,
      city: values.city,
      kind: values.kind,
      message: values.message.slice(0, 1000) || null,
    },
  });
  if (ip) await recordAttempt("partner", ip);
  redirect("/partners?sent=1#request");
}
