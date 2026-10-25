import { airportByIata, airports } from "@keepraw-fly/core";

// Name aliases identify an IATA code, never a dated physical airport entity.
// Most names come from the bundled directory/locales. Keep only documented
// spelling or legacy-name exceptions here; do not add city-only guesses.
const aliases: Readonly<Record<string, string>> = {
  青岛流亭: "TAO",
  孟买贾特拉帕蒂希瓦吉: "BOM",
};

export type UmetripAirportResolution =
  { iata: string } | { code: "unknown-airport" | "ambiguous-airport" };

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
  return (raw: string): UmetripAirportResolution => {
    const code = raw.trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(code) && airportByIata.has(code))
      return { iata: code };
    const matches = names.get(normalizeAirportName(raw));
    if (!matches?.size) return { code: "unknown-airport" };
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
