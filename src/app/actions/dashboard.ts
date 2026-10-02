"use server";
// Store-owner actions. Each one checks that the store, bag or order belongs to
// the logged-in owner, because a form can be submitted with any IDs.

import { redirect } from "next/navigation";
import { isCategory } from "@/lib/categories";
import { isValidCoords } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";

export type FormState =
  | {
      errors?: Record<string, string>;
      values?: Record<string, string>; // echoed back so the form keeps what was typed
    }
  | undefined;

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// "4.99" → 499 cents, or null if it isn't a valid amount.
function parsePrice(value: string) {
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

export async function createStore(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOwner();
  const values = {
    name: text(formData, "name"),
    address: text(formData, "address"),
    city: text(formData, "city"),
    description: text(formData, "description"),
  };

  const errors: Record<string, string> = {};
  if (values.name.length < 2) errors.name = "Please enter your store's name.";
  if (values.address.length < 3) errors.address = "Please enter the street address.";
  if (values.city.length < 2) errors.city = "Please enter the city.";
  if (Object.keys(errors).length > 0) return { errors, values };

  // Optional map location from the "Use my current location" button.
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const hasLocation = formData.has("latitude") && isValidCoords(latitude, longitude);

  await prisma.store.create({
    data: {
      ...values,
      description: values.description || null,
      latitude: hasLocation ? latitude : null,
      longitude: hasLocation ? longitude : null,
      ownerId: user.id,
    },
  });
  redirect("/dashboard");
}

// Create a new bag (no bagId) or update an existing one.
export async function saveBag(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOwner();
  const bagId = text(formData, "bagId");
  const values = Object.fromEntries(
    ["storeId", "title", "description", "category", "originalPrice", "price", "quantity", "date", "start", "end"].map(
      (key) => [key, text(formData, key)],
    ),
  );

  const errors: Record<string, string> = {};

  const store = await prisma.store.findFirst({ where: { id: values.storeId, ownerId: user.id } });
  if (!store) errors.storeId = "Please choose one of your stores.";

  if (values.title.length < 3) errors.title = "Give the bag a short name.";
  const category = isCategory(values.category) ? values.category : null;
  if (!category) errors.category = "Please choose a category.";

  const originalPrice = parsePrice(values.originalPrice);
  const price = parsePrice(values.price);
  if (originalPrice === null || originalPrice <= 0) errors.originalPrice = "Enter the normal value, e.g. 15.00";
  if (price === null || price <= 0) errors.price = "Enter the price customers pay, e.g. 4.99";
  else if (originalPrice && price >= originalPrice) errors.price = "Should be lower than the normal value.";

  const quantity = Number(values.quantity);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 100) errors.quantity = "Enter a number from 0 to 100.";

  // Dates are read in the server's time zone. That's fine locally; once the
  // site is deployed we'll want to store each store's time zone.
  const pickupStart = new Date(`${values.date}T${values.start}`);
  const pickupEnd = new Date(`${values.date}T${values.end}`);
  if (Number.isNaN(pickupStart.getTime()) || Number.isNaN(pickupEnd.getTime())) {
    errors.end = "Choose a pickup date and times.";
  } else if (pickupEnd <= pickupStart) {
    errors.end = "The end time must be after the start time.";
  } else if (pickupEnd <= new Date()) {
    errors.end = "The pickup window has already ended. Pick a later time.";
  }

  let existing = null;
  if (bagId) {
    existing = await prisma.surpriseBag.findFirst({ where: { id: bagId, store: { ownerId: user.id } } });
    if (!existing) errors.form = "This bag doesn't exist or isn't yours.";
  }

  if (Object.keys(errors).length > 0) return { errors, values };

  const data = {
    storeId: values.storeId,
    title: values.title,
    description: values.description || null,
    category: category!,
    originalPrice: originalPrice!,
    price: price!,
    quantityAvailable: quantity,
    pickupStart,
    pickupEnd,
  };

  if (existing) {
    // Existing orders keep the price they paid (Order.totalPrice).
    await prisma.surpriseBag.update({ where: { id: existing.id }, data });
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
