import { test, expect } from "@playwright/test";
test("demo filters survive refresh and setup matches the chosen framework", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(
    page.getByRole("heading", { name: "Overview Sample" }),
  ).toBeVisible();
  await page.getByLabel("Date range").selectOption("30");
  await expect(page).toHaveURL(/range=30/);
  await page.reload();
  await expect(page.getByLabel("Date range")).toHaveValue("30");
  await page.getByRole("button", { name: /Google/ }).click();
  await expect(page).toHaveURL(/source=Google/);
  await page.getByRole("link", { name: "Integrations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connect your app" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Next.js/ }).click();
  await expect(page.locator(".installation-code pre")).toContainText(
    "import Script from 'next/script'",
  );
  await page.getByRole("button", { name: "Check connection" }).click();
  await expect(page.getByRole("status")).toContainText(
    "does not send or verify production events",
  );
});
test("mobile reporting has no page overflow and opens accessible navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Integrations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connect your app" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
