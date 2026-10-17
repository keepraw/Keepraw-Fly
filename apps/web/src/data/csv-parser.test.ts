import { describe, expect, it } from "vitest";
import {
  detectCsvDelimiter,
  detectCsvMapping,
  parseCsv,
  preflightCsvImport,
} from "./csv-import";

const header = [
  "flightNumber",
  "serviceDate",
  "originIata",
  "destinationIata",
  "scheduledDeparture",
  "scheduledArrival",
];
const values = [
  "MU589",
  "2026-09-02",
  "PVG",
  "SFO",
  "2026-09-02T13:00:00+08:00",
  "2026-09-02T09:20:00-07:00",
];

function preflight(text: string) {
  const parsed = parseCsv(text);
  return preflightCsvImport(parsed, detectCsvMapping(parsed.headers), null);
}

describe("CSV parsing (RFC 4180 + spreadsheet locales)", () => {
  it.each([
    ["comma (en-US, zh-CN, ja-JP)", ","],
    ["semicolon (fr-FR, de-DE, es, pt-BR spreadsheets)", ";"],
    ['Tab ("text" exports)', "\t"],
  ])("detects %s and imports the same flight", (_label, delimiter) => {
    const text = [header.join(delimiter), values.join(delimiter)].join("\r\n");
    expect(detectCsvDelimiter(text)).toBe(delimiter);
    const parsed = parseCsv(text);
    expect(parsed.headers).toEqual(header);
    expect(parsed.rows).toEqual([values]);
    const result = preflight(text);
    expect(result.canImport).toBe(true);
    expect(result.validRecords).toBe(1);
  });

  it("parses a semicolon export with a BOM, accented headers and quoted values", () => {
    const text =
      "\uFEFFVol;Date;Départ;Arrivée;Heure de départ;Heure d’arrivée;Siège\n" +
      'AF1234;2026-09-02;CDG;NCE;2026-09-02T08:00:00+02:00;2026-09-02T09:30:00+02:00;"12A; hublot"\n';
    const parsed = parseCsv(text);
    expect(parsed.headers[0]).toBe("Vol");
    expect(parsed.rows[0]![6]).toBe("12A; hublot");
  });

  it("keeps delimiters, line breaks and escaped quotes inside quoted fields", () => {
    const parsed = parseCsv(
      'a,b,c\n"x, y","line 1\nline 2","say ""hi"""\r\n"",plain,"  padded  "\n',
    );
    expect(parsed.rows).toEqual([
      ["x, y", "line 1\nline 2", 'say "hi"'],
      ["", "plain", "  padded  "],
    ]);
  });

  it("trims unquoted fields but preserves quoted whitespace", () => {
    expect(parseCsv('a,b\n  MU589  ," PVG "').rows).toEqual([
      ["MU589", " PVG "],
    ]);
  });

  it("accepts spaces between a closing quote and the delimiter", () => {
    expect(parseCsv('a,b\n"x"  ,y').rows).toEqual([["x", "y"]]);
  });

  it.each([
    ['a,b\n"x"y,z', "unexpected-quote"],
    ['a,b\nab"c,d', "unexpected-quote"],
    ['a,b\n"open,z', "unterminated-quote"],
    ["a,,c\n1,2,3", "empty-header"],
    ["a,b\n\n\n", "missing-rows"],
    ["", "missing-rows"],
  ])("rejects %j with %s instead of guessing", (text, code) => {
    expect(() => parseCsv(text)).toThrow(code);
  });

  it("supports lone CR line endings and skips blank lines", () => {
    expect(parseCsv("a,b\r1,2\r\r3,4\r").rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("ignores delimiters inside quoted headers when detecting", () => {
    expect(detectCsvDelimiter('"a,b";"c,d";e\n1;2;3')).toBe(";");
    expect(detectCsvDelimiter("a;b,c,d\n")).toBe(",");
  });

  it("parses Chinese headers with an explicit delimiter override", () => {
    const parsed = parseCsv("航班号\t日期\nMU589\t2026-09-02", "\t");
    expect(parsed.headers).toEqual(["航班号", "日期"]);
  });
});
