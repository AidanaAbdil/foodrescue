// Shared helpers for the automated tests. Tests set up what they need
// straight in the test database (test.db), then use the site like a person.
import { type Page, expect } from "@playwright/test";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../src/generated/prisma/client";
import { hashPassword } from "../../src/lib/password";
import { bagSearchText, storeSearchText } from "../../src/lib/search";

export const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:./test.db" }) });

export const PASSWORD = "password123";
const hour = 60 * 60 * 1000;
export const inHours = (hours: number) => new Date(Date.now() + hours * hour);

// A unique email for each account a test creates.
let counter = 0;
const uniqueEmail = (who: string) => `${who}-${Date.now()}-${++counter}@test.local`;
const consent = { consentAt: new Date(), consentVersion: "2026-10-02" };

export async function createCustomer() {
  return db.user.create({
    data: { email: uniqueEmail("customer"), name: "Тест Покупатель", passwordHash: await hashPassword(PASSWORD), ...consent },
  });
}

// A store owner with one approved store in Almaty.
export async function createOwnerWithStore(storeName = "Тестовая пекарня", location?: { lat: number; lng: number }) {
  const owner = await db.user.create({
    data: { email: uniqueEmail("owner"), name: "Тест Владелец", passwordHash: await hashPassword(PASSWORD), role: "STORE_OWNER", ...consent },
  });
  const fields = { name: storeName, address: "ул. Тестовая, 1", description: null };
  const store = await db.store.create({
    data: { ...fields, searchText: storeSearchText(fields), city: "ALMATY", phone: "+77270000000", status: "APPROVED", ownerId: owner.id,
      latitude: location?.lat, longitude: location?.lng },
  });
  return { owner, store };
}

export async function createBag(storeId: string, overrides: Partial<{ title: string; quantity: number; price: number; originalPrice: number; startsInHours: number }> = {}) {
  const title = overrides.title ?? `Пакет ${++counter}`;
  const start = overrides.startsInHours ?? 2;
  return db.surpriseBag.create({
    data: {
      storeId,
      title,
      searchText: bagSearchText({ title }),
      price: (overrides.price ?? 1000) * 100,
      originalPrice: (overrides.originalPrice ?? 3000) * 100,
      quantityAvailable: overrides.quantity ?? 3,
      pickupStart: inHours(start),
      pickupEnd: inHours(start + 2),
    },
  });
}

async function unusedPickupCode() {
  for (;;) {
    const code = `TS-${Math.floor(1000 + Math.random() * 9000)}`;
    if (!(await db.order.findUnique({ where: { pickupCode: code } }))) return code;
  }
}

// A paid order made "elsewhere" (as if the customer paid on their phone).
export async function createPaidOrder(customerId: string, bagId: string) {
  const bag = await db.surpriseBag.update({ where: { id: bagId }, data: { quantityAvailable: { decrement: 1 } } });
  return db.order.create({
    data: {
      userId: customerId,
      bagId,
      quantity: 1,
      totalPrice: bag.price,
      pickupCode: await unusedPickupCode(),
      status: "RESERVED",
      payment: { create: { provider: "test", amount: bag.price, status: "PAID", paidAt: new Date() } },
    },
  });
}

// A paid order with a given outcome, e.g. "COLLECTED" or "NO_SHOW".
export async function createFinishedOrder(customerId: string, bagId: string, status: "COLLECTED" | "NO_SHOW") {
  const order = await createPaidOrder(customerId, bagId);
  return db.order.update({ where: { id: order.id }, data: { status } });
}

export async function login(page: Page, email: string) {
  await page.goto("/login");
  const form = page.locator("form").filter({ has: page.locator('input[name="email"]') });
  await form.locator('input[name="email"]').fill(email);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/);
}

// Reserve a bag and pay with the test payment page. Returns the order.
export async function buyBag(page: Page, bagId: string) {
  await page.goto(`/bags/${bagId}`);
  await page.getByRole("button", { name: "Перейти к оплате" }).click();
  await page.waitForURL(/\/pay\/test\//);
  await page.getByRole("button", { name: /^Оплатить/ }).click();
  await page.waitForURL(/\/orders/);
  const order = await db.order.findFirstOrThrow({ where: { bagId }, orderBy: { createdAt: "desc" }, include: { payment: true } });
  return order;
}
