// The store's side: handing over orders, cancelling, no-shows, earnings,
// signing up a new store, and regular bags.
import { expect, test, type Page } from "@playwright/test";
import { createBag, createCustomer, createOwnerWithStore, createPaidOrder, db, login, PASSWORD } from "./helpers";

// The order's row in the dashboard's pickup list.
const orderRow = (page: Page, code: string) => page.locator("li").filter({ hasText: code });
const dashboardLink = (page: Page) => page.locator("header").getByRole("link", { name: /^Кабинет/ }).first();

test("hand over an order: marked collected, header count goes down", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore();
  const bag = await createBag(store.id);
  const order = await createPaidOrder((await createCustomer()).id, bag.id);

  await login(page, owner.email);
  await page.goto("/dashboard");
  await expect(dashboardLink(page)).toHaveText("Кабинет (1)");
  await orderRow(page, order.pickupCode).getByRole("button", { name: "✓ Выдано" }).click();

  await expect(orderRow(page, order.pickupCode)).toHaveCount(0);
  await expect(dashboardLink(page)).toHaveText("Кабинет");
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("COLLECTED");
});

test("can't hand over: refund, reason saved, customer sees an apology", async ({ page, browser }) => {
  const { owner, store } = await createOwnerWithStore("Кафе Извините");
  const bag = await createBag(store.id);
  const customer = await createCustomer();
  const order = await createPaidOrder(customer.id, bag.id);

  await login(page, owner.email);
  await page.goto("/dashboard");
  const row = orderRow(page, order.pickupCode);
  // "No" changes nothing.
  await row.getByRole("button", { name: "Не могу выдать" }).click();
  await row.getByRole("button", { name: "Нет", exact: true }).click();
  expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("RESERVED");
  // "Yes" with a reason cancels and refunds.
  await row.getByRole("button", { name: "Не могу выдать" }).click();
  await row.getByLabel("Еда закончилась").check();
  await row.getByRole("button", { name: "Да", exact: true }).click();
  await expect(orderRow(page, order.pickupCode)).toHaveCount(0);

  const after = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payment: true } });
  expect(after).toMatchObject({ status: "CANCELLED", cancelledBy: "store", cancelReason: "SOLD_OUT" });
  expect(after.payment?.status).toBe("REFUNDED");

  const customerPage = await (await browser.newContext()).newPage();
  await login(customerPage, customer.email);
  await customerPage.goto("/orders");
  await expect(customerPage.getByText(`Простите, заказ ${order.pickupCode} отменён`)).toBeVisible();
  await expect(customerPage.getByText("Причина: Еда закончилась.").first()).toBeVisible();
});

test("'didn't show up' only once pickup has started; the store keeps the money", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore();
  const customer = await createCustomer();
  const later = await createPaidOrder(customer.id, (await createBag(store.id, { startsInHours: 2 })).id);
  const started = await createPaidOrder(customer.id, (await createBag(store.id, { startsInHours: -0.5 })).id);

  await login(page, owner.email);
  await page.goto("/dashboard");
  await expect(orderRow(page, later.pickupCode).getByRole("button", { name: "Не пришёл" })).toHaveCount(0);
  const row = orderRow(page, started.pickupCode);
  await row.getByRole("button", { name: "Не пришёл" }).click();
  await row.getByRole("button", { name: "Да", exact: true }).click();
  await expect(orderRow(page, started.pickupCode)).toHaveCount(0);

  const after = await db.order.findUniqueOrThrow({ where: { id: started.id }, include: { payment: true } });
  expect(after.status).toBe("NO_SHOW");
  expect(after.payment?.status).toBe("PAID");
});

test("earnings: sold bags and revenue for this month, only this store's", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore();
  const customer = await createCustomer();
  await createPaidOrder(customer.id, (await createBag(store.id, { price: 1500, originalPrice: 5000 })).id);
  await createPaidOrder(customer.id, (await createBag(store.id, { price: 2000, originalPrice: 6000 })).id);
  // Someone else's sale must not show up here.
  const other = await createOwnerWithStore("Чужое заведение");
  await createPaidOrder(customer.id, (await createBag(other.store.id, { price: 9000, originalPrice: 20000 })).id);

  await login(page, owner.email);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "📊 Доходы" }).click();
  const stat = (label: string) => page.locator("p").filter({ hasText: label });
  await expect(stat("Продано пакетов")).toContainText("2");
  await expect(stat("Выручка")).toContainText(/3\s500\s₸/);
  await expect(stat("Спасено еды на")).toContainText(/11\s000\s₸/);

  const csv = await page.request.get("/dashboard/earnings/export?period=month");
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  expect(text.split("\r\n")).toHaveLength(3); // header + 2 orders
  expect(text).not.toContain("Чужое заведение");
});

test("new store: sign up, create store, hidden until an admin approves it", async ({ page, browser }) => {
  const email = `newstore-${Date.now()}@test.local`;
  const storeName = `Новая пекарня ${Date.now()}`;

  await page.goto("/signup");
  await page.getByText("У меня заведение").click();
  await page.locator('input[name="name"]').fill("Новый Владелец");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('input[name="consent"]').check();
  await page.getByRole("button", { name: "Создать аккаунт" }).click();
  await page.waitForURL(/\/dashboard/);

  await page.locator('input[name="name"]').fill(storeName);
  await page.locator('select[name="city"]').selectOption("ALMATY");
  await page.locator('input[name="address"]').fill("ул. Новая, 5");
  await page.locator('input[name="phone"]').fill("8 701 123 45 67");
  // Opening hours: 09:00–21:00 by default; Sunday off, Saturday shorter.
  await page.getByLabel("Указать часы работы").check();
  await page.getByLabel("Сб: закрытие").fill("18:00");
  await page.getByRole("checkbox", { name: "Вс" }).uncheck();
  await page.getByRole("button", { name: "Создать заведение" }).click();
  await expect(page.getByText(/проверк/i).first()).toBeVisible(); // "under review" notice

  const store = await db.store.findFirstOrThrow({ where: { name: storeName } });
  expect(store).toMatchObject({ status: "PENDING", phone: "+77011234567", city: "ALMATY" });
  expect(JSON.parse(store.openingHours!)).toEqual([...Array(5).fill(["09:00", "21:00"]), ["09:00", "18:00"], null]);
  await page.goto(`/?tab=stores&q=${encodeURIComponent(storeName)}`);
  await expect(page.getByText(storeName)).toHaveCount(0);

  const admin = await (await browser.newContext()).newPage();
  await login(admin, "admin@example.com");
  await admin.goto("/admin");
  await admin.locator("li").filter({ hasText: storeName }).getByRole("button", { name: "Одобрить" }).first().click();
  await expect.poll(async () => (await db.store.findUniqueOrThrow({ where: { id: store.id } })).status).toBe("APPROVED");

  await page.goto(`/?tab=stores&q=${encodeURIComponent(storeName)}`);
  await expect(page.getByText(storeName)).toBeVisible();
  await page.goto(`/stores/${store.id}`);
  await expect(page.getByText("Пн–Пт 09:00–21:00, Сб 09:00–18:00, Вс выходной")).toBeVisible();
});

test("editing a one-off bag can turn it into a regular bag", async ({ page }) => {
  const { owner, store } = await createOwnerWithStore();
  const bag = await createBag(store.id, { title: "Разовый пакет", startsInHours: 26 });

  await login(page, owner.email);
  await page.goto(`/dashboard/bags/${bag.id}/edit`);
  await page.getByRole("radio", { name: /Регулярно/ }).click();
  await expect(page.locator('input[name="weekdays"]:checked')).toHaveCount(1); // the bag's own weekday
  await page.locator("form").filter({ has: page.locator('input[name="bagId"]') }).locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard$/);

  const schedule = await db.bagSchedule.findFirstOrThrow({ where: { storeId: store.id } });
  expect(schedule.title).toBe("Разовый пакет");
  // The unordered one-off bag was replaced by the regular bag's own.
  expect(await db.surpriseBag.findUnique({ where: { id: bag.id } })).toBeNull();
});
