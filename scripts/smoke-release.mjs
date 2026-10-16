import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

// Production-only smoke: serve under TLS at / and at a Pages-like subdirectory.
const browser = await chromium.launch();
try {
  for (const url of process.argv.slice(2)) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const failures = [];
    page.on("response", (r) => {
      if (r.url().startsWith(new URL(url).origin) && r.status() >= 400)
        failures.push(`${r.status()} ${r.url()}`);
    });
    page.on("pageerror", (error) => failures.push(error.message));
    await page.goto(url, { waitUntil: "networkidle" });
    await page
      .getByRole("button", { name: /Try demo|体验演示|试用演示/i })
      .click();
    await page.waitForTimeout(1500);
    assert.equal(await page.locator("main").count(), 1);
    assert.equal(await page.evaluate(() => window.isSecureContext), true);
    await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const open = indexedDB.open("keepraw-deployment-smoke", 1);
        open.onupgradeneeded = () => open.result.createObjectStore("test");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => resolve(open.result);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction("test", "readwrite");
        tx.objectStore("test").put("persisted", "key");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    });
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      await page.evaluate(async () => {
        const db = await new Promise((resolve) => {
          const open = indexedDB.open("keepraw-deployment-smoke");
          open.onsuccess = () => resolve(open.result);
        });
        const value = await new Promise((resolve) => {
          const request = db.transaction("test").objectStore("test").get("key");
          request.onsuccess = () => resolve(request.result);
        });
        db.close();
        indexedDB.deleteDatabase("keepraw-deployment-smoke");
        return value;
      }),
      "persisted",
    );
    assert.deepEqual(failures, [], `${url}: resource/runtime errors`);
    console.log(`PASS production browser/resources/IndexedDB: ${url}`);
    await context.close();
  }
} finally {
  await browser.close();
}
