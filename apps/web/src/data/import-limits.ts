/**
 * Resource limits for user-selected import files, checked before the file is
 * read into memory. Generous on purpose: a decade of heavy travel is a few
 * thousand flights (about 1–3 MB of JSON), so legitimate backups stay far
 * below these values, while multi-hundred-megabyte or hostile files are
 * refused before they can freeze or crash the tab.
 *
 * The file-size cap also bounds every string field and extension object,
 * because none can exceed the file that contains it. Stored archives are never
 * subject to these limits (they are not re-imported on load).
 */
export const MAX_IMPORT_FILE_BYTES = 64 * 1024 * 1024;
/** Flights (JSON) or data rows (CSV) accepted in a single import. */
export const MAX_IMPORT_RECORDS = 100_000;

export type ImportFileProblem = "empty-file" | "file-too-large";

export class ImportFileError extends Error {
  constructor(readonly code: ImportFileProblem | "too-many-records") {
    super(code);
    this.name = "ImportFileError";
  }
}

/** Checks a file's size without reading it. */
export function importFileProblem(
  file: Pick<Blob, "size">,
): ImportFileProblem | null {
  if (file.size === 0) return "empty-file";
  if (file.size > MAX_IMPORT_FILE_BYTES) return "file-too-large";
  return null;
}

/** Reads a selected import file as text after the size gate. */
export async function readImportFile(file: Blob): Promise<string> {
  const problem = importFileProblem(file);
  if (problem) throw new ImportFileError(problem);
  const text = await file.text();
  if (!text.trim()) throw new ImportFileError("empty-file");
  return text;
}

export function assertRecordCount(count: number): void {
  if (count > MAX_IMPORT_RECORDS) throw new ImportFileError("too-many-records");
}

export const importLimitValues = {
  limit: `${MAX_IMPORT_FILE_BYTES / 1024 / 1024} MB`,
  records: MAX_IMPORT_RECORDS,
};
