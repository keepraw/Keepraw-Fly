import formalPackage from "../data/airport-history/formal/airports.json";
import manifest from "../data/airport-history/formal/manifest.json";
import reviewedTransfers from "../data/airport-history/reviewed-transfers.json";

export type AirportCodeScheme = "IATA" | "ICAO";
export interface UncertainDateBound {
  earliest: string | null;
  latest: string | null;
  precision: string;
}
export interface FormalAssignment {
  assignmentId: string;
  airportId: string;
  scheme: AirportCodeScheme;
  code: string;
  validFrom: UncertainDateBound;
  validTo: UncertainDateBound;
  note?: string;
}
export type AssignmentDateRelation = "certain" | "possible" | "excluded";

interface FormalName {
  nameId: string;
  airportId: string;
  name: string;
  language: string;
  kind: "official" | "alias" | "translation";
  validFrom: UncertainDateBound;
  validTo: UncertainDateBound;
  note?: string;
}
if (formalPackage.schemaVersion !== "4.0.0") {
  throw new Error(
    `Unsupported Airport History schema: ${formalPackage.schemaVersion}`,
  );
}

export const airportHistoryQueryHorizon = manifest.queryHorizon;
export const formalAirports = formalPackage.airports;
export const airportHistoryDataVersion = formalPackage.dataVersion;

const transfersByAssignment = new Map(
  reviewedTransfers.transfers.flatMap((transfer) =>
    transfer.supersedes.map((id) => [id, transfer] as const),
  ),
);

function sameBoundary(a: UncertainDateBound, b: UncertainDateBound): boolean {
  return (
    a.earliest === b.earliest &&
    a.latest === b.latest &&
    a.precision === b.precision
  );
}

function adaptAssignment(assignment: FormalAssignment): FormalAssignment[] {
  const transfer = transfersByAssignment.get(assignment.assignmentId);
  const original = reviewedTransfers.originalInterval;
  // Apply each correction only to the original upstream interval.
  if (
    !transfer ||
    transfer.publishedAirportId !== assignment.airportId ||
    !sameBoundary(assignment.validFrom, original.validFrom) ||
    !sameBoundary(assignment.validTo, original.validTo)
  ) {
    return [assignment];
  }
  const transferNote =
    "Fly physical-site handover with the upstream outer date bounds.";
  return [
    {
      ...assignment,
      assignmentId: `${assignment.assignmentId}-former-site`,
      airportId: transfer.formerAirportId,
      validTo: transfer.handover,
      note: transferNote,
    },
    {
      ...assignment,
      assignmentId: `${assignment.assignmentId}-replacement-site`,
      airportId: transfer.replacementAirportId,
      validFrom: transfer.handover,
      note: transferNote,
    },
  ];
}

export const formalAssignments = (
  formalPackage.assignments as FormalAssignment[]
).flatMap(adaptAssignment);
export const formalHistoricalNames = formalPackage.names as FormalName[];

const assignmentsByCode = new Map<string, FormalAssignment[]>();
export const assignmentsByAirportId = new Map<string, FormalAssignment[]>();
export const historicalNamesByAirportId = new Map<string, FormalName[]>();
for (const row of formalHistoricalNames) {
  const entries = historicalNamesByAirportId.get(row.airportId);
  if (entries) entries.push(row);
  else historicalNamesByAirportId.set(row.airportId, [row]);
}
for (const row of formalAssignments) {
  const key = `${row.scheme}:${row.code}`;
  const byCode = assignmentsByCode.get(key);
  if (byCode) byCode.push(row);
  else assignmentsByCode.set(key, [row]);
  const byId = assignmentsByAirportId.get(row.airportId);
  if (byId) byId.push(row);
  else assignmentsByAirportId.set(row.airportId, [row]);
}
export function formalAssignmentsForCode(
  code: string,
  scheme: AirportCodeScheme = "IATA",
) {
  return assignmentsByCode.get(`${scheme}:${code.trim().toUpperCase()}`) ?? [];
}
/** Certain [latest-start, earliest-end); null bounds never invent dates. */
export function assignmentDateRelation(
  day: string,
  row: Pick<FormalAssignment, "validFrom" | "validTo">,
): AssignmentDateRelation {
  if (
    (row.validFrom.earliest !== null && day < row.validFrom.earliest) ||
    (row.validTo.latest !== null && day >= row.validTo.latest)
  )
    return "excluded";
  return row.validFrom.latest !== null &&
    day >= row.validFrom.latest &&
    row.validTo.earliest !== null &&
    day < row.validTo.earliest
    ? "certain"
    : "possible";
}
const through = new Date(`${airportHistoryQueryHorizon.toExclusive}T00:00:00Z`);
through.setUTCDate(through.getUTCDate() - 1);
const lastFormalDay = through.toISOString().slice(0, 10);

/** Publish a current code only when the dated assignments identify one site. */
export const latestFormalCodesByAirportId = new Map<
  string,
  Record<AirportCodeScheme, string[]>
>();
for (const rows of assignmentsByCode.values()) {
  const possible = rows.filter(
    (row) => assignmentDateRelation(lastFormalDay, row) !== "excluded",
  );
  const certain = possible.find(
    (row) => assignmentDateRelation(lastFormalDay, row) === "certain",
  );
  if (!certain || possible.some((row) => row.airportId !== certain.airportId))
    continue;
  const codes = latestFormalCodesByAirportId.get(certain.airportId) ?? {
    IATA: [],
    ICAO: [],
  };
  codes[certain.scheme].push(certain.code);
  latestFormalCodesByAirportId.set(certain.airportId, codes);
}
for (const codes of latestFormalCodesByAirportId.values()) {
  codes.IATA.sort();
  codes.ICAO.sort();
}
