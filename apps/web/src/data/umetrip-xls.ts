import type { CellObject, WorkBook, WorkSheet } from "xlsx";
import {
  assertRecordCount,
  importFileProblem,
  ImportFileError,
  MAX_IMPORT_RECORDS,
} from "./import-limits";
import type { UmetripCellValue } from "./umetrip-times";

const headerAliases = {
  serviceDate: ["日期", "航班日期", "出发日期"],
  airline: ["航空公司"],
  flightNumber: ["航班号"],
  origin: ["出发城市", "出发机场"],
  departureTime: ["出发时间", "起飞时间"],
  destination: ["到达城市", "到达机场"],
  arrivalTime: ["到达时间"],
  arrivalDate: ["到达日期"],
  ticketNumber: ["客票号", "票号"],
  status: ["客票状态"],
} as const;
export type UmetripField = keyof typeof headerAliases;
type HeaderMap = Partial<Record<UmetripField, number>>;
const requiredFields: UmetripField[] = [
  "serviceDate",
  "flightNumber",
  "origin",
  "destination",
  "departureTime",
  "arrivalTime",
  "status",
];

export interface UmetripSource {
  sheetName: string;
  lineNumber: number;
}
export interface UmetripDiagnostic extends UmetripSource {
  code: string;
}
export interface UmetripRecord extends UmetripSource {
  values: Partial<Record<UmetripField, UmetripCellValue>>;
  cellProblem: boolean;
  date1904: boolean;
}
export interface ParsedUmetrip {
  records: UmetripRecord[];
  issues: UmetripDiagnostic[];
}

export async function readUmetripFile(file: File): Promise<ParsedUmetrip> {
  const problem = importFileProblem(file);
  if (problem) throw new ImportFileError(problem);
  if (!/\.xls$/i.test(file.name)) throw new Error("unsupported-xls");
  return parseUmetripXls(await file.arrayBuffer());
}

export async function parseUmetripXls(
  buffer: ArrayBuffer,
): Promise<ParsedUmetrip> {
  const problem = importFileProblem({ size: buffer.byteLength });
  if (problem) throw new ImportFileError(problem);
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (!signature.every((byte, index) => new Uint8Array(buffer)[index] === byte))
    throw new Error("unsupported-xls");
  // The parser stays in a separate lazy browser chunk. No file content leaves
  // the browser; formulas and macros are never evaluated.
  const { read } = await import("xlsx");
  let workbook: WorkBook;
  try {
    workbook = read(buffer, {
      type: "array",
      cellDates: false,
      cellFormula: true,
      cellHTML: false,
      cellText: false,
      bookVBA: false,
      sheetRows: MAX_IMPORT_RECORDS + 1,
      WTF: true,
    });
  } catch {
    throw new Error("invalid-xls");
  }
  return extractUmetripWorkbook(workbook);
}

function extractUmetripWorkbook(workbook: WorkBook): ParsedUmetrip {
  const parsed: ParsedUmetrip = { records: [], issues: [] };
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new Error("invalid-xls");
    if (sheet["!fullref"]) throw new ImportFileError("too-many-records");
    const rows = populatedRows(sheet);
    let mapping: HeaderMap | null = null;
    for (const [rowNumber, cells] of rows) {
      const source = { sheetName, lineNumber: rowNumber + 1 };
      const headers: HeaderMap = {};
      let duplicateHeader = false;
      for (const [column, cell] of cells) {
        if (typeof cell.v !== "string" || cell.f) continue;
        const value = cell.v.normalize("NFKC").trim().replace(/\s/g, "");
        const field = (Object.keys(headerAliases) as UmetripField[]).find(
          (field) =>
            (headerAliases[field] as readonly string[]).includes(value),
        );
        if (field) {
          if (headers[field] !== undefined) duplicateHeader = true;
          headers[field] = column;
        }
      }
      if (Object.keys(headers).length >= 2) {
        const incomplete = requiredFields.some(
          (field) => headers[field] === undefined,
        );
        if (duplicateHeader || incomplete) {
          parsed.issues.push({
            ...source,
            code: duplicateHeader ? "duplicate-header" : "missing-header",
          });
          mapping = null;
        } else mapping = headers;
        continue;
      }
      if (isExplanationRow(cells)) continue;
      if (!mapping) {
        parsed.issues.push({ ...source, code: "missing-header" });
      }
      let cellProblem = !mapping;
      const values: UmetripRecord["values"] = {};
      for (const [field, column] of Object.entries(mapping ?? {})) {
        const cell = cells.get(column);
        if (cell?.f || (cell && !["s", "n", "z"].includes(cell.t)))
          cellProblem = true;
        values[field as UmetripField] =
          typeof cell?.v === "string" || typeof cell?.v === "number"
            ? cell.v
            : null;
      }
      parsed.records.push({
        ...source,
        values,
        cellProblem,
        date1904: Boolean(workbook.Workbook?.WBProps?.date1904),
      });
      assertRecordCount(parsed.records.length);
    }
  }
  if (!parsed.records.length && !parsed.issues.length)
    throw new Error("missing-rows");
  return parsed;
}

function populatedRows(sheet: WorkSheet): Map<number, Map<number, CellObject>> {
  // Traverse actual cells rather than a possibly forged !ref rectangle. Keep
  // physical row numbers even when headers move or blank rows occur.
  const rows = new Map<number, Map<number, CellObject>>();
  for (const [address, cell] of Object.entries(sheet)) {
    const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(address);
    if (!match || !cell || ((cell.v == null || cell.v === "") && !cell.f))
      continue;
    const rowNumber = Number(match[2]) - 1;
    let column = 0;
    for (const letter of match[1]!)
      column = column * 26 + letter.charCodeAt(0) - 64;
    const cells = rows.get(rowNumber) ?? new Map<number, CellObject>();
    cells.set(column - 1, cell as CellObject);
    rows.set(rowNumber, cells);
  }
  return new Map([...rows].sort(([a], [b]) => a - b));
}

function isExplanationRow(cells: Map<number, CellObject>): boolean {
  if (cells.size !== 1) return false;
  const cell = [...cells.values()][0]!;
  return (
    !cell.f &&
    typeof cell.v === "string" &&
    /^(?:说明[:：]|备注[:：]|注[:：]|【?航旅纵横】?\s*行程导出\s*$)/.test(
      cell.v.trim(),
    )
  );
}
