/** ICAO Doc 9303, 8th ed., Part 3 §§4.6–4.9 and Part 4 §§4.2, 4.4.
 * Sources and the souvenir's explicit data policy: docs/flight-passport-journal.md.
 * This encoder accepts a short document number; it never truncates an ID.
 */
export interface Td3Data {
  documentCode?: string;
  issuingState: string;
  primaryName: string;
  secondaryName?: string;
  documentNumber: string;
  nationality: string;
  birthDate?: string;
  sex?: "M" | "F" | "<";
  /** Required: ICAO's unknown-birth-date rule does not apply to expiry. */
  expiryDate: string;
  optionalData?: string;
}

export function mrzCheckDigit(value: string): string {
  if (!/^[A-Z0-9<]*$/.test(value)) throw new Error("Invalid MRZ characters");
  const weights = [7, 3, 1];
  return String(
    [...value].reduce((sum, character, index) => {
      const numeric = character === "<" ? 0 : parseInt(character, 36);
      return sum + numeric * weights[index % 3]!;
    }, 0) % 10,
  );
}

/** Part 3 §6.A Latin transliteration; unsupported scripts are rejected as a
 * whole, never silently stripped to produce a different person's name. */
export function latinMrzName(value: string): string | null {
  const expanded = value.toUpperCase().replace(
    /[ÆŒØÐÞŁẞßĲ]/g,
    (c) =>
      ({
        Æ: "AE",
        Œ: "OE",
        Ø: "OE",
        Ð: "D",
        Þ: "TH",
        Ł: "L",
        ẞ: "SS",
        ß: "SS",
        Ĳ: "IJ",
      })[c]!,
  );
  const plain = expanded.normalize("NFD").replace(/\p{M}/gu, "");
  if (/[^A-Z\s\p{P}]/u.test(plain)) return null;
  return plain
    .replace(/[\p{Pd}\s]+/gu, "<")
    .replace(/[^A-Z<]/g, "")
    .replace(/<+/g, "<")
    .replace(/^<+|<+$/g, "");
}

/** Part 4 §4.2.2.1: reserve << and at least one secondary initial when
 * truncating a long primary identifier; a truncated field ends in a letter. */
export function td3NameField(primary: string, secondary = ""): string {
  if (!/^[A-Z]+(?:<[A-Z]+)*$/.test(primary) && primary !== "")
    throw new Error("Invalid primary name");
  if (!/^[A-Z]+(?:<[A-Z]+)*$/.test(secondary) && secondary !== "")
    throw new Error("Invalid secondary name");
  if (!primary) {
    if (secondary) throw new Error("Secondary name requires primary name");
    return "<".repeat(39);
  }
  let name = secondary ? `${primary}<<${secondary}` : primary;
  if (name.length <= 39) return name.padEnd(39, "<");
  if (secondary && primary.length > 36) {
    // Keep all 36 reserved positions even when a component separator falls
    // at the boundary; trimming it would accidentally produce only 38 cells.
    let shortened = primary;
    while (shortened[35] === "<")
      shortened = shortened.slice(0, 35) + shortened.slice(36);
    name = `${shortened.slice(0, 36)}<<${secondary}`;
  }
  // Remove a separator at the cutoff instead of ending a truncated name in <.
  while (name[38] === "<") name = name.slice(0, 38) + name.slice(39);
  return name.slice(0, 39);
}

function dateField(value: string, unknownAllowed: boolean): string {
  if (
    unknownAllowed &&
    /^(?:\d{2}|<<){3}$/.test(value) &&
    value.includes("<")
  ) {
    const month = value.slice(2, 4);
    const day = value.slice(4, 6);
    if (month !== "<<" && (Number(month) < 1 || Number(month) > 12))
      throw new Error("Invalid TD3 month");
    if (day !== "<<" && (Number(day) < 1 || Number(day) > 31))
      throw new Error("Invalid TD3 day");
    return value;
  }
  if (!/^\d{6}$/.test(value)) throw new Error("TD3 date must be YYMMDD");
  const year = 2000 + Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    throw new Error("Invalid TD3 date");
  return value;
}

export function buildTd3Mrz(data: Td3Data): [string, string] {
  const code = data.documentCode ?? "PP";
  if (!/^P[A-Z<]$/.test(code)) throw new Error("Invalid TD3 document code");
  for (const country of [data.issuingState, data.nationality])
    if (!/^[A-Z]{3}$/.test(country))
      throw new Error("Invalid three-letter code");
  if (!/^[A-Z0-9]{1,9}$/.test(data.documentNumber))
    throw new Error(
      "TD3 short document number requires 1–9 alphanumeric characters",
    );
  const optional = data.optionalData ?? "";
  if (!/^[A-Z0-9<]{0,14}$/.test(optional))
    throw new Error("Invalid optional data");
  const sex = data.sex ?? "<";
  if (!/^[MF<]$/.test(sex)) throw new Error("Invalid sex marker");
  const document = data.documentNumber.padEnd(9, "<");
  const birth = dateField(data.birthDate ?? "<<<<<<", true);
  const expiry = dateField(data.expiryDate, false);
  const personal = optional.padEnd(14, "<");
  const line1 =
    code +
    data.issuingState +
    td3NameField(data.primaryName, data.secondaryName);
  const partial =
    document +
    mrzCheckDigit(document) +
    data.nationality +
    birth +
    mrzCheckDigit(birth) +
    sex +
    expiry +
    mrzCheckDigit(expiry) +
    personal +
    mrzCheckDigit(personal);
  const composite =
    partial.slice(0, 10) + partial.slice(13, 20) + partial.slice(21, 43);
  return [line1, partial + mrzCheckDigit(composite)];
}

/** Product-defined specimen metadata, never inferred from flights or the user. */
export const SOUVENIR_TD3 = {
  issuingState: "UTO",
  nationality: "XXX",
  expiryDate: "491231",
} as const;
