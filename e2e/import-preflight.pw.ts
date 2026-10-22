import { expect, test } from "@playwright/test";
import { openSettingsCategory } from "./helpers/settings";

for (const source of ["CSV", "Flighty"] as const) {
  test(`${source} preflight stays cancellable and replaces pending results @cross-browser`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/#settings");
    await openSettingsCategory(page, "Data and backup");

    // Observe two rendering opportunities after real row processing starts,
    // then cancel. Counting native ID allocations (forwarded unchanged) proves
    // we are inside the work, not just seeing a pending preview before its effect
    // starts or a stale pending DOM after synchronous work has finished.
    const rowCount = 2000;
    await page.evaluate(() => {
      const state = {
        generatedIds: 0,
        beats: [] as {
          generatedIds: number;
          pending: boolean;
          disabled: boolean;
          cancellable: boolean;
        }[],
        focused: false,
        cancelled: false,
      };
      Object.assign(window, { importProbe: state });
      let preview: HTMLElement | null = null;
      const randomUUID = crypto.randomUUID;
      const beat = () => {
        const cancel =
          preview?.querySelector<HTMLButtonElement>(".button-secondary");
        state.beats.push({
          generatedIds: state.generatedIds,
          pending: Boolean(
            preview?.isConnected &&
            preview.getAttribute("aria-busy") === "true",
          ),
          disabled: Boolean(
            preview?.querySelector<HTMLButtonElement>(".button-primary")
              ?.disabled,
          ),
          cancellable: Boolean(cancel && !cancel.disabled),
        });
        if (state.beats.length < 2) {
          requestAnimationFrame(beat);
          return;
        }
        crypto.randomUUID = randomUUID;
        cancel?.focus();
        state.focused = document.activeElement === cancel;
        cancel?.click();
        state.cancelled = true;
      };
      crypto.randomUUID = () => {
        const id = randomUUID.call(crypto);
        if (preview) {
          state.generatedIds++;
          if (state.generatedIds === 1) requestAnimationFrame(beat);
        }
        return id;
      };
      const observer = new MutationObserver(() => {
        preview = document.querySelector<HTMLElement>(
          '.csv-preview[aria-busy="true"]',
        );
        if (!preview) return;
        observer.disconnect();
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
        [
          headers,
          ...Array.from({ length: rowCount }, (_, i) => makeRow(i)),
        ].join("\n"),
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
            importProbe: {
              beats: {
                generatedIds: number;
                pending: boolean;
                disabled: boolean;
                cancellable: boolean;
              }[];
              focused: boolean;
            };
          }
        ).importProbe,
    );
    expect(probe.beats).toEqual([
      {
        generatedIds: expect.any(Number),
        pending: true,
        disabled: true,
        cancellable: true,
      },
      {
        generatedIds: expect.any(Number),
        pending: true,
        disabled: true,
        cancellable: true,
      },
    ]);
    // Each valid row allocates at least one native ID. A synchronous regression
    // exhausts the file before these frames, even if React has not committed its
    // completed state yet. Cancellation must happen with actual rows remaining.
    for (const beat of probe.beats) {
      expect(beat.generatedIds).toBeGreaterThan(0);
      expect(beat.generatedIds).toBeLessThan(rowCount);
    }
    expect(probe.focused).toBe(true);
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
