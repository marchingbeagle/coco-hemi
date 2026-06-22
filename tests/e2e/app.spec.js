import { expect, test } from "@playwright/test";

test("renders the editor without console errors", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");

  await expect(page.getByText("Coco Hemi")).toBeVisible();
  await expect(page.getByRole("button", { name: /enviar foto/i })).toBeVisible();
  await expect(page.locator("main.app")).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
