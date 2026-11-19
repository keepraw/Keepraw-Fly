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
  evidenceType: string;
  verificationStatus: string;
  verifiedOn?: string;
  sourceIds: string[];
  validFrom: UncertainDateBound;
  validTo: UncertainDateBound;
  note?: string;
}
export type AssignmentDateRelation = "certain" | "possible" | "excluded";

export const airportHistoryQueryHorizon = manifest.queryHorizon;
export const formalAirports = formalPackage.airports;
export const airportHistoryDataVersion = formalPackage.dataVersion;
const transfersByAssignment = new Map(
  reviewedTransfers.transfers.flatMap((transfer) =>
    transfer.supersedes.map((id) => [id, transfer] as const),
  ),
);

// Apply the operating-site evidence to the identified continuity claims. The
// published dataset stays intact and more specific upstream claims pass through.
export const formalAssignments: FormalAssignment[] = (
  formalPackage.assignments as FormalAssignment[]
).flatMap((assignment) => {
  const transfer = transfersByAssignment.get(assignment.assignmentId);
  if (
    !transfer ||
    assignment.evidenceType !== "continuity_inference" ||
    assignment.airportId !== transfer.publishedAirportId
  )
    return [assignment];
  const evidence = {
    ...assignment,
    evidenceType: "reviewed_operating_site_transfer",
    sourceIds: transfer.sourceIds,
    verifiedOn: reviewedTransfers.reviewedOn,
    note: "Fly physical-site review. Dates bound operating-site evidence, with the published outer coverage retained.",
  };
  return [
    {
      ...evidence,
      assignmentId: `${assignment.assignmentId}-former-site`,
      airportId: transfer.formerAirportId,
      validTo: transfer.handover,
    },
    {
      ...evidence,
      assignmentId: `${assignment.assignmentId}-replacement-site`,
      airportId: transfer.replacementAirportId,
      validFrom: transfer.handover,
    },
  ];
});
export const formalSources = new Map(
  [...formalPackage.sources, ...reviewedTransfers.sources].map((source) => [
    source.sourceId,
    source,
  ]),
);
export const formalHistoricalNames = formalPackage.names;
const assignmentsByCode = new Map<string, FormalAssignment[]>();
export const assignmentsByAirportId = new Map<string, FormalAssignment[]>();
export const historicalNamesByAirportId = new Map<
  string,
  (typeof formalHistoricalNames)[number][]
>();
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
export function isReviewedAirportClaim(
  row: Pick<
    FormalAssignment,
    "verificationStatus" | "verifiedOn" | "sourceIds"
  >,
): boolean {
  return (
    row.verificationStatus === "verified" &&
    Boolean(row.verifiedOn) &&
    row.sourceIds.length > 0 &&
    row.sourceIds.every(
      (id) => formalSources.get(id)?.verificationStatus === "verified",
    )
  );
}

const through = new Date(`${airportHistoryQueryHorizon.toExclusive}T00:00:00Z`);
through.setUTCDate(through.getUTCDate() - 1);
const lastFormalDay = through.toISOString().slice(0, 10);

/** Publish a current code only when the formal evidence identifies one site. */
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
  if (
    !certain ||
    possible.some(
      (row) =>
        row.airportId !== certain.airportId || !isReviewedAirportClaim(row),
    )
  )
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
