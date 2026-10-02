"use server";
// Store-owner actions. Each one checks that the store, bag or order belongs to
// the logged-in owner, because a form can be submitted with any IDs.

import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { parseLocalDateTime } from "@/i18n/shared";
import { isCategory } from "@/lib/categories";
import { parsePrice } from "@/lib/format";
import { serializeAllergens } from "@/lib/labels";
import { isValidCoords } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { deleteUpload, uploadExists } from "@/lib/uploads";

export type FormState =
  | {
      errors?: Record<string, string>;
      values?: Record<string, string>; // echoed back so the form keeps what was typed
    }
  | undefined;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Create a store (no storeId) or update one of the owner's stores.
export async function saveStore(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOwner();
  const storeId = text(formData, "storeId");
  const values = {
    name: text(formData, "name"),
    address: text(formData, "address"),
    city: text(formData, "city"),
    description: text(formData, "description"),
  };
  const t = (await getI18n()).dict.errors;

  const errors: Record<string, string> = {};
  if (values.name.length < 2) errors.name = t.storeName;
  if (values.address.length < 3) errors.address = t.storeAddress;
  if (values.city.length < 2) errors.city = t.storeCity;
  if (Object.keys(errors).length > 0) return { errors, values };

  // Optional map location from the "Use my current location" button.
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const location = formData.has("latitude") && isValidCoords(latitude, longitude) ? { latitude, longitude } : {};
  const data = { ...values, description: values.description || null, ...location };

  if (storeId) {
    // updateMany with ownerId: only changes the store if it's this owner's.
    await prisma.store.updateMany({ where: { id: storeId, ownerId: user.id }, data });
  } else {
    await prisma.store.create({ data: { ...data, ownerId: user.id } });
  }
  redirect("/dashboard");
}

// Create a new bag (no bagId) or update an existing one.
export async function saveBag(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOwner();
  const bagId = text(formData, "bagId");
  const values = Object.fromEntries(
    ["storeId", "title", "description", "category", "originalPrice", "price", "quantity", "date", "start", "end", "imageUrl"].map(
      (key) => [key, text(formData, key)],
    ),
  );
  // Food labels (checkboxes). Vegan always counts as vegetarian.
  const isVegan = formData.get("isVegan") === "true";
  const labels = {
    isHalal: formData.get("isHalal") === "true",
    isVegetarian: isVegan || formData.get("isVegetarian") === "true",
    isVegan,
    allergens: serializeAllergens(formData.getAll("allergens").map(String)),
  };
  Object.assign(values, {
    isHalal: labels.isHalal ? "true" : "",
    isVegetarian: labels.isVegetarian ? "true" : "",
    isVegan: labels.isVegan ? "true" : "",
    allergens: labels.allergens,
  });

  const t = (await getI18n()).dict.errors;
  const errors: Record<string, string> = {};

  const store = await prisma.store.findFirst({ where: { id: values.storeId, ownerId: user.id } });
  if (!store) errors.storeId = t.chooseStore;

  if (values.title.length < 3) errors.title = t.bagTitle;
  const category = isCategory(values.category) ? values.category : null;
  if (!category) errors.category = t.category;

  // Prices are typed in tenge and stored in tiyn (see parsePrice).
  const originalPrice = parsePrice(values.originalPrice);
  const price = parsePrice(values.price);
  if (originalPrice === null || originalPrice <= 0) errors.originalPrice = t.originalPrice;
  if (price === null || price <= 0) errors.price = t.price;
  else if (originalPrice && price >= originalPrice) errors.price = t.priceTooHigh;

  const quantity = Number(values.quantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) errors.quantity = t.quantity;

  // The times are Kazakhstan time (UTC+5), whatever the server's clock says.
  const pickupStart = parseLocalDateTime(values.date, values.start);
  let pickupEnd = parseLocalDateTime(values.date, values.end);
  // An end time before the start means "after midnight" (e.g. 22:00–01:00).
  if (pickupStart && pickupEnd && pickupEnd <= pickupStart) {
    pickupEnd = new Date(pickupEnd.getTime() + 24 * 60 * 60 * 1000);
  }
  const MAX_WINDOW_MS = 12 * 60 * 60 * 1000; // longer is almost certainly a typo
  if (!pickupStart || !pickupEnd) {
    errors.end = t.pickupMissing;
  } else if (pickupEnd.getTime() - pickupStart.getTime() > MAX_WINDOW_MS) {
    errors.end = t.pickupOrder;
  } else if (pickupEnd <= new Date()) {
    errors.end = t.pickupPast;
  }

  let existing = null;
  if (bagId) {
    existing = await prisma.surpriseBag.findFirst({ where: { id: bagId, store: { ownerId: user.id } } });
    if (!existing) errors.form = t.notYourBag;
  }

  // The photo must be the bag's current one, or a file we stored via
  // uploadBagPhoto. Any other URL (another site, someone's file) is refused.
  const imageUrl = values.imageUrl || null;
  if (imageUrl && imageUrl !== existing?.imageUrl && !(await uploadExists(imageUrl))) {
    errors.form ??= (await getI18n()).dict.photo.missing;
    values.imageUrl = existing?.imageUrl ?? ""; // don't echo an unknown URL back into the form
  }

  if (Object.keys(errors).length > 0) return { errors, values };

  const data = {
    storeId: values.storeId,
    title: values.title,
    description: values.description || null,
    imageUrl,
    ...labels,
    category: category!,
    originalPrice: originalPrice!,
    price: price!,
    quantityAvailable: quantity,
    pickupStart: pickupStart!,
    pickupEnd: pickupEnd!,
  };

  if (existing) {
    // Existing orders keep the price they paid (Order.totalPrice).
    await prisma.surpriseBag.update({ where: { id: existing.id }, data });
    // Replaced or removed the photo: delete the old file (if it was an upload).
    if (existing.imageUrl !== imageUrl) await deleteUpload(existing.imageUrl);
  } else {
    await prisma.surpriseBag.create({ data });
  }
  redirect("/dashboard");
}

// Hide a bag from customers, or show it again.
export async function toggleBagActive(formData: FormData) {
  const user = await requireOwner();
  const bagId = text(formData, "bagId");
  const bag = await prisma.surpriseBag.findFirst({ where: { id: bagId, store: { ownerId: user.id } } });
  if (bag) await prisma.surpriseBag.update({ where: { id: bag.id }, data: { isActive: !bag.isActive } });
  redirect("/dashboard");
}

// The customer showed their code at the counter.
export async function markCollected(formData: FormData) {
  const user = await requireOwner();
  const orderId = text(formData, "orderId");
  // One update with all conditions: must be this owner's order, still reserved.
  await prisma.order.updateMany({
    where: { id: orderId, status: "RESERVED", bag: { store: { ownerId: user.id } } },
    data: { status: "COLLECTED" },
  });
  redirect("/dashboard");
}

// Called directly from the dashboard's "Use my current location" button.
export async function setStoreLocation(storeId: string, latitude: number, longitude: number) {
  const user = await requireOwner();
  if (typeof storeId !== "string" || !isValidCoords(latitude, longitude)) return;
  // updateMany with ownerId: only changes the store if it's this owner's.
  await prisma.store.updateMany({ where: { id: storeId, ownerId: user.id }, data: { latitude, longitude } });
}
