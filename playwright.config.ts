import { defineConfig, devices } from "@playwright/test";

// Honor an outbound proxy for live CDN checks on sandboxed runners.
function proxyFromEnvironment() {
  const value = process.env.HTTPS_PROXY ?? process.env.https_proxy;
  if (!value) return undefined;
  const url = new URL(value);
  return {
    server: `${url.protocol}//${url.host}`,
    username: decodeURIComponent(url.username) || undefined,
    password: decodeURIComponent(url.password) || undefined,
    bypass: "127.0.0.1,localhost",
  };
}

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
    proxy: proxyFromEnvironment(),
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
      // Firefox needs a display for genuine WebGL; CI provides Xvfb rather
      // than counting the unavailable-WebGL fallback as a Globe test pass.
      use: { ...devices["Desktop Firefox"], headless: false },
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
