import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { utils, write, type WorkBook } from "xlsx";
import { validateKeeprawFly } from "@keepraw-fly/validator";
import airportRows from "@keepraw-fly/core/airport-directory";
import {
  installAirportDirectory,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { BrowserStorageAdapter } from "../storage/browser";
import { redactSensitiveData } from "./redacted-export";
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_RECORDS } from "./import-limits";
import { runImportPreflight } from "./import-preflight-work";
import {
  buildDocumentFromUmetripPreflight,
  preflightUmetripImport,
  preflightUmetripImportWork,
} from "./umetrip-import";
import {
  parseUmetripXls,
  readUmetripFile,
  type ParsedUmetrip,
} from "./umetrip-xls";

installAirportDirectory(airportRows as CompactAirportRow[]);
// Independently invented records; no personal sample data is used by tests.
const headers = [
  "日期",
  "航空公司",
  "航班号",
  "出发城市",
  "出发时间",
  "到达城市",
  "到达时间",
  "里程数",
  "客票号",
  "客票状态",
];
const fictional = [
  "2024年2月12日",
  "中国国际航空",
  "CA1031",
  "北京首都",
  "10:00",
  "广州白云",
  "13:20",
  "0",
  "9990000000001",
  "已使用",
];
function row(changes: Record<number, unknown> = {}): unknown[] {
  return fictional.map((value, index) =>
    Object.hasOwn(changes, index) ? changes[index] : value,
  );
}
function workbook(
  sheets: [string, unknown[][]][] = [["已结束", [headers, row()]]],
): WorkBook {
  const book = utils.book_new();
  for (const [name, rows] of sheets)
    utils.book_append_sheet(book, utils.aoa_to_sheet(rows), name);
  return book;
}
async function parsed(book = workbook()): Promise<ParsedUmetrip> {
  return parseUmetripXls(
    write(book, { type: "array", bookType: "biff8" }) as ArrayBuffer,
  );
}
function ids() {
  let count = 0;
  return () => `synthetic-${++count}`;
}
function preflight(
  input: ParsedUmetrip,
  existing: KeeprawFlyDocument | null = null,
) {
  return preflightUmetripImport(
    input,
    existing,
    ids(),
    Date.parse("2025-01-01Z"),
  );
}

describe("Umetrip BIFF8 XLS adapter", () => {
  it("reads an independently generated fictional BIFF8 fixture", async () => {
    const bytes = readFileSync(
      new URL(
        "../../../../tests/fixtures/umetrip/standard.xls",
        import.meta.url,
      ),
    );
    const result = preflight(
      await parseUmetripXls(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      ),
    );
    expect(result).toMatchObject({
      totalRecords: 1,
      validRecords: 1,
      excludedRecords: 0,
      problemRecords: 0,
      canImport: true,
    });
    expect(result.flights[0]).toMatchObject({
      flightNumber: "CA1031",
      serviceDate: "2024-02-12",
      airline: { iata: "CA", icao: "CCA" },
      origin: { iata: "PEK" },
      destination: { iata: "CAN" },
      scheduledDeparture: "2024-02-12T10:00:00+08:00",
      scheduledArrival: "2024-02-12T13:20:00+08:00",
      ticketNumber: "9990000000001",
    });
    expect(result.flights[0]).not.toHaveProperty("actualDeparture");
    expect(result.flights[0]).not.toHaveProperty("actualArrival");
    expect(result.flights[0]?.origin).not.toHaveProperty("latitude");
    expect(result.flights[0]?.extensions).toMatchObject({
      "keepraw-fly.umetrip": {
        origin: "北京首都",
        destination: "广州白云",
        departureTime: "10:00",
        arrivalTime: "13:20",
        timeBasis: "unspecified",
        arrivalDateInferred: true,
      },
    });
    expect(
      validateKeeprawFly(buildDocumentFromUmetripPreflight(result, null)).valid,
    ).toBe(true);
  });

  it("finds moved headers and reordered columns across reordered worksheets", async () => {
    const order = [9, 6, 3, 8, 2, 1, 0, 5, 4, 7];
    const reorderedHeaders = order.map((i) => headers[i]);
    const input = await parsed(
      workbook([
        [
          "OPEN票 200",
          [headers, row({ 0: "日期待定", 4: "时间待定", 9: "未使用" })],
        ],
        [
          "Archive",
          [
            ["说明：这是一份虚构的测试工作簿"],
            [],
            reorderedHeaders,
            [],
            order.map((i) => row()[i]),
            ["备注：测试结束"],
          ],
        ],
        ["待出行 500", [headers, row({ 9: "未使用" })]],
      ]),
    );
    const result = preflight(input);
    expect(result).toMatchObject({
      totalRecords: 3,
      validRecords: 1,
      excludedRecords: 2,
      canImport: true,
    });
    expect(result.flights[0]?.extensions).toMatchObject({
      "keepraw-fly.umetrip": { sheetName: "Archive", lineNumber: 5 },
    });
    expect(result.exclusions.map((item) => item.reason)).toEqual([
      "open",
      "unused",
    ]);
  });

  it("checks actual row status even in a completed worksheet", async () => {
    const result = preflight(
      await parsed(
        workbook([
          [
            "已结束 999",
            [
              headers,
              row(),
              row({ 9: "未使用" }),
              row({ 9: "OPEN" }),
              row({ 0: null, 4: "--", 9: "已退票" }),
              row({ 9: "已换开" }),
              row({ 9: "无效票" }),
            ],
          ],
        ]),
      ),
    );
    expect(result).toMatchObject({
      totalRecords: 6,
      validRecords: 1,
      excludedRecords: 5,
      canImport: true,
    });
    expect(result.exclusions.map((item) => item.reason)).toEqual([
      "unused",
      "open",
      "refunded",
      "exchanged",
      "invalid",
    ]);
  });

  it.each(["待出行 40", "OPEN票 30", "无效票 20"])(
    "blocks a used status conflicting with %s",
    async (name) => {
      const result = preflight(
        await parsed(workbook([[name, [headers, row()]]])),
      );
      expect(result.canImport).toBe(false);
      expect(result.issues).toContainEqual({
        sheetName: name,
        lineNumber: 2,
        code: "conflicting-status",
      });
    },
  );

  it.each(["", "已结束", "已使用?", "CHECKED IN"])(
    "blocks unknown status %s rather than assuming flown",
    async (status) => {
      const result = preflight(
        await parsed(workbook([["已结束", [headers, row({ 9: status })]]])),
      );
      expect(result).toMatchObject({
        validRecords: 0,
        problemRecords: 1,
        canImport: false,
      });
      expect(result.issues[0]?.code).toBe("unknown-status");
    },
  );

  it("handles Excel numeric dates, times and safely representable ticket numbers", async () => {
    const dateSerial =
      (Date.parse("2024-02-12Z") - Date.parse("1899-12-30Z")) / 86400000;
    const result = preflight(
      await parsed(
        workbook([
          [
            "已结束",
            [
              headers,
              row({
                0: dateSerial,
                4: 10 / 24,
                6: 13 / 24 + 20 / 1440,
                8: 9990000000001,
              }),
            ],
          ],
        ]),
      ),
    );
    expect(result.canImport).toBe(true);
    expect(result.flights[0]?.serviceDate).toBe("2024-02-12");
    expect(result.flights[0]?.scheduledArrival).toBe(
      "2024-02-12T13:20:00+08:00",
    );
  });

  it("honors workbook 1904 dates instead of using the browser timezone", async () => {
    const serial =
      (Date.parse("2024-02-12Z") - Date.parse("1904-01-01Z")) / 86400000;
    const book = workbook([["已结束", [headers, row({ 0: serial })]]]);
    book.Workbook = { WBProps: { date1904: true } };
    const result = preflight(await parsed(book));
    expect(result.canImport).toBe(true);
    expect(result.flights[0]?.serviceDate).toBe("2024-02-12");
    expect(result.flights[0]?.extensions).toMatchObject({
      "keepraw-fly.umetrip": { dateSystem: "1904" },
    });
  });

  it("omits passenger columns and removes ticket/provenance in shareable exports", async () => {
    const bytes = readFileSync(
      new URL("../../../../tests/fixtures/umetrip/review.xls", import.meta.url),
    );
    const result = preflight(
      await parseUmetripXls(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      ),
    );
    const document = buildDocumentFromUmetripPreflight(result, null);
    expect(JSON.stringify(document)).not.toContain("Synthetic passenger");
    expect(document.flights[0]?.ticketNumber).toBe("9990000000001");
    const { document: shareable } = redactSensitiveData(document);
    expect(JSON.stringify(shareable)).not.toContain("9990000000001");
    expect(
      shareable.flights[0]?.extensions?.["keepraw-fly.umetrip"],
    ).toBeUndefined();
    expect(validateKeeprawFly(shareable).valid).toBe(true);
    expect(document.flights[0]?.extensions).toHaveProperty(
      "keepraw-fly.umetrip",
    );
  });

  it("does not use a ticket number as segment identity, and skips exact duplicates", async () => {
    const result = preflight(
      await parsed(
        workbook([
          [
            "History A",
            [
              headers,
              row(),
              row({
                2: "CA1032",
                3: "广州白云",
                5: "北京首都",
                4: "16:00",
                6: "19:20",
              }),
            ],
          ],
          ["History B", [headers, row()]],
        ]),
      ),
    );
    expect(result).toMatchObject({
      validRecords: 3,
      newRecords: 2,
      exactDuplicateRecords: 1,
      possibleDuplicateRecords: 0,
    });
    expect(
      buildDocumentFromUmetripPreflight(result, null).flights,
    ).toHaveLength(2);
  });

  it("requires the existing possible-duplicate opt-in before adding another departure", async () => {
    const input = await parsed();
    const existing = buildDocumentFromUmetripPreflight(preflight(input), null);
    const variant = await parsed(
      workbook([["已结束", [headers, row({ 4: "10:20", 6: "13:40" })]]]),
    );
    const result = preflightUmetripImport(variant, existing, () => "variant");
    expect(result).toMatchObject({
      newRecords: 0,
      possibleDuplicateRecords: 1,
      exactDuplicateRecords: 0,
    });
    expect(
      buildDocumentFromUmetripPreflight(result, existing).flights,
    ).toHaveLength(1);
    expect(
      buildDocumentFromUmetripPreflight(result, existing, true).flights,
    ).toHaveLength(2);
    expect(
      preflightUmetripImport(input, existing, () => "another")
        .exactDuplicateRecords,
    ).toBe(1);
  });

  it.each([
    [{ 0: "2024-02-30" }, "invalid-date"],
    [{ 0: null }, "invalid-date"],
    [{ 2: "CA??" }, "invalid-flight-number"],
    [{ 2: "ZZZ123" }, "unknown-airline"],
    [{ 3: "北京" }, "unknown-airport"],
    [{ 5: "不存在的机场" }, "unknown-airport"],
    [{ 4: null }, "invalid-time"],
    [{ 6: "--" }, "invalid-time"],
    [{ 3: "广州白云" }, "same-airport"],
    [{ 8: Number.MAX_SAFE_INTEGER + 1 }, "invalid-row"],
    [{ 0: "2030年2月12日" }, "future-used-flight"],
  ] as const)(
    "keeps blocking errors at their physical source row: %j",
    async (changes, code) => {
      const input = await parsed(
        workbook([
          [
            "Flight history",
            [["说明：测试输入"], headers, [], row(changes), row()],
          ],
        ]),
      );
      const result = preflight(input);
      expect(result).toMatchObject({
        totalRecords: 2,
        validRecords: 1,
        problemRecords: 1,
        canImport: false,
      });
      expect(result.issues).toContainEqual({
        sheetName: "Flight history",
        lineNumber: 4,
        code,
      });
      expect(() => buildDocumentFromUmetripPreflight(result, null)).toThrow(
        "invalid-umetrip-import",
      );
    },
  );

  it("normalizes flight prefixes with the existing airline mechanism", async () => {
    const result = preflight(
      await parsed(
        workbook([["Flight history", [headers, row({ 2: "cca 1031" })]]]),
      ),
    );
    expect(result.canImport).toBe(true);
    expect(result.flights[0]?.flightNumber).toBe("CA1031");
  });

  it("accepts an optional explicit arrival-date column", async () => {
    const result = preflight(
      await parsed(
        workbook([
          [
            "Flight history",
            [
              [...headers, "到达日期"],
              [...row(), "2024/2/12"],
            ],
          ],
        ]),
      ),
    );
    expect(result.canImport).toBe(true);
    expect(result.flights[0]?.extensions).toMatchObject({
      "keepraw-fly.umetrip": { arrivalDateInferred: false },
    });
  });

  it("rejects formulas or error cells even when they have a cached value", async () => {
    const bytes = readFileSync(
      new URL(
        "../../../../tests/fixtures/umetrip/formula.xls",
        import.meta.url,
      ),
    );
    const result = preflight(
      await parseUmetripXls(
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ),
      ),
    );
    expect(result.issues).toContainEqual({
      sheetName: "已结束",
      lineNumber: 2,
      code: "unsupported-cell",
    });
    expect(result.canImport).toBe(false);
  });

  it.each([
    [headers.map((h) => (h === "客票状态" ? "状态不明" : h)), "missing-header"],
    [[...headers, "出发机场"], "duplicate-header"],
  ] as const)(
    "refuses unknown required or duplicate column meanings",
    async (changedHeaders, code) => {
      const result = preflight(
        await parsed(
          workbook([["Flight history", [[...changedHeaders], row()]]]),
        ),
      );
      expect(result.canImport).toBe(false);
      expect(result.issues).toContainEqual({
        sheetName: "Flight history",
        lineNumber: 1,
        code,
      });
    },
  );

  it("does not silently discard an unrecognized nonempty sheet or trailing row", async () => {
    const result = preflight(
      await parsed(
        workbook([
          ["Flight history", [headers, row(), ["Unrecognized trailing data"]]],
          ["Other data", [["Not an explanation"]]],
        ]),
      ),
    );
    expect(result.canImport).toBe(false);
    expect(
      result.issues.map((issue) => [issue.sheetName, issue.lineNumber]),
    ).toContainEqual(["Flight history", 3]);
    expect(
      result.issues.map((issue) => [issue.sheetName, issue.lineNumber]),
    ).toContainEqual(["Other data", 1]);
  });

  it("matches synchronous and cancellable preflight results", async () => {
    const input = await parsed();
    const now = Date.parse("2025-01-01Z");
    expect(
      await runImportPreflight(
        preflightUmetripImportWork(input, null, ids(), now),
      ),
    ).toEqual(preflight(input));
    const controller = new AbortController();
    controller.abort();
    await expect(
      runImportPreflight(
        preflightUmetripImportWork(input, null),
        controller.signal,
      ),
    ).rejects.toThrow();
  });

  it("blocks canonical semantic validation errors before confirmation", async () => {
    const input = await parsed(
      workbook([
        ["Flight history", [headers, row(), row({ 0: "2024年2月13日" })]],
      ]),
    );
    const result = preflightUmetripImport(input, null, () => "collision");
    expect(result).toMatchObject({
      canImport: false,
      validRecords: 1,
      problemRecords: 1,
    });
    expect(result.issues).toContainEqual({
      sheetName: "Flight history",
      lineNumber: 3,
      code: "invalid-row",
    });
    expect(() => buildDocumentFromUmetripPreflight(result, null)).toThrow(
      "invalid-umetrip-import",
    );
  });

  it("appends through IndexedDB without changing profiles, memberships or existing flights", async () => {
    const existing = buildDocumentFromUmetripPreflight(
      preflight(await parsed()),
      null,
    );
    existing.profile = { name: { romanized: "Fictional tester" } };
    existing.extensions = { "test.archive": { kept: true } };
    existing.frequentFlyerMemberships = [
      {
        id: "fictional",
        programId: "phoenixmiles",
        memberNumber: "SYNTHETIC",
        associatedAirlines: ["CA"],
      },
    ];
    existing.flights[0]!.frequentFlyer = {
      membershipId: "fictional",
      tierAtFlight: "Test tier",
    };
    const before = structuredClone(existing);
    const input = await parsed(
      workbook([["Flight history", [headers, row({ 0: "2024年2月13日" })]]]),
    );
    const result = preflightUmetripImport(input, existing, () => "new-leg");
    const next = buildDocumentFromUmetripPreflight(result, existing);
    expect(next.profile).toEqual(before.profile);
    expect(next.frequentFlyerMemberships).toEqual(
      before.frequentFlyerMemberships,
    );
    expect(next.extensions).toEqual(before.extensions);
    expect(next.flights[0]).toEqual(before.flights[0]);
    expect(existing).toEqual(before);
    expect(validateKeeprawFly(next).valid).toBe(true);
    const storage = new BrowserStorageAdapter(`umetrip-${crypto.randomUUID()}`);
    try {
      await storage.saveDocument(existing);
      await storage.saveDocument(next);
      expect(await storage.loadDocument()).toMatchObject({
        status: "valid",
        document: next,
        kind: "personal",
      });
    } finally {
      await storage.deleteDatabaseForTests();
    }
  });
});

describe("Umetrip file limits and container checks", () => {
  it.each([0, MAX_IMPORT_FILE_BYTES + 1])(
    "checks size %s before reading bytes",
    async (size) => {
      const arrayBuffer = vi.fn();
      await expect(
        readUmetripFile({
          name: "fictional.xls",
          size,
          arrayBuffer,
        } as unknown as File),
      ).rejects.toThrow(size ? "file-too-large" : "empty-file");
      expect(arrayBuffer).not.toHaveBeenCalled();
    },
  );
  it("checks limits when the byte parser is called directly", async () => {
    await expect(parseUmetripXls(new ArrayBuffer(0))).rejects.toThrow(
      "empty-file",
    );
    await expect(
      parseUmetripXls(new ArrayBuffer(MAX_IMPORT_FILE_BYTES + 1)),
    ).rejects.toThrow("file-too-large");
    expect(() =>
      preflight({
        records: Array(MAX_IMPORT_RECORDS + 1).fill(null),
        issues: [],
      }),
    ).toThrow("too-many-records");
  });
  it("enforces the aggregate record limit across genuine XLS worksheets", async () => {
    const half = Math.floor(MAX_IMPORT_RECORDS / 2) + 1;
    const unusedRows = Array.from({ length: half }, () => [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      "未使用",
    ]);
    const book = workbook([
      ["Sheet A", [headers, ...unusedRows]],
      ["Sheet B", [headers, ...unusedRows]],
    ]);
    await expect(parsed(book)).rejects.toThrow("too-many-records");
  });
  it.each([
    "<table><tr><td>CSV disguised as Excel</td></tr></table>",
    "a,b,c\n1,2,3",
    "PK\u0003\u0004",
  ])("rejects non-CFB content with an .xls extension: %s", async (content) => {
    await expect(
      readUmetripFile(new File([content], "fictional.xls")),
    ).rejects.toThrow("unsupported-xls");
  });
  it("rejects XLSX, corrupt CFB and a forged file extension", async () => {
    await expect(
      parseUmetripXls(
        write(workbook(), { bookType: "xlsx", type: "array" }) as ArrayBuffer,
      ),
    ).rejects.toThrow("unsupported-xls");
    await expect(
      parseUmetripXls(
        new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).buffer,
      ),
    ).rejects.toThrow("invalid-xls");
    await expect(
      readUmetripFile(new File(["content"], "fictional.xlsx")),
    ).rejects.toThrow("unsupported-xls");
  });
});
