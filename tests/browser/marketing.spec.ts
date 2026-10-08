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
test('landing and reports reflow with doubled text on mobile and desktop',async({page})=>{
 for(const width of [390,1440]){await page.setViewportSize({width,height:1000});for(const path of ['/','/demo']){await page.goto(path);await page.evaluate(()=>{const sizes=Array.from(document.querySelectorAll<HTMLElement>('body *')).map(el=>({el,size:parseFloat(getComputedStyle(el).fontSize)}));for(const {el,size} of sizes)el.style.fontSize=`${size*2}px`});const fits=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);if(!fits)console.log('Reflow diagnostic',JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,20).map(el=>({tag:el.tagName,classes:String(el.className),text:el.textContent?.slice(0,70),width:el.getBoundingClientRect().width})))));expect(fits,`${path} at ${width}px with 200% text`).toBeTruthy()}}
});
test("pricing lists every plan, switches to annual, and reflows on a phone", async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Every feature");
    await expect(page.locator(".plan-card")).toHaveCount(6);
    await expect(page.locator(".plan-card").first()).toContainText("$5");
    await page.getByRole("radio", { name: /Annual/ }).click();
    await expect(page.locator(".plan-card").first()).toContainText("$50 billed yearly");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  await page.goto("/");
  await page.getByRole("link", { name: "Pricing", exact: true }).first().click();
  await page.waitForURL("**/pricing");
});
