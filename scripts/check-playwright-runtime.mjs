import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { chromium, firefox, webkit } from "@playwright/test";

const require = createRequire(import.meta.url);
const version = require("@playwright/test/package.json").version;
const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
const images = [
  ...workflow.matchAll(/image: (mcr\.microsoft\.com\/playwright:\S+)/g),
].map((match) => match[1]);
const expected = `mcr.microsoft.com/playwright:v${version}-noble@sha256:`;
if (
  images.length !== 2 ||
  new Set(images).size !== 1 ||
  !images.every(
    (image) =>
      image.startsWith(expected) && /@sha256:[a-f0-9]{64}$/.test(image),
  )
)
  throw new Error(
    `Both container jobs must pin the official Playwright ${version} image by digest`,
  );

const name = process.argv[2];
const browser = { chromium, firefox, webkit }[name];
if (!browser) throw new Error("Expected chromium, firefox or webkit");
const executable = browser.executablePath();
if (!existsSync(executable))
  throw new Error(
    `Missing ${name} executable for Playwright ${version}: ${executable}`,
  );
const uid = process.getuid();
const homeOwner = statSync(homedir()).uid;
const systemUiFont = execFileSync(
  "fc-match",
  ["-f", "%{family}", "system-ui"],
  {
    encoding: "utf8",
  },
).trim();
if (uid !== homeOwner)
  throw new Error(
    `Browser process uid ${uid} must match its home owner ${homeOwner}`,
  );
if (name === "chromium") {
  // Ubuntu's hosted runner already contains Chromium's shared libraries. Check
  // the full browser (native zoom tests) and launch the real headless runtime;
  // missing libraries must fail, never silently degrade to a fallback or skip.
  const libraries = execFileSync("ldd", [executable], { encoding: "utf8" });
  if (libraries.includes("not found")) throw new Error(libraries);
  const launched = await chromium.launch();
  await launched.close();
}
console.log(
  JSON.stringify({
    image:
      process.env.PLAYWRIGHT_BROWSERS_PATH === "/ms-playwright"
        ? images[0]
        : null,
    host: process.env.GITHUB_ACTIONS ? "GitHub Actions" : "local",
    playwright: version,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    browser: name,
    executable,
    uid,
    homeOwner,
    systemUiFont,
  }),
);
