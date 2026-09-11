import {
  installAirportDirectory,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import airportDirectoryUrl from "@keepraw-fly/core/airport-directory?url";

let loadPromise: Promise<void> | undefined;

export function loadAirportDirectory(): Promise<void> {
  loadPromise ??= fetch(airportDirectoryUrl)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Airport directory request failed: ${response.status}`);
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error("Airport directory is not an array.");
      installAirportDirectory(rows as CompactAirportRow[]);
    })
    .catch((error) => {
      loadPromise = undefined;
      throw error;
    });
  return loadPromise;
}
