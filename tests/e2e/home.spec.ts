// The homepage: search, Bags/Stores tabs, "Show more", languages, link previews.
import { expect, test } from "@playwright/test";
import { createBag, createOwnerWithStore } from "./helpers";

const bagCards = (page: import("@playwright/test").Page) => page.locator('main a[href^="/bags/"]');

test("search ignores upper/lower case and ё/е", async ({ page }) => {
  const word = `Ёлочка${Date.now()}`;
  const { store } = await createOwnerWithStore();
  await createBag(store.id, { title: `Пакет ${word}` });

  await page.goto(`/?q=${encodeURIComponent(word.toUpperCase().replace("Ё", "Е"))}`);
  await expect(page.getByText(`Пакет ${word}`)).toBeVisible();
});

test("the Stores tab searches stores by name or street", async ({ page }) => {
  const street = `Тестовая${Date.now()}`;
  const { store } = await createOwnerWithStore(`Кофейня ${street}`);
  await page.goto(`/?tab=stores&q=${encodeURIComponent(street.toLowerCase())}`);
  await expect(page.locator(`a[href="/stores/${store.id}"]`)).toBeVisible();
  // The same search on the Bags tab finds no bags (the store has none).
  await page.getByRole("link", { name: /^Пакеты/ }).click();
  await expect(bagCards(page)).toHaveCount(0);
});

test("12 bags at a time, then 'Show more'", async ({ page }) => {
  const word = `Серия${Date.now()}`;
  const { store } = await createOwnerWithStore();
  for (let i = 1; i <= 13; i++) await createBag(store.id, { title: `${word} ${i}` });

  await page.goto(`/?q=${word}`);
  await expect(bagCards(page)).toHaveCount(12);
  await expect(page.getByText("Показано 12 из 13")).toBeVisible();
  await page.getByRole("link", { name: "Показать ещё" }).click();
  await expect(bagCards(page)).toHaveCount(13);
  await expect(page.getByRole("link", { name: "Показать ещё" })).toHaveCount(0);
});

test("Kazakh and English versions", async ({ page, context }) => {
  await context.addCookies([{ name: "locale", value: "kk", url: "http://localhost:3100" }]);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Пакеттер/ })).toBeVisible();
  await context.addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /^Bags/ })).toBeVisible();
});

test("shared bag links get a preview card", async ({ page }) => {
  const { store } = await createOwnerWithStore("Кафе для превью");
  const bag = await createBag(store.id, { title: "Пакет для превью" });

  await page.goto(`/bags/${bag.id}`);
  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toContain(`/bags/${bag.id}/opengraph-image`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Пакет для превью · Кафе для превью");
  const response = await page.request.get(image!);
  expect(response.headers()["content-type"]).toBe("image/png");
});
