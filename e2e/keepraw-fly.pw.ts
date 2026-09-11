import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";

const exampleArchive = fileURLToPath(new URL("../examples/basic.keepraw-fly.json", import.meta.url));

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

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Edit flight" }).click();
  await page.getByRole("dialog", { name: "Edit flight" })
    .getByRole("button", { name: "Delete flight" }).click();
  await expect(page.getByRole("heading", { name: "Add your first flight" })).toBeVisible();
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
