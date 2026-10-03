// Who may see and do what. Each test tries something it must NOT be allowed to do.
import { expect, test } from "@playwright/test";
import { createBag, createCustomer, createOwnerWithStore, createPaidOrder, db, login } from "./helpers";

const NOT_FOUND = "Страница не найдена";

test("logged out: My orders and the dashboard ask to log in", async ({ page }) => {
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/login\?next=%2Forders/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
});

test("customers can't open the dashboard, earnings or admin", async ({ page }) => {
  await login(page, (await createCustomer()).email);
  for (const path of ["/dashboard", "/dashboard/earnings", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
  }
  expect((await page.request.get("/dashboard/earnings/export")).status()).toBe(401);
  expect((await page.request.get("/dashboard/updates")).status()).toBe(401);
});

test("store owners can't open the admin page", async ({ page }) => {
  await login(page, (await createOwnerWithStore()).owner.email);
  await page.goto("/admin");
  await expect(page).toHaveURL("/");
});

test("a store owner can't edit another store's bag", async ({ page }) => {
  const mine = await createOwnerWithStore("Моё заведение");
  const theirs = await createOwnerWithStore("Чужое заведение");
  const theirBag = await createBag(theirs.store.id, { title: "Чужой пакет" });

  await login(page, mine.owner.email);
  await page.goto(`/dashboard/bags/${theirBag.id}/edit`);
  await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
});

test("a store owner doesn't see another store's orders", async ({ page }) => {
  const mine = await createOwnerWithStore("Моё заведение");
  const theirs = await createOwnerWithStore("Чужое заведение");
  const order = await createPaidOrder((await createCustomer()).id, (await createBag(theirs.store.id)).id);

  await login(page, mine.owner.email);
  await page.goto("/dashboard");
  await expect(page.getByText(order.pickupCode)).toHaveCount(0);
});

test("a store under review stays hidden from customers", async ({ page }) => {
  const { store } = await createOwnerWithStore("Заведение на проверке");
  await db.store.update({ where: { id: store.id }, data: { status: "PENDING" } });
  const bag = await createBag(store.id, { title: "Секретный пакет" });

  await login(page, (await createCustomer()).email);
  await page.goto(`/bags/${bag.id}`);
  await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
  await page.goto(`/stores/${store.id}`);
  await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
  await page.goto("/?q=Секретный");
  await expect(page.getByText("Секретный пакет")).toHaveCount(0);
});

test("wrong passwords are limited", async ({ page }) => {
  const customer = await createCustomer();
  await page.goto("/login");
  const form = page.locator("form").filter({ has: page.locator('input[name="email"]') });
  for (let i = 0; i < 6; i++) {
    await form.locator('input[name="email"]').fill(customer.email);
    await form.locator('input[name="password"]').fill(`wrong-${i}`);
    // Wait for the server's answer before the next try.
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST"),
      form.locator('button[type="submit"]').click(),
    ]);
    await expect(form.getByRole("alert")).toBeVisible();
  }
  // After 5 wrong tries, even the right password is refused for a while.
  await expect(form.getByRole("alert")).toContainText(/мин/);
});
