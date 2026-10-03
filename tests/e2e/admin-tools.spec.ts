// Admin search, blocking users, hiding bags and the activity log.
import { expect, test, type Page } from "@playwright/test";
import { createBag, createCustomer, createOwnerWithStore, db, login, PASSWORD } from "./helpers";

async function adminSearch(page: Page, q: string) {
  await page.goto(`/admin/search?q=${encodeURIComponent(q)}`);
}

test("block a customer: logged out everywhere, can't log in; unblock again", async ({ page, browser }) => {
  const customer = await createCustomer();
  const customerPage = await (await browser.newContext()).newPage();
  await login(customerPage, customer.email);

  await login(page, "admin@example.com");
  await adminSearch(page, customer.email);
  const row = page.locator("li").filter({ hasText: customer.email });
  await row.getByText("Заблокировать", { exact: true }).first().click(); // opens the form
  await row.locator('input[name="reason"]').fill("Мошенничество с возвратами");
  await row.getByRole("button", { name: "Заблокировать" }).click();
  await expect(page.locator("li").filter({ hasText: customer.email }).getByText(/Заблокирован: Мошенничество/)).toBeVisible();

  // Their open session no longer works…
  await customerPage.goto("/orders");
  await expect(customerPage).toHaveURL(/\/login/);
  // …and logging in shows why.
  const form = customerPage.locator("form").filter({ has: customerPage.locator('input[name="email"]') });
  await form.locator('input[name="email"]').fill(customer.email);
  await form.locator('input[name="password"]').fill(PASSWORD);
  await form.locator('button[type="submit"]').click();
  await expect(form.getByRole("alert")).toContainText("Мошенничество с возвратами");

  await page.locator("li").filter({ hasText: customer.email }).getByRole("button", { name: "Разблокировать" }).click();
  await expect.poll(async () => (await db.user.findUniqueOrThrow({ where: { id: customer.id } })).blockedAt).toBeNull();
  await login(customerPage, customer.email);
});

test("blocking a store owner hides their stores", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore("Заведение нарушителя");
  await login(page, "admin@example.com");
  await adminSearch(page, owner.email);
  const row = page.locator("li").filter({ hasText: owner.email });
  await row.getByText("Заблокировать", { exact: true }).first().click();
  await row.locator('input[name="reason"]').fill("Продаёт просроченное");
  await row.getByRole("button", { name: "Заблокировать" }).click();
  await expect.poll(async () => (await db.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("REJECTED");
});

test("admins can't be blocked", async ({ page }) => {
  await login(page, "admin@example.com");
  await adminSearch(page, "admin@example.com");
  const row = page.locator("li").filter({ hasText: "admin@example.com" });
  await expect(row).toBeVisible();
  await expect(row.getByText("Заблокировать")).toHaveCount(0);
});

test("hide a bag: off sale, the store can't put it back; unhide", async ({ page, browser }) => {
  const title = `Сомнительный пакет ${Date.now()}`;
  const { owner, store } = await createOwnerWithStore();
  const bag = await createBag(store.id, { title });

  await login(page, "admin@example.com");
  await adminSearch(page, title);
  const row = page.locator("li").filter({ hasText: title });
  await row.getByText("Скрыть пакет", { exact: true }).first().click();
  await row.locator('input[name="reason"]').fill("Фото не соответствует");
  await row.getByRole("button", { name: "Скрыть пакет" }).click();
  await expect(page.locator("li").filter({ hasText: title }).getByText("Скрыт администрацией")).toBeVisible();
  expect((await db.surpriseBag.findUniqueOrThrow({ where: { id: bag.id } })).isActive).toBe(false);

  const ownerPage = await (await browser.newContext()).newPage();
  await login(ownerPage, owner.email);
  await ownerPage.goto("/dashboard");
  const ownerRow = ownerPage.locator("li").filter({ hasText: title });
  await expect(ownerRow.getByText("Скрыт администрацией").filter({ visible: true })).toBeVisible(); // one copy for phones, one for desktop
  await expect(ownerRow.getByRole("button", { name: "Показать" })).toHaveCount(0);

  await page.goto(`/?q=${encodeURIComponent(title)}`);
  await expect(page.getByText(title)).toHaveCount(0);

  await adminSearch(page, title);
  await page.locator("li").filter({ hasText: title }).getByRole("button", { name: "Вернуть в продажу" }).click();
  await expect.poll(async () => (await db.surpriseBag.findUniqueOrThrow({ where: { id: bag.id } })).hiddenByAdminAt).toBeNull();
});

test("the activity log lists what admins did", async ({ page }) => {
  const { store } = await createOwnerWithStore(`Логируемое ${Date.now()}`);
  await db.store.update({ where: { id: store.id }, data: { status: "PENDING" } });
  await login(page, "admin@example.com");
  await page.goto("/admin");
  await page.locator("li").filter({ hasText: store.name }).getByRole("button", { name: "Одобрить" }).first().click();
  await expect.poll(async () => (await db.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("APPROVED");

  await page.getByRole("link", { name: "Журнал", exact: true }).click();
  const entry = page.locator("li").filter({ hasText: store.name }).first();
  await expect(entry).toContainText("Заведение одобрено");
  await expect(entry).toContainText("admin@example.com");
});

test("search finds customers by name in any letter case", async ({ page }) => {
  const customer = await createCustomer(); // named "Тест Покупатель"
  await login(page, "admin@example.com");
  await adminSearch(page, "тест покупатель");
  await expect(page.locator("li").filter({ hasText: customer.email })).toBeVisible();
});
