import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    // Chromium owns every E2E by default, including the full responsive and
    // business regression matrices. New tests do not need a tag to run here.
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
          : undefined,
      },
    },
    // Opt in only tests with engine compatibility value: layout, SVG, native
    // storage, scrolling and focus. Do not tag entire business/viewport matrices.
    {
      name: "firefox",
      grep: /@cross-browser\b/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      grep: /@cross-browser\b/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
