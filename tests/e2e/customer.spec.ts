// The customer's side: ordering, paying, cancelling, refunds.
import { expect, test } from "@playwright/test";
import { buyBag, createBag, createCustomer, createOwnerWithStore, db, login } from "./helpers";

test("order and pay for a bag: code shown, stock goes down", async ({ page }) => {
  const { store } = await createOwnerWithStore();
  const bag = await createBag(store.id, { quantity: 3, price: 1200 });
  const customer = await createCustomer();

  await login(page, customer.email);
  const order = await buyBag(page, bag.id);

  expect(order.status).toBe("RESERVED");
  expect(order.payment?.status).toBe("PAID");
  expect(order.totalPrice).toBe(1200 * 100);
  await expect(page.getByText(order.pickupCode).first()).toBeVisible();
  expect((await db.surpriseBag.findUniqueOrThrow({ where: { id: bag.id } })).quantityAvailable).toBe(2);
});

test("declining the payment puts the bag back on sale", async ({ page }) => {
  const { store } = await createOwnerWithStore();
  const bag = await createBag(store.id, { quantity: 1 });
  const customer = await createCustomer();

  await login(page, customer.email);
  await page.goto(`/bags/${bag.id}`);
  await page.getByRole("button", { name: "Перейти к оплате" }).click();
  await page.waitForURL(/\/pay\/test\//);
  // While paying, the last bag is held for this customer.
  expect((await db.surpriseBag.findUniqueOrThrow({ where: { id: bag.id } })).quantityAvailable).toBe(0);
  await page.getByRole("button", { name: "Отказаться от оплаты" }).click();
  await page.waitForURL(/\/orders/);

  expect((await db.surpriseBag.findUniqueOrThrow({ where: { id: bag.id } })).quantityAvailable).toBe(1);
  const order = await db.order.findFirstOrThrow({ where: { bagId: bag.id }, include: { payment: true } });
  expect(order.status).not.toBe("RESERVED");
  expect(order.payment?.status).not.toBe("PAID");
});

test("cancelling before pickup refunds the money and returns the bag", async ({ page }) => {
  const { store } = await createOwnerWithStore();
  const bag = await createBag(store.id, { quantity: 2 });
  const customer = await createCustomer();

  await login(page, customer.email);
  const order = await buyBag(page, bag.id);
  await page.getByRole("button", { name: "Отменить бронь" }).click();
  await expect(page.getByText("Деньги возвращены.").first()).toBeVisible();

  const after = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
  expect(after.status).toBe("CANCELLED");
  expect(after.payment?.status).toBe("REFUNDED");
  expect((await db.surpriseBag.findUniqueOrThrow({ where: { id: bag.id } })).quantityAvailable).toBe(2);
});

test("no cancelling once pickup has started", async ({ page }) => {
  const { store } = await createOwnerWithStore();
  const bag = await createBag(store.id, { startsInHours: -0.5 }); // pickup started 30 minutes ago
  const customer = await createCustomer();

  await login(page, customer.email);
  await buyBag(page, bag.id);
  await expect(page.getByRole("button", { name: "Отменить бронь" })).toHaveCount(0);
});

test("the last bag can't be sold twice", async ({ page, browser }) => {
  const { store } = await createOwnerWithStore();
  const bag = await createBag(store.id, { quantity: 1 });
  const first = await createCustomer();
  const second = await createCustomer();

  await login(page, first.email);
  await buyBag(page, bag.id);

  const other = await (await browser.newContext()).newPage();
  await login(other, second.email);
  await other.goto(`/bags/${bag.id}`);
  await expect(other.getByRole("button", { name: "Перейти к оплате" })).toHaveCount(0);
  expect(await db.order.count({ where: { bagId: bag.id, status: "RESERVED" } })).toBe(1);
});

test("store accounts can't order", async ({ page }) => {
  const { store } = await createOwnerWithStore();
  const bag = await createBag(store.id);
  const { owner } = await createOwnerWithStore("Другое заведение");

  await login(page, owner.email);
  await page.goto(`/bags/${bag.id}`);
  await expect(page.getByRole("button", { name: "Перейти к оплате" })).toHaveCount(0);
});
