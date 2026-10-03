"use server";
// Store-owner actions. Each one checks that the store, bag or order belongs to
// the logged-in owner, because a form can be submitted with any IDs.

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getI18n } from "@/i18n/server";
import { dayKey, parseLocalDateTime, toDateInput } from "@/i18n/shared";
import { isCategory } from "@/lib/categories";
import { isCity } from "@/lib/cities";
import { parsePrice } from "@/lib/format";
import { normalizePhone } from "@/lib/phone";
import { isCancelReason } from "@/lib/orders";
import { parseHours } from "@/lib/hours";
import { notifyFavoritesAboutBag } from "@/lib/push";
import { bagSearchText, storeSearchText } from "@/lib/search";
import { serializeAllergens } from "@/lib/labels";
import { isValidCoords } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/session";
import { markNoShow, storeCancelOrder } from "@/lib/payments/service";
import { publishScheduledBags, parseWeekdays, untouchedUpcoming } from "@/lib/schedules";
import { deleteUploadIfUnused, uploadExists } from "@/lib/uploads";

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
    phone: text(formData, "phone"),
    openingHours: text(formData, "openingHours").slice(0, 400),
  };
  const t = (await getI18n()).dict.errors;
  const phone = normalizePhone(values.phone);

  const errors: Record<string, string> = {};
  if (values.name.length < 2) errors.name = t.storeName;
  if (values.address.length < 3) errors.address = t.storeAddress;
  if (!isCity(values.city)) errors.city = t.storeCity; // must be one of CITY_LIST
  if (!phone) errors.phone = t.phone;
  if (Object.keys(errors).length > 0) return { errors, values };

  // Optional map location from the "Use my current location" button.
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));
  const location = formData.has("latitude") && isValidCoords(latitude, longitude) ? { latitude, longitude } : {};
  const fields = {
    ...values,
    description: values.description || null,
    phone,
    // Only well-formed hours from the picker are kept (see src/lib/hours.ts).
    openingHours: parseHours(values.openingHours) ? values.openingHours : null,
    ...location,
  };
  const data = { ...fields, searchText: storeSearchText(fields) };

  if (storeId) {
    // updateMany with ownerId: only changes the store if it's this owner's.
    await prisma.store.updateMany({ where: { id: storeId, ownerId: user.id }, data });
    // A rejected store that's been fixed goes back into the review queue.
    await prisma.store.updateMany({
      where: { id: storeId, ownerId: user.id, status: "REJECTED" },
      data: { status: "PENDING", rejectionReason: null },
    });
  } else {
    await prisma.store.create({ data: { ...data, ownerId: user.id } });
  }
  redirect("/dashboard");
}

// Saves the bag form. Three cases:
//   - a one-off bag: new (no bagId) or edited (bagId)
//   - a new regular bag (repeat=1): creates a BagSchedule
//   - a one-off bag turned into a regular one (bagId + repeat=1)
//   - an edited regular bag (scheduleId)
export async function saveBag(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireOwner();
  const bagId = text(formData, "bagId");
  const scheduleId = text(formData, "scheduleId");
  const isSchedule = Boolean(scheduleId) || formData.get("repeat") === "1";
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
  // Weekdays for regular bags (ISO 1 = Monday … 7 = Sunday).
  const weekdays = parseWeekdays(formData.getAll("weekdays").map(String).join(","));
  Object.assign(values, {
    isHalal: labels.isHalal ? "true" : "",
    isVegetarian: labels.isVegetarian ? "true" : "",
    isVegan: labels.isVegan ? "true" : "",
    allergens: labels.allergens,
    repeat: isSchedule ? "1" : "",
    weekdays: weekdays.join(","),
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
  // Regular bags have no date: check the times against today.
  const date = isSchedule ? toDateInput(new Date()) : values.date;
  const pickupStart = parseLocalDateTime(date, values.start);
  let pickupEnd = parseLocalDateTime(date, values.end);
  // An end time before the start means "after midnight" (e.g. 22:00–01:00).
  if (pickupStart && pickupEnd && pickupEnd <= pickupStart) {
    pickupEnd = new Date(pickupEnd.getTime() + 24 * 60 * 60 * 1000);
  }
  const MAX_WINDOW_MS = 12 * 60 * 60 * 1000; // longer is almost certainly a typo
  if (!pickupStart || !pickupEnd) {
    errors.end = t.pickupMissing;
  } else if (pickupEnd.getTime() - pickupStart.getTime() > MAX_WINDOW_MS) {
    errors.end = t.pickupOrder;
  } else if (!isSchedule && pickupEnd <= new Date()) {
    errors.end = t.pickupPast;
  }
  if (isSchedule && weekdays.length === 0) errors.weekdays = t.pickDays;

  let existingBag = null;
  if (bagId) {
    existingBag = await prisma.surpriseBag.findFirst({ where: { id: bagId, store: { ownerId: user.id } } });
    if (!existingBag) errors.form = t.notYourBag;
    // A bag from a regular bag is changed through that regular bag instead.
    else if (isSchedule && existingBag.scheduleId) errors.form = t.notYourBag;
  }
  let existingSchedule = null;
  if (scheduleId) {
    existingSchedule = await prisma.bagSchedule.findFirst({ where: { id: scheduleId, store: { ownerId: user.id } } });
    if (!existingSchedule) errors.form = t.notYourBag;
  }
  const previousImage = existingBag?.imageUrl ?? existingSchedule?.imageUrl ?? null;

  // The photo must be the current one, or a file we stored via uploadBagPhoto.
  // Any other URL (another site, someone's file) is refused.
  const imageUrl = values.imageUrl || null;
  if (imageUrl && imageUrl !== previousImage && !(await uploadExists(imageUrl))) {
    errors.form ??= (await getI18n()).dict.photo.missing;
    values.imageUrl = previousImage ?? ""; // don't echo an unknown URL back into the form
  }

  if (Object.keys(errors).length > 0) return { errors, values };

  const common = {
    storeId: values.storeId,
    title: values.title,
    description: values.description || null,
    imageUrl,
    ...labels,
    category: category!,
    originalPrice: originalPrice!,
    price: price!,
  };

  if (isSchedule) {
    const scheduleData = { ...common, quantity, weekdays: weekdays.join(","), startTime: values.start, endTime: values.end };
    let id = existingSchedule?.id;
    if (existingSchedule) {
      await prisma.bagSchedule.update({ where: { id: existingSchedule.id }, data: scheduleData });
      // Upcoming bags nobody has ordered yet are re-published with the new details.
      await prisma.surpriseBag.deleteMany({ where: untouchedUpcoming(existingSchedule.id) });
    } else {
      id = (await prisma.bagSchedule.create({ data: scheduleData })).id;
    }
    if (existingBag) {
      // A one-off bag became a regular one. Nobody ordered it: the regular bag
      // replaces it. Otherwise it stays (its customers keep their orders) and
      // counts as that day's regular bag, so the day isn't published twice.
      const orders = await prisma.order.count({ where: { bagId: existingBag.id } });
      if (orders === 0) await prisma.surpriseBag.delete({ where: { id: existingBag.id } });
      else {
        await prisma.surpriseBag.update({
          where: { id: existingBag.id },
          data: { scheduleId: id, scheduleDate: dayKey(existingBag.pickupStart) },
        });
      }
    }
    await publishScheduledBags([id!]);
  } else if (existingBag) {
    // Existing orders keep the price they paid (Order.totalPrice).
    await prisma.surpriseBag.update({
      where: { id: existingBag.id },
      data: { ...common, searchText: bagSearchText(common), quantityAvailable: quantity, pickupStart: pickupStart!, pickupEnd: pickupEnd! },
    });
  } else {
    const created = await prisma.surpriseBag.create({
      data: { ...common, searchText: bagSearchText(common), quantityAvailable: quantity, pickupStart: pickupStart!, pickupEnd: pickupEnd! },
    });
    await notifyFavoritesAboutBag(created.id); // "❤️ New bag" to customers who favourited the store
  }
  // Replaced or removed the photo: delete the old file if nothing uses it now.
  if (previousImage && previousImage !== imageUrl) await deleteUploadIfUnused(previousImage);
  redirect("/dashboard");
}

// Pause a regular bag (hides its upcoming, not-yet-ordered bags) or resume it.
export async function toggleSchedule(formData: FormData) {
  const user = await requireOwner();
  const schedule = await prisma.bagSchedule.findFirst({
    where: { id: text(formData, "scheduleId"), store: { ownerId: user.id } },
  });
  if (schedule) {
    const isActive = !schedule.isActive;
    await prisma.bagSchedule.update({ where: { id: schedule.id }, data: { isActive } });
    await prisma.surpriseBag.updateMany({ where: { ...untouchedUpcoming(schedule.id), hiddenByAdminAt: null }, data: { isActive } });
    if (isActive) await publishScheduledBags([schedule.id]);
  }
  redirect("/dashboard");
}

// Delete a regular bag. Upcoming bags nobody ordered go too; bags with orders
// stay (they just stop being linked to the schedule).
export async function deleteSchedule(formData: FormData) {
  const user = await requireOwner();
  const schedule = await prisma.bagSchedule.findFirst({
    where: { id: text(formData, "scheduleId"), store: { ownerId: user.id } },
  });
  if (schedule) {
    await prisma.surpriseBag.deleteMany({ where: untouchedUpcoming(schedule.id) });
    await prisma.bagSchedule.delete({ where: { id: schedule.id } });
    await deleteUploadIfUnused(schedule.imageUrl);
  }
  redirect("/dashboard");
}

// Hide a bag from customers, or show it again.
export async function toggleBagActive(formData: FormData) {
  const user = await requireOwner();
  const bagId = text(formData, "bagId");
  // A bag hidden by the admins stays hidden.
  const bag = await prisma.surpriseBag.findFirst({ where: { id: bagId, store: { ownerId: user.id }, hiddenByAdminAt: null } });
  if (bag) await prisma.surpriseBag.update({ where: { id: bag.id }, data: { isActive: !bag.isActive } });
  redirect("/dashboard");
}

// The store can't hand over a paid order: cancel it, the customer is refunded.
export async function cantHandOver(formData: FormData) {
  const user = await requireOwner();
  const reason = text(formData, "reason");
  await storeCancelOrder(text(formData, "orderId"), "store", user.id, isCancelReason(reason) ? reason : "OTHER");
  refresh(); // also redraws the header count
  redirect("/dashboard");
}

// The customer didn't come to collect a paid order.
export async function noShow(formData: FormData) {
  const user = await requireOwner();
  await markNoShow(text(formData, "orderId"), user.id);
  refresh(); // also redraws the header count
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
  refresh(); // also redraws the header count
  redirect("/dashboard");
}

// Called directly from the dashboard's "Use my current location" button.
export async function setStoreLocation(storeId: string, latitude: number, longitude: number) {
  const user = await requireOwner();
  if (typeof storeId !== "string" || !isValidCoords(latitude, longitude)) return;
  // updateMany with ownerId: only changes the store if it's this owner's.
  await prisma.store.updateMany({ where: { id: storeId, ownerId: user.id }, data: { latitude, longitude } });
}
