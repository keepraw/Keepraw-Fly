import { describe, expect, it } from "vitest";
import { parse } from "mrz";
import {
  buildTd3Mrz,
  latinMrzName,
  mrzCheckDigit,
  td3NameField,
  type Td3Data,
} from "./td3-mrz";
import { buildPosterCopy } from "./poster-copy";
import { buildPosterModel } from "./poster-data";

// Independent verification: a character lookup table and reverse weighting,
// without calling any production encoder/check-digit function.
function independentDigit(field: string) {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let sum = 0;
  for (let position = field.length - 1; position >= 0; position--) {
    const value =
      field[position] === "<" ? 0 : alphabet.indexOf(field[position]!);
    if (value < 0) throw new Error("Invalid alphabet");
    sum += value * (position % 3 === 0 ? 7 : position % 3 === 1 ? 3 : 1);
  }
  return String(sum % 10);
}

function verify(lines: [string, string]) {
  const [upper, lower] = lines;
  expect(upper).toMatch(/^P[A-Z<][A-Z]{3}[A-Z<]{39}$/);
  expect(lower).toMatch(
    /^[A-Z0-9<]{9}\d[A-Z]{3}[0-9<]{6}\d[MF<]\d{6}\d[A-Z0-9<]{14}\d\d$/,
  );
  expect(upper).toHaveLength(44);
  expect(lower).toHaveLength(44);
  for (const [start, end, digit] of [
    [0, 9, 9],
    [13, 19, 19],
    [21, 27, 27],
    [28, 42, 42],
  ])
    expect(lower[digit!]).toBe(independentDigit(lower.slice(start, end)));
  expect(lower[43]).toBe(
    independentDigit(
      lower.slice(0, 10) + lower.slice(13, 20) + lower.slice(21, 43),
    ),
  );
}

const specimen: Td3Data = {
  documentCode: "PP",
  issuingState: "UTO",
  primaryName: "ERIKSSON",
  secondaryName: "ANNA<MARIA",
  documentNumber: "L898902C3",
  nationality: "UTO",
  birthDate: "740812",
  sex: "F",
  expiryDate: "340415",
  optionalData: "ZE184226B",
};

describe("ICAO Doc 9303 TD3 encoding", () => {
  it("reproduces Part 4 Appendix A's 2026 Eriksson specimen exactly", () => {
    const mrz = buildTd3Mrz(specimen);
    expect(mrz).toEqual([
      "PPUTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
      "L898902C36UTO7408122F3404159ZE184226B<<<<<16",
    ]);
    verify(mrz);
    const parsed = parse(mrz, { autocorrect: false });
    expect(parsed.format).toBe("TD3");
    expect(parsed.fields.documentNumber).toBe("L898902C3");
    expect(parsed.fields.firstName).toBe("ANNA MARIA");
    // mrz 5.0.2's state table omits ICAO's official UTO specimen code.
    // Do not change the data or suppress any structural/check-digit error.
    expect(
      parsed.details
        .filter((field) => !field.valid)
        .map((field) => field.field),
    ).toEqual(["issuingState", "nationality"]);
    expect(mrzCheckDigit("L898902C3")).toBe("6");
    expect(mrzCheckDigit("740812")).toBe("2");
    expect(mrzCheckDigit("340415")).toBe("9");
    expect(mrzCheckDigit("ZE184226B<<<<<")).toBe("1");
    expect(() => mrzCheckDigit("KRF-123")).toThrow();
  });

  it("never truncates or silently deletes symbols from a document number", () => {
    for (const documentNumber of [
      "",
      "1234567890",
      "KRF-C1670C279628ACE1",
      "AB-CD123",
      "abc",
      "中文",
    ])
      expect(() => buildTd3Mrz({ ...specimen, documentNumber })).toThrow();
    const short = buildTd3Mrz({ ...specimen, documentNumber: "AB1" });
    expect(short[1].slice(0, 9)).toBe("AB1<<<<<<");
    verify(short);
  });

  it("encodes unknown birth/sex without inventing data, and requires an explicit expiry", () => {
    const lines = buildTd3Mrz({
      ...specimen,
      birthDate: undefined,
      sex: undefined,
      optionalData: undefined,
    });
    expect(lines[1].slice(13, 21)).toBe("<<<<<<0<");
    expect(lines[1].slice(28, 43)).toBe("<<<<<<<<<<<<<<0");
    verify(lines);
    for (const expiryDate of ["", "<<<<<<", "340230", "340000"])
      expect(() => buildTd3Mrz({ ...specimen, expiryDate })).toThrow();
  });

  it("validates partial unknown date components instead of accepting arbitrary symbols", () => {
    for (const birthDate of ["9913<<", "99<<99", "9<0101"])
      expect(() => buildTd3Mrz({ ...specimen, birthDate })).toThrow();
    const partial = buildTd3Mrz({ ...specimen, birthDate: "74<<<<" });
    expect(partial[1].slice(13, 19)).toBe("74<<<<");
    verify(partial);
  });

  it("handles long names and the ICAO truncation marker at position 44", () => {
    expect(td3NameField("NILAVADHANANANDA", "ARNPOL<PETCH<CHARONGUANG")).toBe(
      "NILAVADHANANANDA<<ARNPOL<PETCH<CHARONGU",
    );
    for (const primaryName of [
      "A".repeat(90),
      "A".repeat(38),
      "A".repeat(36) + "<B",
      "A".repeat(35) + "<BBBB",
    ])
      for (const secondaryName of ["", "B", "ANNA<MARIA", "B".repeat(100)]) {
        const lines = buildTd3Mrz({ ...specimen, primaryName, secondaryName });
        verify(lines);
        if (
          (primaryName + (secondaryName ? "<<" + secondaryName : "")).length >
          39
        )
          expect(lines[0][43]).toMatch(/[A-Z]/);
        if (secondaryName) expect(lines[0]).toContain("<<");
      }
  });

  it("applies Latin transliteration and punctuation rules without stripping unsupported scripts", () => {
    expect(latinMrzName("D’Artagnan")).toBe("DARTAGNAN");
    expect(latinMrzName("Sky / Walker")).toBe("SKY<WALKER");
    expect(latinMrzName("Marie-Élise Müller")).toBe("MARIE<ELISE<MULLER");
    expect(latinMrzName("Ægir Søren Łukasz Groß")).toBe(
      "AEGIR<SOEREN<LUKASZ<GROSS",
    );
    for (const name of ["张三", "山田 太郎", "Sky 张", "Pilot123", "🧑‍✈️"])
      expect(latinMrzName(name)).toBeNull();
  });
});

describe("souvenir MRZ data sources", () => {
  const model = buildPosterModel([]);
  const identity = { number: "ABC123456" };
  const copy = (name?: Parameters<typeof buildPosterCopy>[5]) =>
    buildPosterCopy(model, (key) => key, "zh-CN", "kilometers", identity, name);

  it("uses Settings names, prefers existing romanization for MRZ and updates when settings change", () => {
    const settings = {
      native: "张三",
      romanized: "ZHANG, SAN",
      primary: "native" as const,
    };
    const before = JSON.stringify(settings);
    const first = copy(settings);
    expect(first.holder.name).toBe("张三");
    expect(first.mrz[0]).toContain("ZHANG<<SAN");
    expect(copy({ ...settings, romanized: "LI, SI" }).mrz[0]).toContain(
      "LI<<SI",
    );
    expect(copy({ native: "Sky Walker" }).mrz[0]).toContain("SKY<WALKER");
    expect(copy({ ...settings, primary: "romanized" }).holder.name).toBe(
      "ZHANG, SAN",
    );
    expect(JSON.stringify(settings)).toBe(before);
    expect(copy(settings).mrz).toEqual(first.mrz);
    verify(first.mrz);
  });

  it("derives deterministic pinyin from Chinese settings only when romanization is absent", () => {
    const result = copy({ native: "张三" });
    expect(result.holder.name).toBe("张三");
    expect(result.mrz[0]).toContain("ZHANG<SAN");
    expect(result.mrzIssues).toContain("automatic-pinyin");
    expect(copy({ native: "张三" }).mrz).toEqual(result.mrz);
    expect(copy({ native: "张三", romanized: "CHANG, SAM" }).mrz[0]).toContain(
      "CHANG<<SAM",
    );
    verify(result.mrz);
  });

  it("preserves unstructured names without guessing surname order", () => {
    expect(copy({ romanized: "ANNA MARIA ERIKSSON" }).mrz[0].slice(5)).toBe(
      "ANNA<MARIA<ERIKSSON".padEnd(39, "<"),
    );
  });

  it("keeps empty or unsupported names explicit and stable, without a fabricated traveller", () => {
    for (const name of [
      undefined,
      { native: "" },
      { native: "山田 カナ" },
      { native: "🧑‍✈️" },
    ]) {
      const result = copy(name);
      expect(result.holder.name).toBe(name?.native ?? "");
      expect(result.mrz[0].slice(5)).toBe("<".repeat(39));
      expect(result.mrzIssues).toContain(
        name?.native ? "name-needs-romanization" : "missing-name",
      );
      expect(copy(name).mrz).toEqual(result.mrz);
      verify(result.mrz);
    }
  });

  it("uses declared specimen metadata and no flight date or random personal facts", () => {
    const result = copy({ native: "Alice" });
    const lower = result.mrz[1];
    expect(lower.slice(0, 9)).toBe(result.holder.number);
    expect(result.mrz[0].slice(2, 5)).toBe("UTO");
    expect(lower.slice(10, 13)).toBe("XXX");
    expect(lower.slice(13, 19)).toBe("<<<<<<");
    expect(lower[20]).toBe("<");
    expect(lower.slice(21, 27)).toBe("491231");
    verify(result.mrz);
    const parsed = parse(result.mrz, { autocorrect: false });
    expect(parsed.fields.documentNumber).toBe(result.holder.number);
    expect(parsed.fields.lastName).toBe("ALICE");
    expect(
      parsed.details
        .filter((field) => !field.valid)
        .map((field) => field.field),
    ).toEqual(["issuingState"]);
    expect(copy({ native: "Alice" }).mrz).toEqual(result.mrz);
  });
});
