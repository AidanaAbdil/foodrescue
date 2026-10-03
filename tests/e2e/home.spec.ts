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

test("map view: one pin per store, same search, stores without a point counted", async ({ page }) => {
  const word = `Карта${Date.now()}`;
  const a = await createOwnerWithStore("Кафе А", { lat: 43.24, lng: 76.92 });
  const b = await createOwnerWithStore("Кафе Б", { lat: 43.25, lng: 76.95 });
  const noPoint = await createOwnerWithStore("Кафе без точки");
  for (const store of [a.store, a.store, b.store, noPoint.store]) await createBag(store.id, { title: `${word} пакет` });
  await createBag(b.store.id, { title: "Другой пакет" }); // doesn't match the search

  await page.goto(`/?q=${word}`);
  await page.getByRole("link", { name: "Карта", exact: true }).click();
  await expect(page).toHaveURL(/view=map/);
  const pins = page.locator(".leaflet-marker-icon");
  await expect(pins).toHaveCount(2);
  await expect(pins.filter({ hasText: "2" })).toHaveCount(1); // Кафе А has two matching bags
  await expect(page.getByText("Без точки на карте: 1")).toBeVisible();

  await pins.filter({ hasText: "2" }).click();
  await expect(page.locator(".leaflet-popup")).toContainText("Кафе А");
  await page.locator(".leaflet-popup").getByRole("link", { name: "Открыть →" }).click();
  await expect(page).toHaveURL(`/stores/${a.store.id}`);
});
