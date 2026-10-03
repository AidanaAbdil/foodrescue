// Ratings after pickup and "report a problem", including the admin's decision.
import { expect, test } from "@playwright/test";
import { createBag, createCustomer, createFinishedOrder, createOwnerWithStore, createPaidOrder, db, login } from "./helpers";

test("rate a collected order; the store sees the comment", async ({ page, browser }) => {
  const { owner, store } = await createOwnerWithStore("Кафе с отзывами");
  const customer = await createCustomer();
  const title = `Булочки ${Date.now()}`;
  const order = await createFinishedOrder(customer.id, (await createBag(store.id, { title, startsInHours: -3 })).id, "COLLECTED");

  await login(page, customer.email);
  await page.goto("/orders");
  // Past orders don't show the pickup code: find the card by the bag's name.
  const card = page.locator("li").filter({ hasText: title });
  await card.locator("label").filter({ hasText: "4 из 5" }).click();
  await card.locator('textarea[name="comment"]').fill("Очень вкусные булочки!");
  await card.getByRole("button", { name: "Отправить" }).click();
  await expect(card.getByText("Ваша оценка:")).toBeVisible();

  const review = await db.review.findUniqueOrThrow({ where: { orderId: order.id } });
  expect(review).toMatchObject({ rating: 4, comment: "Очень вкусные булочки!", storeId: store.id });

  const ownerPage = await (await browser.newContext()).newPage();
  await login(ownerPage, owner.email);
  await ownerPage.goto("/dashboard");
  await expect(ownerPage.getByText("Очень вкусные булочки!")).toBeVisible();
});

test("orders not handed over can't be rated", async ({ page }) => {
  const { store } = await createOwnerWithStore();
  const customer = await createCustomer();
  const upcoming = await createPaidOrder(customer.id, (await createBag(store.id)).id); // upcoming orders do show their code

  await login(page, customer.email);
  await page.goto("/orders");
  await expect(page.locator("li").filter({ hasText: upcoming.pickupCode }).getByText("Как всё прошло?")).toHaveCount(0);
});

test("the public rating appears only after 3 ratings", async ({ page }) => {
  const { store } = await createOwnerWithStore("Кафе со звёздами");
  const customer = await createCustomer();
  for (const rating of [5, 4]) {
    const order = await createFinishedOrder(customer.id, (await createBag(store.id, { startsInHours: -3 })).id, "COLLECTED");
    await db.review.create({ data: { orderId: order.id, storeId: store.id, rating } });
  }
  await page.goto(`/stores/${store.id}`);
  await expect(page.locator("main").getByText("(2)")).toHaveCount(0);

  const third = await createFinishedOrder(customer.id, (await createBag(store.id, { startsInHours: -3 })).id, "COLLECTED");
  await db.review.create({ data: { orderId: third.id, storeId: store.id, rating: 3 } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Кафе со звёздами" }).locator("..").getByText(/4,0\s*\(3\)/)).toBeVisible();
});

test("report a problem → admin refunds → customer sees it", async ({ page, browser }) => {
  const { store } = await createOwnerWithStore();
  const customer = await createCustomer();
  // The store marked "didn't show up", but the customer says the store was closed.
  const title = `Закрытая дверь ${Date.now()}`;
  const order = await createFinishedOrder(customer.id, (await createBag(store.id, { title, startsInHours: -3 })).id, "NO_SHOW");

  await login(page, customer.email);
  await page.goto("/orders");
  const card = page.locator("li").filter({ hasText: title });
  await card.getByRole("button", { name: "Сообщить о проблеме" }).click();
  await card.getByLabel("Заведение было закрыто или не выдало заказ").check();
  await card.locator('textarea[name="text"]').fill("Пришёл в 19:30, дверь была закрыта.");
  await card.getByRole("button", { name: "Отправить жалобу" }).click();
  await expect(card.getByText("Жалоба отправлена.", { exact: false })).toBeVisible();

  const admin = await (await browser.newContext()).newPage();
  await login(admin, "admin@example.com");
  await expect(admin.locator("header").getByRole("link", { name: /^Админ \(\d+\)/ }).first()).toBeVisible();
  await admin.goto("/admin");
  const report = admin.locator("#reports li").filter({ hasText: order.pickupCode });
  await expect(report.getByText("Пришёл в 19:30, дверь была закрыта.")).toBeVisible();
  await report.getByRole("button", { name: /^Вернуть деньги/ }).click();
  await expect(admin.locator("#reports li").filter({ hasText: order.pickupCode }).getByRole("button")).toHaveCount(0);

  const after = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true, report: true } });
  expect(after.report?.status).toBe("REFUNDED");
  expect(after.payment?.status).toBe("REFUNDED");

  await page.reload();
  await expect(card.getByText("деньги возвращаются полностью")).toBeVisible();
});

test("admin can close a report without a refund", async ({ page, browser }) => {
  const { store } = await createOwnerWithStore();
  const customer = await createCustomer();
  const title = `Чёрствый хлеб ${Date.now()}`;
  const order = await createFinishedOrder(customer.id, (await createBag(store.id, { title, startsInHours: -3 })).id, "COLLECTED");
  await db.problemReport.create({ data: { orderId: order.id, kind: "QUALITY", text: "Хлеб был чёрствый" } });

  const admin = await (await browser.newContext()).newPage();
  await login(admin, "admin@example.com");
  await admin.goto("/admin");
  await admin.locator("#reports li").filter({ hasText: order.pickupCode }).getByRole("button", { name: "Закрыть без возврата" }).click();
  await expect.poll(async () => (await db.problemReport.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe("CLOSED");
  expect((await db.payment.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe("PAID");

  await login(page, customer.email);
  await page.goto("/orders");
  await expect(page.locator("li").filter({ hasText: title }).getByText("Жалоба рассмотрена.")).toBeVisible();
});
