import { defineConfig, devices } from "@playwright/test";

// Content Security Policy journeys run against the production build (the dev
// server intentionally has no CSP because React Fast Refresh injects an
// inline preamble). Run with: pnpm test:e2e:csp [--project=...]
const port = 4174;

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
  testDir: "./e2e-csp",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: "en-US",
    trace: "retain-on-failure",
    // Honor an outbound proxy for the live font CDN check (sandboxed runners).
    proxy: proxyFromEnvironment(),
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Firefox needs a display for genuine WebGL (CI uses xvfb-run).
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], headless: false },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `pnpm build && pnpm --filter @keepraw-fly/web exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
