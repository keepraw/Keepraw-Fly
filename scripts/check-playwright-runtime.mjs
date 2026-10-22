import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium, firefox, webkit } from "@playwright/test";

const require = createRequire(import.meta.url);
const version = require("@playwright/test/package.json").version;
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const images = [
  ...workflow.matchAll(/image: (mcr\.microsoft\.com\/playwright:\S+)/g),
].map((match) => match[1]);
const expected = `mcr.microsoft.com/playwright:v${version}-noble@sha256:`;
if (
  images.length !== 3 ||
  new Set(images).size !== 1 ||
  !images.every(
    (image) =>
      image.startsWith(expected) && /@sha256:[a-f0-9]{64}$/.test(image),
  )
)
  throw new Error(
    `All three browser jobs must pin the official Playwright ${version} image by digest`,
  );

const name = process.argv[2];
const browser = { chromium, firefox, webkit }[name];
if (!browser) throw new Error("Expected chromium, firefox or webkit");
const executable = browser.executablePath();
if (!existsSync(executable))
  throw new Error(
    `Missing ${name} executable for Playwright ${version}: ${executable}`,
  );
console.log(
  JSON.stringify({
    image: images[0],
    playwright: version,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    browser: name,
    executable,
  }),
);
