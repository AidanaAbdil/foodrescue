// "Your impact" in My orders, and the community total on the homepage.
import { expect, test } from "@playwright/test";
import { createBag, createCustomer, createFinishedOrder, createOwnerWithStore, createPaidOrder, db, login } from "./helpers";

test("a customer's impact counts only bags actually picked up", async ({ page }) => {
  const { store } = await createOwnerWithStore();
  const customer = await createCustomer();
  // Two collected bags: each 1 000 ₸ instead of 3 000 ₸ → 4 000 ₸ saved.
  for (let i = 0; i < 2; i++) {
    await createFinishedOrder(customer.id, (await createBag(store.id, { price: 1000, originalPrice: 3000, startsInHours: -3 })).id, "COLLECTED");
  }
  // Not picked up yet: doesn't count.
  await createPaidOrder(customer.id, (await createBag(store.id)).id);

  await login(page, customer.email);
  await page.goto("/orders");
  const card = page.locator("section").filter({ hasText: "Ваш вклад" });
  await expect(card.locator("p").filter({ hasText: "Спасено пакетов" })).toContainText("2");
  await expect(card.locator("p").filter({ hasText: "Сэкономлено" })).toContainText(/4\s000\s₸/);
  await expect(card.locator("p").filter({ hasText: "Меньше выбросов" })).toContainText("≈ 5 кг");
});

test("no impact card before the first pickup", async ({ page }) => {
  await login(page, (await createCustomer()).email);
  await page.goto("/orders");
  await expect(page.getByText("Ваш вклад")).toHaveCount(0);
});

test("the homepage shows how many bags everyone rescued", async ({ page }) => {
  const total = async () => (await db.order.aggregate({ where: { status: "COLLECTED" }, _sum: { quantity: true } }))._sum.quantity ?? 0;
  const { store } = await createOwnerWithStore();
  await createFinishedOrder((await createCustomer()).id, (await createBag(store.id, { startsInHours: -3 })).id, "COLLECTED");

  await page.goto("/");
  await expect(page.locator("p").filter({ hasText: "Уже спасено пакетов" })).toContainText(String(await total()));
});
