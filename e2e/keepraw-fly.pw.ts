import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fileURLToPath } from "node:url";

const exampleArchive = fileURLToPath(new URL("../examples/basic.keepraw-fly.json", import.meta.url));
const exampleCsv = fileURLToPath(new URL("../examples/flights.csv", import.meta.url));

test("creates, edits and deletes a personal flight without a JSON file", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create my archive" }).click();

  const editor = page.getByRole("dialog", { name: "Add a flight" });
  await expect(editor).toBeVisible();
  await editor.getByLabel("Airline code").fill("UA");
  await editor.getByLabel("Flight number").fill("123");
  await editor.getByRole("combobox", { name: "Origin" }).fill("SFO");
  await editor.getByRole("combobox", { name: "Destination" }).fill("LAX");
  await editor.getByRole("button", { name: "Save flight" }).click();

  await expect(page.getByRole("heading", { name: "UA123" })).toBeVisible();
  await page.getByRole("button", { name: "Edit flight" }).click();
  const editDialog = page.getByRole("dialog", { name: "Edit flight" });
  await editDialog.getByLabel("Flight number").fill("124");
  await editDialog.getByRole("button", { name: "Save flight" }).click();
  await expect(page.getByRole("heading", { name: "UA124" })).toBeVisible();

  await page.getByRole("button", { name: "Duplicate as new" }).click();
  const duplicateDialog = page.getByRole("dialog", { name: "Duplicate flight" });
  await expect(duplicateDialog.getByRole("combobox", { name: "Origin" })).toHaveValue("SFO");
  await duplicateDialog.getByLabel("Flight number").fill("125");
  await duplicateDialog.getByRole("button", { name: "Save flight" }).click();
  await expect(page.getByRole("heading", { name: "UA125" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Edit flight" }).click();
  await page.getByRole("dialog", { name: "Edit flight" })
    .getByRole("button", { name: "Delete flight" }).click();
  await expect(page.getByRole("button", { name: /Open UA124/ })).toBeVisible();
});

test("previews a JSON import and renders its Passport route map", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(exampleArchive);
  await expect(page.getByRole("region", { name: "Review before importing" })).toBeVisible();
  await expect(page.getByText("张鸿川")).toBeVisible();
  await page.getByRole("button", { name: "Import this archive" }).click();

  await expect(page.getByRole("button", { name: /Open UA123/ })).toBeVisible();
  await page.getByRole("link", { name: "Passport" }).click();
  await expect(page.getByRole("heading", { name: "张鸿川" })).toBeVisible();
  await expect(page.getByRole("img", { name: /World map showing 1 flight/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Highlights" })).toBeVisible();
});

test("maps and previews CSV columns before appending flights", async ({ page }) => {
  await page.goto("/#settings");
  await page.locator('input[type="file"][accept*=".csv"]').setInputFiles(exampleCsv);
  const preview = page.getByRole("region", { name: "Review CSV import" });
  await expect(preview).toBeVisible();
  await expect(preview.getByLabel("Flight number", { exact: true })).toHaveValue("0");
  await expect(preview.getByText("MU589")).toBeVisible();
  await preview.getByRole("button", { name: "Add 1 flight" }).click();

  await page.getByRole("link", { name: "Flights" }).click();
  await expect(page.getByRole("button", { name: /Open MU589/ })).toBeVisible();
});

test("supports dark mode, keyboard modal controls and WCAG checks", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const welcomeAudit = await new AxeBuilder({ page }).analyze();
  expect(welcomeAudit.violations).toEqual([]);
  await page.getByRole("button", { name: "Try demo" }).click();

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Appearance").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const settingsAudit = await new AxeBuilder({ page }).analyze();
  expect(settingsAudit.violations).toEqual([]);

  await page.getByRole("link", { name: "Flights" }).click();
  const addButton = page.getByRole("button", { name: "Add flight" });
  await addButton.focus();
  await addButton.click();
  const dialog = page.getByRole("dialog", { name: "Add a flight" });
  await expect(dialog).toBeVisible();
  const modalAudit = await new AxeBuilder({ page }).include(".flight-editor").analyze();
  expect(modalAudit.violations).toEqual([]);
  await dialog.getByRole("button", { name: "Save flight" }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.locator(".editor-close")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(addButton).toBeFocused();

  const archiveAudit = await new AxeBuilder({ page }).analyze();
  expect(archiveAudit.violations).toEqual([]);
});
