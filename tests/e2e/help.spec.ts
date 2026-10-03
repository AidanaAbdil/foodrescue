// The help page: real rules in the answers, reachable from the footer.
import { expect, test } from "@playwright/test";

test("the help page answers with the site's real prices and rules", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer").getByRole("link", { name: "Помощь" }).click();
  await expect(page).toHaveURL("/help");
  await expect(page.getByRole("heading", { name: "Помощь", level: 1 })).toBeVisible();

  await page.getByText("Сколько стоит пакет?").click();
  await expect(page.getByText(/Цены фиксированные: 990\s₸, 1\s990\s₸, 2\s990\s₸, 3\s990\s₸/)).toBeVisible();
  await page.getByText("С пакетом что-то не так").click();
  await expect(page.getByText(/В течение 7 дней/)).toBeVisible();

  // No contact details configured on the test site: the contact box stays hidden.
  await expect(page.getByText("Не нашли ответ?")).toHaveCount(0);
  await page.getByRole("link", { name: /Ответы для заведений/ }).click();
  await expect(page).toHaveURL("/partners");
});
