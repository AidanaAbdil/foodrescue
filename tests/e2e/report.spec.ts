// The admin's platform report (/admin/reports). The test site charges 10% commission.
import { expect, test } from "@playwright/test";
import { createBag, createCustomer, createOwnerWithStore, createPaidOrder, db, login } from "./helpers";

test("the store table adds up sales, commission, payouts, no-shows and cancellations", async ({ page }) => {
  const name = `Отчётное кафе ${Date.now()}`;
  const { store } = await createOwnerWithStore(name);
  const customer = await createCustomer();
  await createPaidOrder(customer.id, (await createBag(store.id, { price: 1500 })).id);
  const noShow = await createPaidOrder(customer.id, (await createBag(store.id, { price: 2000, startsInHours: -3 })).id);
  await db.order.update({ where: { id: noShow.id }, data: { status: "NO_SHOW" } });
  // Cancelled by the store and refunded: not a sale, but counted as a cancellation.
  const cancelled = await createPaidOrder(customer.id, (await createBag(store.id, { price: 9000 })).id);
  await db.order.update({ where: { id: cancelled.id }, data: { status: "CANCELLED", cancelledBy: "store" } });
  await db.payment.update({ where: { orderId: cancelled.id }, data: { status: "REFUNDED", refundedAt: new Date() } });

  await login(page, "admin@example.com");
  await page.goto("/admin");
  await page.getByRole("link", { name: "📊 Отчёты" }).click();
  const row = page.locator("tr").filter({ hasText: name });
  const cells = row.locator("td");
  await expect(cells.nth(2)).toHaveText("2"); // bags sold
  await expect(cells.nth(3)).toHaveText(/3\s500\s₸/); // sales
  await expect(cells.nth(4)).toHaveText(/350\s₸/); // 10% commission
  await expect(cells.nth(5)).toHaveText(/3\s150\s₸/); // payout
  await expect(cells.nth(6)).toHaveText("1"); // no-shows
  await expect(cells.nth(7)).toHaveText("1"); // cancelled by the store

  const csv = await page.request.get("/admin/reports/export?period=month");
  expect(csv.status()).toBe(200);
  const line = (await csv.text()).split("\r\n").find((l) => l.includes(name));
  expect(line).toContain('"3500";"350";"3150";"1";"1"');
});

test("only admins can see the report", async ({ page }) => {
  await login(page, (await createOwnerWithStore()).owner.email);
  await page.goto("/admin/reports");
  await expect(page).toHaveURL("/");
  expect((await page.request.get("/admin/reports/export")).status()).toBe(401);
});
