// Fixed bag prices: stores pick a level; the value is at least 2× (test site defaults).
import { expect, test } from "@playwright/test";
import { createBag, createOwnerWithStore, db, login } from "./helpers";

async function fillBag(page: import("@playwright/test").Page, title: string) {
  await page.goto("/dashboard/bags/new");
  await page.locator('input[name="title"]').fill(title);
  await page.locator('input[name="quantity"]').fill("2");
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Almaty" });
  await page.locator('input[name="date"]').fill(tomorrow);
  await page.locator('input[name="start"]').fill("18:00");
  await page.locator('input[name="end"]').fill("20:00");
}

test("a store picks a price level; the value is set to at least twice the price", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore();
  await login(page, owner.email);
  await fillBag(page, "Пакет по уровню");
  await expect(page.locator('input[name="originalPrice"]')).toHaveCount(0); // no free-form prices any more
  await page.locator("label").filter({ hasText: /ценность от 2\s980/ }).click(); // 1 490 ₸
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await page.waitForURL(/\/dashboard$/);

  const bag = await db.surpriseBag.findFirstOrThrow({ where: { storeId: store.id, title: "Пакет по уровню" } });
  expect(bag.price).toBe(1490_00);
  expect(bag.originalPrice).toBe(2980_00);
});

test("a price that isn't one of the levels is refused", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore();
  await login(page, owner.email);
  await fillBag(page, "Хитрый пакет");
  // Someone edits the page to send their own price.
  await page.locator('input[name="priceLevel"]').first().evaluate((input: HTMLInputElement) => { input.value = "1234"; input.checked = true; });
  await page.getByRole("button", { name: "Опубликовать" }).click();
  await expect(page.getByText("Выберите цену пакета.")).toBeVisible();
  expect(await db.surpriseBag.count({ where: { storeId: store.id, title: "Хитрый пакет" } })).toBe(0);
});

test("editing an older bag starts on the nearest level", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore();
  const bag = await createBag(store.id, { price: 1300, originalPrice: 4000 }); // from before fixed prices
  await login(page, owner.email);
  await page.goto(`/dashboard/bags/${bag.id}/edit`);
  await expect(page.locator('input[name="priceLevel"][value="1490"]')).toBeChecked();
});
