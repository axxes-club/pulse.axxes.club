import { defineConfig } from "@playwright/test";
export default defineConfig({
  projects: process.env.PULSE_TEST_WEBKIT === "1" ? [{name:"chromium",use:{browserName:"chromium"}},{name:"webkit",use:{browserName:"webkit"}}] : [{name:"chromium",use:{browserName:"chromium"}}],
  testDir: "./tests/browser",
  timeout: 60000,
  workers: 1,
  expect: { timeout: 15000 },
  use: {
    baseURL: "http://localhost:4317",
    headless: true,
    launchOptions: process.env.PULSE_BROWSER_EXECUTABLE
      ? { executablePath: process.env.PULSE_BROWSER_EXECUTABLE }
      : undefined,
  },
  webServer: {
    command: "npm run dev -- --webpack --port 4317",
    url: "http://localhost:4317",
    reuseExistingServer: true,
    timeout: 120000,
  },
  reporter: "list",
});
