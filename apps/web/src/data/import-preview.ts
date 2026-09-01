import type { KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";

export interface ImportPreviewSummary {
  flightCount: number;
  firstServiceDate?: string;
  lastServiceDate?: string;
  profileName?: string;
}

export function summarizeImport(document: KeeprawFlyDocument): ImportPreviewSummary {
  const dates = document.flights
    .map((flight) => flight.serviceDate)
    .sort((left, right) => left.localeCompare(right));

  return {
    flightCount: document.flights.length,
    ...(dates[0] ? { firstServiceDate: dates[0] } : {}),
    ...(dates.at(-1) ? { lastServiceDate: dates.at(-1) } : {}),
    ...(displayProfileName(document.profile.name)
      ? { profileName: displayProfileName(document.profile.name) }
      : {}),
  };
}

function displayProfileName(name: ProfileName | undefined): string | undefined {
  if (!name) return undefined;
  if (name.primary === "native" && name.native) return name.native;
  if (name.primary === "romanized" && name.romanized) return name.romanized;
  return name.native ?? name.romanized;
}
