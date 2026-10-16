import { expect, test } from "@playwright/test";
import { openSettingsCategory } from "./helpers/settings";

for (const source of ["CSV", "Flighty"] as const) {
  test(`${source} preflight stays cancellable and replaces pending results @cross-browser`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#settings");
    await openSettingsCategory(page, "Data and backup");

    // Cancel from the page while row processing is underway. A synchronous
    // preflight prevents this timer from observing the pending preview.
    await page.evaluate(() => {
      const state = {
        beats: 0,
        pending: false,
        disabled: false,
        cancelled: false,
      };
      Object.assign(window, { importProbe: state });
      const observer = new MutationObserver(() => {
        const preview = document.querySelector<HTMLElement>(
          '.csv-preview[aria-busy="true"]',
        );
        if (!preview) return;
        observer.disconnect();
        const timer = setInterval(() => state.beats++, 0);
        setTimeout(() => {
          state.pending = preview.getAttribute("aria-busy") === "true";
          state.disabled = Boolean(
            preview.querySelector<HTMLButtonElement>(".button-primary")
              ?.disabled,
          );
          preview
            .querySelector<HTMLButtonElement>(".button-secondary")
            ?.click();
          state.cancelled = true;
          clearInterval(timer);
        }, 40);
      });
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        attributes: true,
      });
    });

    const headers =
      source === "CSV"
        ? "flightNumber,serviceDate,originIata,destinationIata,scheduledDeparture,scheduledArrival"
        : "Date,Airline,Flight,From,To,Gate Departure (Scheduled),Gate Arrival (Scheduled)";
    const makeRow = (i: number) => {
      const date = new Date(Date.UTC(2020, 0, i + 1))
        .toISOString()
        .slice(0, 10);
      return source === "CSV"
        ? `UA${i + 1},${date},JFK,LAX,${date}T09:00,${date}T12:00`
        : `${date},UA,${i + 1},JFK,LAX,${date}T09:00,${date}T12:00`;
    };
    const input = page.getByLabel(
      source === "CSV" ? "Open CSV file" : "Open Flighty CSV",
      { exact: true },
    );
    await input.setInputFiles({
      name: "large.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        [headers, ...Array.from({ length: 2000 }, (_, i) => makeRow(i))].join(
          "\n",
        ),
      ),
    });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { importProbe: { cancelled: boolean } })
              .importProbe.cancelled,
        ),
      )
      .toBe(true);
    const probe = await page.evaluate(
      () =>
        (
          window as unknown as {
            importProbe: { beats: number; pending: boolean; disabled: boolean };
          }
        ).importProbe,
    );
    expect(probe.pending).toBe(true);
    expect(probe.disabled).toBe(true);
    expect(probe.beats).toBeGreaterThan(1);
    await expect(page.locator(".csv-preview")).toHaveCount(0);

    await input.setInputFiles({
      name: "replacement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from([headers, makeRow(0)].join("\n")),
    });
    const preview = page.locator(".csv-preview");
    await expect(preview).toHaveAttribute("aria-busy", "false");
    await expect(
      preview.getByRole("button", { name: "Add 1 flight", exact: true }),
    ).toBeEnabled();
    await expect(preview.getByLabel("Import preflight summary")).toContainText(
      "Recognized1Valid1With issues0New1Possible duplicate0Existing / duplicate0",
    );
    await expect(preview).toContainText("replacement.csv");

    if (source === "CSV") {
      await preview
        .getByLabel("Flight number", { exact: true })
        .selectOption("");
      await expect(
        preview.getByRole("button", {
          name: "Resolve issues to import",
          exact: true,
        }),
      ).toBeDisabled();
      await expect(preview.getByRole("alert")).toBeVisible();
      await preview
        .getByLabel("Flight number", { exact: true })
        .selectOption("0");
      await expect(
        preview.getByRole("button", { name: "Add 1 flight", exact: true }),
      ).toBeEnabled();
    }
  });
}
