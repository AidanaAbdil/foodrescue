// "For businesses" page: the request form, and the admin's list of requests.
import { expect, test } from "@playwright/test";
import { db, login } from "./helpers";

test("a store sends a request; the admin sees it, calls and marks it", async ({ page, browser }) => {
  const name = `Пекарня-заявка ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("link", { name: "Стать партнёром →" }).click();
  await expect(page).toHaveURL("/partners");

  await page.locator('input[name="storeName"]').fill(name);
  await page.locator('input[name="contactName"]').fill("Гульнара");
  await page.locator('input[name="phone"]').fill("8 (701) 555 12 34");
  await page.locator('select[name="city"]').selectOption("ASTANA");
  await page.locator('select[name="kind"]').selectOption("BAKERY");
  await page.locator('textarea[name="message"]').fill("Остаётся 10–15 булок в день");
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText("Спасибо! Заявка отправлена")).toBeVisible();

  const request = await db.partnerRequest.findFirstOrThrow({ where: { storeName: name } });
  expect(request).toMatchObject({ phone: "+77015551234", city: "ASTANA", kind: "BAKERY", status: "NEW" });

  const admin = await (await browser.newContext()).newPage();
  await login(admin, "admin@example.com");
  await expect(admin.locator("header").getByRole("link", { name: /^Админ \(\d+\)/ }).first()).toBeVisible();
  await admin.goto("/admin");
  const row = admin.locator("#partners li").filter({ hasText: name });
  await expect(row.getByRole("link", { name: /701/ })).toHaveAttribute("href", "tel:+77015551234");
  await expect(row).toContainText("Остаётся 10–15 булок в день");
  await row.getByRole("button", { name: "Связались" }).click();
  await expect.poll(async () => (await db.partnerRequest.findUniqueOrThrow({ where: { id: request.id } })).status).toBe("CONTACTED");
  expect(await db.adminLog.count({ where: { action: "partner.contacted", targetId: request.id } })).toBe(1);
});

test("the form explains what's missing and saves nothing", async ({ page }) => {
  const before = await db.partnerRequest.count();
  await page.goto("/partners");
  await page.locator('input[name="storeName"]').fill("Я");
  await page.locator('input[name="contactName"]').fill("Б");
  await page.locator('input[name="phone"]').fill("123");
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText("Укажите название заведения.")).toBeVisible();
  await expect(page.getByText("Укажите ваше имя.")).toBeVisible();
  expect(await db.partnerRequest.count()).toBe(before);
});

test("bots that fill the hidden field are ignored", async ({ page }) => {
  const before = await db.partnerRequest.count();
  await page.goto("/partners");
  await page.locator('input[name="storeName"]').fill("Спам-бот");
  await page.locator('input[name="contactName"]').fill("Бот");
  await page.locator('input[name="phone"]').fill("+7 701 000 00 00");
  await page.locator('input[name="website"]').evaluate((input: HTMLInputElement) => (input.value = "http://spam.example"));
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  await expect(page.getByText("Спасибо! Заявка отправлена")).toBeVisible(); // looks fine to the bot…
  expect(await db.partnerRequest.count()).toBe(before); // …but nothing was saved
});

test("'Sign up right away' opens sign-up with the business option chosen", async ({ page }) => {
  await page.goto("/partners");
  await page.getByRole("link", { name: "Зарегистрироваться сразу" }).first().click();
  await expect(page).toHaveURL(/\/signup\?as=store/);
  await expect(page.locator('input[name="role"][value="STORE_OWNER"]')).toBeChecked();
});
