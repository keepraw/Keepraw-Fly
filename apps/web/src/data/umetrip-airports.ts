import {
  airportByIata,
  airports,
  assignmentDateRelation,
  airportById,
  formalAssignments,
  formalHistoricalNames,
} from "@keepraw-fly/core";

// Name aliases identify an IATA code, never a dated physical airport entity.
// Most names come from the bundled directory/locales. Keep only documented
// spelling or legacy-name exceptions here; do not add city-only guesses.
const aliases: Readonly<Record<string, string>> = {
  青岛流亭: "TAO",
  孟买贾特拉帕蒂希瓦吉: "BOM",
};

export type UmetripAirportResolution =
  { iata: string } | { code: "unknown-airport" | "ambiguous-airport" };

/**
 * Resolves an Umetrip airport cell (a code or a name) to an IATA code at the
 * flight date. Names come from the current directory, the formal historical
 * layer (a historical site's name yields the code it held on that date) and,
 * when loaded, worldwide candidate sites. A well-formed code is kept even when
 * no layer knows it, so the flight is not lost.
 */
export function createUmetripAirportResolver() {
  const names = new Map<string, Set<string>>();
  const add = (name: string, iata: string) => {
    const key = normalizeAirportName(name);
    if (!key) return;
    const codes = names.get(key) ?? new Set<string>();
    codes.add(iata);
    names.set(key, codes);
  };
  for (const airport of airports) {
    for (const name of Object.values(airport.name)) {
      if (name) add(name, airport.iata);
    }
  }
  for (const [name, iata] of Object.entries(aliases)) {
    if (airportByIata.has(iata)) add(name, iata);
  }
  // Historical names are date-scoped: only codes whose formal interval can
  // include the service date are offered.
  const formalNames = new Map<string, string[]>();
  for (const airport of airportById.values()) {
    const labels = [
      ...Object.values(airport.name).filter((name): name is string => Boolean(name)),
      ...formalHistoricalNames
        .filter((row) => row.airportId === airport.airportId)
        .map((row) => row.name),
    ];
    for (const label of labels) {
      const key = normalizeAirportName(label);
      formalNames.set(key, [
        ...(formalNames.get(key) ?? []),
        airport.airportId!,
      ]);
    }
  }
  return (raw: string, serviceDate?: string): UmetripAirportResolution => {
    const code = raw.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code)) return { iata: code };
    const key = normalizeAirportName(raw);
    const matches = new Set(names.get(key) ?? []);
    for (const airportId of formalNames.get(key) ?? []) {
      for (const row of formalAssignments) {
        if (row.scheme !== "IATA" || row.airportId !== airportId) continue;
        if (
          !serviceDate ||
          assignmentDateRelation(serviceDate, row) !== "excluded"
        )
          matches.add(row.code);
      }
    }
    if (!matches.size) return { code: "unknown-airport" };
    if (matches.size !== 1) return { code: "ambiguous-airport" };
    return { iata: [...matches][0]! };
  };
}

function normalizeAirportName(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toUpperCase()
    .replace(/[\s·・•.．,，、\-－–—]/g, "")
    .replace(/(?:国际|國際)?(?:机场|機場)$/, "")
    .replace(/(?:国际|國際)$/, "");
}
