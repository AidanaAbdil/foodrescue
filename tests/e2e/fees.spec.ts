// Commission + yearly fee (25 000 ₸); the first 50 stores approved get a free year.
// (The test site charges 10% commission: see scripts/test-server.mjs.)
import { expect, test, type Page } from "@playwright/test";
import { createOwnerWithStore, db, login } from "./helpers";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function approveAsAdmin(page: Page, storeName: string) {
  await login(page, "admin@example.com");
  await page.goto("/admin");
  await page.locator("li").filter({ hasText: storeName }).getByRole("button", { name: "Одобрить" }).first().click();
}

test("approving a store gives it a founding place and a free year", async ({ page, browser }) => {
  const name = `Основатель ${Date.now()}`;
  const { owner, store } = await createOwnerWithStore(name);
  await db.store.update({ where: { id: store.id }, data: { status: "PENDING" } });

  await approveAsAdmin(page, name);
  await expect.poll(async () => (await db.store.findUniqueOrThrow({ where: { id: store.id } })).foundingNumber).not.toBeNull();
  const after = await db.store.findUniqueOrThrow({ where: { id: store.id } });
  expect(Math.abs(after.feeFreeUntil!.getTime() - (Date.now() + YEAR_MS))).toBeLessThan(3 * DAY_MS);

  const ownerPage = await (await browser.newContext()).newPage();
  await login(ownerPage, owner.email);
  await ownerPage.goto("/dashboard/earnings");
  await expect(ownerPage.getByText(`Вы партнёр №${after.foundingNumber}`)).toBeVisible();
});

test("a store whose free year ended sees a reminder; the admin records the payment", async ({ page, browser }) => {
  const name = `Должник ${Date.now()}`;
  const { owner, store } = await createOwnerWithStore(name);
  const ended = new Date(Date.now() - 2 * DAY_MS);
  await db.store.update({ where: { id: store.id }, data: { foundingNumber: null, feeFreeUntil: ended } });

  const ownerPage = await (await browser.newContext()).newPage();
  await login(ownerPage, owner.email);
  await ownerPage.goto("/dashboard");
  await expect(ownerPage.getByText(/Годовой взнос — 25\s000\s₸/)).toBeVisible();

  await login(page, "admin@example.com");
  await page.goto("/admin");
  await page.getByRole("link", { name: "Взносы", exact: true }).click();
  const row = page.locator("li").filter({ hasText: name });
  await expect(row).toContainText("Нужно оплатить");
  await row.getByRole("button", { name: "Оплачено: +1 год" }).click();
  await row.getByRole("button", { name: "Да", exact: true }).click();

  await expect.poll(async () => (await db.store.findUniqueOrThrow({ where: { id: store.id } })).feePaidUntil).not.toBeNull();
  const paid = await db.store.findUniqueOrThrow({ where: { id: store.id } });
  expect(Math.abs(paid.feePaidUntil!.getTime() - (Date.now() + YEAR_MS))).toBeLessThan(3 * DAY_MS);
  const payment = await db.membershipPayment.findFirstOrThrow({ where: { storeId: store.id } });
  expect(payment.amount).toBe(25_000_00);
  expect(await db.adminLog.count({ where: { action: "fee.paid", targetId: store.id } })).toBe(1);

  await page.goto("/admin/reports?period=month");
  await expect(page.locator("p").filter({ hasText: "Годовые взносы" })).toContainText(/25\s000\s₸/);
});

test("paying during the free year extends after it", async ({ page }) => {
  const name = `Ранняя оплата ${Date.now()}`;
  const { store } = await createOwnerWithStore(name);
  const freeUntil = new Date(Date.now() + 100 * DAY_MS);
  await db.store.update({ where: { id: store.id }, data: { feeFreeUntil: freeUntil } });

  await login(page, "admin@example.com");
  await page.goto("/admin/fees");
  const row = page.locator("li").filter({ hasText: name });
  await row.getByRole("button", { name: "Оплачено: +1 год" }).click();
  await row.getByRole("button", { name: "Да", exact: true }).click();
  await expect.poll(async () => (await db.store.findUniqueOrThrow({ where: { id: store.id } })).feePaidUntil).not.toBeNull();
  const paid = await db.store.findUniqueOrThrow({ where: { id: store.id } });
  expect(Math.abs(paid.feePaidUntil!.getTime() - (freeUntil.getTime() + YEAR_MS))).toBeLessThan(3 * DAY_MS);
});

test("the partners page shows how many founding places are left", async ({ page }) => {
  const taken = await db.store.count({ where: { foundingNumber: { not: null } } });
  await page.goto("/partners");
  await expect(page.getByText(`Осталось мест: ${50 - taken}`).first()).toBeVisible();
});

test("after 50 founding partners, new stores don't get a free year", async ({ page }) => {
  // Fill the remaining places (runs last in this file: it uses them all up).
  let next = ((await db.store.aggregate({ _max: { foundingNumber: true } }))._max.foundingNumber ?? 0) + 1;
  for (; next <= 50; next++) {
    const { store } = await createOwnerWithStore(`Заполнитель ${next}`);
    await db.store.update({ where: { id: store.id }, data: { foundingNumber: next, feeFreeUntil: new Date(Date.now() + YEAR_MS) } });
  }
  const name = `Пятьдесят первый ${Date.now()}`;
  const { store } = await createOwnerWithStore(name);
  await db.store.update({ where: { id: store.id }, data: { status: "PENDING" } });

  await approveAsAdmin(page, name);
  await expect.poll(async () => (await db.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("APPROVED");
  const after = await db.store.findUniqueOrThrow({ where: { id: store.id } });
  expect(after.foundingNumber).toBeNull();
  expect(after.feeFreeUntil).toBeNull();
});
