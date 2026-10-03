// "Pickup starts soon" reminders (background timer) and "new bag from a favourite store".
import { expect, test } from "@playwright/test";
import { addFakePushSubscription, createBag, createCustomer, createOwnerWithStore, createPaidOrder, db, login } from "./helpers";

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
const reminderSent = async (orderId: string) => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).reminderSentAt;

test("a reminder goes out about 30 minutes before pickup, once", async () => {
  const { store } = await createOwnerWithStore();
  const customer = await createCustomer();
  const soon = await createPaidOrder(customer.id, (await createBag(store.id, { startsInHours: 20 / 60 })).id);
  await db.order.update({ where: { id: soon.id }, data: { createdAt: minutesAgo(60) } });
  const later = await createPaidOrder(customer.id, (await createBag(store.id, { startsInHours: 3 })).id);
  await db.order.update({ where: { id: later.id }, data: { createdAt: minutesAgo(60) } });
  // Ordered a moment ago: no reminder right away.
  const justOrdered = await createPaidOrder(customer.id, (await createBag(store.id, { startsInHours: 20 / 60 })).id);

  await expect.poll(() => reminderSent(soon.id), { timeout: 15_000 }).not.toBeNull();
  const first = await reminderSent(soon.id);
  await new Promise((resolve) => setTimeout(resolve, 5_000)); // a few more timer runs
  expect(await reminderSent(soon.id)).toEqual(first); // still the same single reminder
  expect(await reminderSent(later.id)).toBeNull();
  expect(await reminderSent(justOrdered.id)).toBeNull();
});

test("a new bag notifies customers who favourited the store, at most once per 12 hours", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore("Любимая пекарня");
  const fan = await createCustomer();
  await db.favorite.create({ data: { userId: fan.id, storeId: store.id } });
  await addFakePushSubscription(fan.id);
  const notifiedAt = async () => (await db.favorite.findUniqueOrThrow({ where: { userId_storeId: { userId: fan.id, storeId: store.id } } })).notifiedAt;

  await login(page, owner.email);
  const addBag = async (title: string) => {
    await page.goto("/dashboard/bags/new");
    await page.locator('input[name="title"]').fill(title);
    await page.locator("label").filter({ hasText: /ценность от 1\s980/ }).click(); // the 990 ₸ level
    await page.locator('input[name="quantity"]').fill("3");
    const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Almaty" });
    await page.locator('input[name="date"]').fill(tomorrow);
    await page.locator('input[name="start"]').fill("18:00");
    await page.locator('input[name="end"]').fill("20:00");
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await page.waitForURL(/\/dashboard$/);
  };

  await addBag("Первый пакет");
  await expect.poll(notifiedAt).not.toBeNull();
  const first = await notifiedAt();
  await addBag("Второй пакет"); // within 12 hours: no second notification
  expect(await notifiedAt()).toEqual(first);
});

test("stores get one 'pack your bags' reminder before a pickup with orders", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore("Упаковочная");
  const customer = await createCustomer();
  const soon = await createBag(store.id, { title: "Скоро выдача", startsInHours: 40 / 60 });
  await createPaidOrder(customer.id, soon.id);
  await createPaidOrder(customer.id, soon.id);
  const noOrders = await createBag(store.id, { title: "Без заказов", startsInHours: 40 / 60 });
  const later = await createBag(store.id, { title: "Вечером", startsInHours: 3 });
  await createPaidOrder(customer.id, later.id);
  const packed = async (id: string) => (await db.surpriseBag.findUniqueOrThrow({ where: { id } })).packReminderSentAt;

  await expect.poll(() => packed(soon.id), { timeout: 15_000 }).not.toBeNull();
  expect(await packed(noOrders.id)).toBeNull();
  expect(await packed(later.id)).toBeNull();

  // The dashboard lists what to pack.
  await login(page, owner.email);
  await page.goto("/dashboard");
  const toPack = page.locator("div").filter({ has: page.getByRole("heading", { name: "Собрать к выдаче" }) }).last();
  await expect(toPack).toContainText("Скоро выдача — 2 шт.");
  await expect(toPack).toContainText("Вечером — 1 шт.");
});
