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
type EligibleAssignment = FormalAssignment & { canResolve: boolean };
type EligibleName = FormalName & { canResolve: boolean };

interface LegacyClaim {
  verificationStatus: string;
  verifiedOn?: string | null;
  sourceIds: string[];
}
interface LegacySource {
  sourceId: string;
  verificationStatus: string;
}
type Schema3 = {
  schemaVersion: "3.0.0";
  assignments: (FormalAssignment & LegacyClaim & { evidenceType: string })[];
  names: (FormalName & LegacyClaim)[];
  sources: LegacySource[];
};
type Schema4 = {
  schemaVersion: "4.0.0";
  assignments: FormalAssignment[];
  names: FormalName[];
};

export const airportHistoryQueryHorizon = manifest.queryHorizon;
export const formalAirports = formalPackage.airports;
export const airportHistoryDataVersion = formalPackage.dataVersion;

type LocalTransfer = (typeof reviewedTransfers.transfers)[number];
const transfersByAssignment = new Map(
  reviewedTransfers.transfers.flatMap((transfer) =>
    transfer.supersedes.map((id) => [id, transfer] as const),
  ),
);

function localTransfer(
  assignment: FormalAssignment,
): LocalTransfer | undefined {
  const transfer = transfersByAssignment.get(assignment.assignmentId);
  return transfer?.publishedAirportId === assignment.airportId
    ? transfer
    : undefined;
}

function sameBoundary(a: UncertainDateBound, b: UncertainDateBound): boolean {
  return (
    a.earliest === b.earliest &&
    a.latest === b.latest &&
    a.precision === b.precision
  );
}

function adaptAssignment(
  {
    assignmentId,
    airportId,
    scheme,
    code,
    validFrom,
    validTo,
    note,
  }: FormalAssignment,
  canResolve: boolean,
  transfer?: LocalTransfer,
): EligibleAssignment[] {
  const assignment = {
    assignmentId,
    airportId,
    scheme,
    code,
    validFrom,
    validTo,
    note,
    canResolve,
  };
  if (!transfer) return [assignment];
  const transferNote =
    "Fly physical-site handover with the upstream outer date bounds.";
  return [
    {
      ...assignment,
      assignmentId: `${assignmentId}-former-site`,
      airportId: transfer.formerAirportId,
      validTo: transfer.handover,
      note: transferNote,
    },
    {
      ...assignment,
      assignmentId: `${assignmentId}-replacement-site`,
      airportId: transfer.replacementAirportId,
      validFrom: transfer.handover,
      note: transferNote,
    },
  ];
}

function adaptPublication(dataset: Schema3 | Schema4): {
  assignments: EligibleAssignment[];
  names: EligibleName[];
} {
  // Schema 3 used source eligibility in addition to dates. Compute it at
  // ingestion so the resolver can consume the same representation for both schemas.
  const { schemaVersion } = dataset;
  switch (schemaVersion) {
    case "3.0.0": {
      const verifiedSources = new Set(
        dataset.sources
          .filter((source) => source.verificationStatus === "verified")
          .map((source) => source.sourceId),
      );
      const canResolve = (row: LegacyClaim) =>
        row.verificationStatus === "verified" &&
        Boolean(row.verifiedOn) &&
        row.sourceIds.length > 0 &&
        row.sourceIds.every((id) => verifiedSources.has(id));
      return {
        assignments: dataset.assignments.flatMap((row) => {
          const transfer =
            row.evidenceType === "continuity_inference"
              ? localTransfer(row)
              : undefined;
          return transfer
            ? adaptAssignment(
                row,
                row.verificationStatus === "verified",
                transfer,
              )
            : adaptAssignment(row, canResolve(row));
        }),
        names: dataset.names.map(
          ({ verificationStatus, verifiedOn, sourceIds, ...row }) => ({
            ...row,
            canResolve: canResolve({
              verificationStatus,
              verifiedOn,
              sourceIds,
            }),
          }),
        ),
      };
    }
    case "4.0.0": {
      const original = reviewedTransfers.originalInterval;
      return {
        assignments: dataset.assignments.flatMap((row) => {
          // Apply each correction only to the original upstream interval.
          const transfer =
            sameBoundary(row.validFrom, original.validFrom) &&
            sameBoundary(row.validTo, original.validTo)
              ? localTransfer(row)
              : undefined;
          return adaptAssignment(row, true, transfer);
        }),
        names: dataset.names.map((row) => ({ ...row, canResolve: true })),
      };
    }
    default:
      throw new Error(`Unsupported Airport History schema: ${schemaVersion}`);
  }
}

export const { assignments: formalAssignments, names: formalHistoricalNames } =
  adaptPublication(formalPackage as Schema3 | Schema4);

const assignmentsByCode = new Map<string, EligibleAssignment[]>();
export const assignmentsByAirportId = new Map<string, EligibleAssignment[]>();
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
  if (
    !certain ||
    possible.some(
      (row) => row.airportId !== certain.airportId || !row.canResolve,
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
