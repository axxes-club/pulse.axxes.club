import { test, expect } from "@playwright/test";
test("public landing connects visitors to the working demo and integration guide", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Every visit.*bigger picture/i }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Explore live demo", exact: true })
    .first()
    .click();
  await page.waitForURL("**/demo");
  await expect(page.locator(".demo-badge")).toBeVisible();
  await page.getByRole("link", { name: "Integrations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Connect your app" }),
  ).toBeVisible();
});
test("mobile landing is usable and theme preference persists", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Switch theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
