/**
 * Date-aware historical airport identity for Keepraw Fly.
 *
 * Two layers from the pinned keepraw/airport-history package
 * (packages/core/data/airport-history):
 *
 * - FORMAL: reviewed physical airports (`apt_`) and IATA/ICAO assignments with
 *   half-open `[validFrom, validTo)` bounds whose `earliest`/`latest` edges keep
 *   their precision. Only an unambiguous *certain* interval resolves a date.
 * - CANDIDATES: worldwide reference-code observations and the 88,330 transition
 *   event groups. These carry physical-location hypotheses (`loc_`) and source
 *   locators. They never resolve a date and never become an `airportId`:
 *   `revisionObservedAt` is when a directory revision was observed, not when a
 *   code took effect.
 *
 * The formal layer is installed synchronously. Candidate shards are installed
 * lazily (see {@link ensureAirportHistoryCodes}); until a code's shards are
 * present, that code reports `candidate_index_unavailable` instead of
 * pretending the candidate layer has nothing.
 */
import formalPackage from "../data/airport-history/formal/airports.json";
import packageManifest from "../data/airport-history/manifest.json";
import { distanceKilometers } from "./calculations";
import { airportByIata, type AirportReference } from "./reference-data";
import { sha256Hex } from "./sha256";

export type AirportCodeScheme = "IATA" | "ICAO";

export type AirportHistoryStatus =
  | "resolved"
  | "uncertain"
  | "ambiguous"
  | "historical_candidate"
  | "current_directory_only"
  | "unknown_code"
  | "candidate_index_unavailable";

export interface UncertainDateBound {
  earliest: string | null;
  latest: string | null;
  precision: string;
}

export interface FormalAirport {
  airportId: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  coordinatesNote?: string;
  nameNote?: string;
  externalIds: Record<string, string>;
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

export interface FormalSource {
  sourceId: string;
  title: string;
  url?: string;
  sourceType?: string;
  verificationStatus?: string;
}

/** `certain`: inside both latest-start and earliest-end; `possible`: inside the outer bounds only. */
export type AssignmentDateRelation = "certain" | "possible" | "excluded";

export interface AssignmentMatch {
  assignment: FormalAssignment;
  relation: AssignmentDateRelation;
}

export interface CandidateSite {
  siteId: string;
  /** Present only for sites the formal layer already reviewed; still not an automatic resolution. */
  formalAirportId: string | null;
  locationIds: string[];
  referenceIds: string[];
  name: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  identityStatus: string;
  ambiguousLocation: boolean;
}

export interface CandidateObservation {
  observationId: string;
  referenceId: string;
  siteId: string;
  sourceId: string;
  kind: string;
  side: string | null;
  candidateId: string | null;
  commit: string | null;
  blob: string | null;
  /** Upstream directory revision observation time. NOT a code effective date. */
  revisionObservedAt: string | null;
}

export interface HistoricalCandidate {
  eventGroupId: string;
  candidateId: string;
  side: "before" | "after";
  before: string | null;
  after: string | null;
  groupName: string | null;
  groupCountry: string | null;
  referenceId: string | null;
  classifications: string[];
  memberClassification: string | null;
  groupStatus: string | null;
  candidateStatus: string | null;
  sourceId: string | null;
  sourceEntityId: string | null;
  firstRevisionObservedAt: string | null;
  lastRevisionObservedAt: string | null;
  sourceRevisions: {
    commit: string | null;
    beforeBlob: string | null;
    afterBlob: string | null;
    revisionObservedAt: string | null;
  }[];
  /** Every physical-location hypothesis, never merged across candidates. */
  possibleSites: (CandidateSite & { linkedByCandidate: boolean })[];
}

export interface AirportHistoryAirport {
  airportId: string | null;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string | null;
  basis: "formal" | "current_directory";
}

export interface AirportHistoryUncertainty {
  /** Why the result is not a single certain physical airport. */
  reason:
    | "none"
    | "date_in_uncertain_boundary"
    | "multiple_certain_airports"
    | "no_formal_assignment"
    | "candidate_index_unavailable"
    | "invalid_date";
  possibleAirportIds: string[];
  assignments: {
    assignmentId: string;
    airportId: string;
    relation: AssignmentDateRelation;
    validFrom: UncertainDateBound;
    validTo: UncertainDateBound;
  }[];
  candidateTimezones: string[];
  candidateSitesMatchCurrentDirectory: boolean | null;
  timestampMeaning: string;
}

export interface AirportHistoryResolution {
  code: string;
  scheme: AirportCodeScheme;
  queryDate: string;
  status: AirportHistoryStatus;
  /** Only when the formal layer resolves exactly one physical airport. */
  airportId: string | null;
  airport: AirportHistoryAirport | null;
  matchedAssignment: FormalAssignment | null;
  formalMatches: AssignmentMatch[];
  candidateSites: CandidateSite[];
  candidates: HistoricalCandidate[];
  candidateSources: string[];
  observationTimestamps: {
    id: string;
    sourceId: string;
    revisionObservedAt: string;
    meaning: "directory_revision_observed";
  }[];
  currentDirectoryAirport: AirportReference | null;
  uncertainty: AirportHistoryUncertainty;
  dataVersion: string;
}

const TIMESTAMP_MEANING =
  "revisionObservedAt is when an upstream directory revision was observed; it is not a code effective date or allocation date.";

/** Candidate sites farther than this from the current directory entry are a different physical site. */
export const SAME_SITE_KILOMETERS = 10;

interface RawFormalPackage {
  dataVersion: string;
  schemaVersion: string;
  airports: {
    airportId: string;
    coordinates: {
      value: { latitude: number; longitude: number };
      note?: string;
    };
    name: { value: string; note?: string };
    timezone: { value: string };
    externalIds?: Record<string, string>;
  }[];
  assignments: (Omit<FormalAssignment, "scheme"> & { scheme: string })[];
  sources: FormalSource[];
  names?: {
    airportId: string;
    name: string;
    language?: string;
    validFrom: UncertainDateBound;
    validTo: UncertainDateBound;
  }[];
}

const manifest = packageManifest as {
  dataVersion: string;
  counts: Record<string, unknown>;
  files: Record<
    string,
    {
      sha256: string;
      contentSha256: string;
      records: number;
      bytes: number;
      layer: string;
      schemaVersion: string;
    }
  >;
};

export const airportHistoryDataVersion: string = manifest.dataVersion;
export const airportHistoryManifest = manifest;

const formal = formalPackage as unknown as RawFormalPackage;
export const formalAirports = new Map<string, FormalAirport>(
  formal.airports.map((airport) => [
    airport.airportId,
    {
      airportId: airport.airportId,
      name: airport.name.value,
      nameNote: airport.name.note,
      latitude: airport.coordinates.value.latitude,
      longitude: airport.coordinates.value.longitude,
      coordinatesNote: airport.coordinates.note,
      timezone: airport.timezone.value,
      externalIds: airport.externalIds ?? {},
    },
  ]),
);
export const formalAssignments: FormalAssignment[] = formal.assignments
  .filter((row) => row.scheme === "IATA" || row.scheme === "ICAO")
  .map((row) => ({ ...row, scheme: row.scheme as AirportCodeScheme }));
export const formalSources = new Map(
  formal.sources.map((source) => [source.sourceId, source]),
);
export const formalHistoricalNames = formal.names ?? [];
const assignmentsByCode = new Map<string, FormalAssignment[]>();
for (const row of formalAssignments) {
  const key = `${row.scheme}:${row.code}`;
  assignmentsByCode.set(key, [...(assignmentsByCode.get(key) ?? []), row]);
}

export function formalAssignmentsForCode(
  code: string,
  scheme: AirportCodeScheme = "IATA",
): FormalAssignment[] {
  return assignmentsByCode.get(`${scheme}:${code.toUpperCase()}`) ?? [];
}

/** Reproduces upstream `bulk/worldwide.py` `_relation` for half-open intervals. */
export function assignmentDateRelation(
  day: string,
  row: FormalAssignment,
): AssignmentDateRelation {
  const from = row.validFrom;
  const to = row.validTo;
  const insideOuter =
    (from.earliest === null || day >= from.earliest) &&
    (to.latest === null || day < to.latest);
  if (!insideOuter) return "excluded";
  const insideCertain =
    from.latest !== null &&
    day >= from.latest &&
    to.earliest !== null &&
    day < to.earliest;
  return insideCertain ? "certain" : "possible";
}

// ------------------------------------------------------- candidate layer ---

interface RawSite {
  siteId: string;
  airportId: string | null;
  name: string | null;
  country: string | null;
  coordinates: [number, number] | null;
  timezone: string | null;
  identityStatus: string;
  municipality?: string | null;
  referenceIds?: string[];
  locationIds?: string[];
  ambiguousLocation: boolean;
  linkedByCandidate?: boolean;
  observations?: {
    observationId: string;
    referenceId: string;
    locationIds: string[];
    sourceId: string;
    kind: string;
    side: string | null;
    revisionObservedAt: string | null;
    candidateId: string | null;
    commit: string | null;
    blob: string | null;
    ambiguousLocation: boolean;
  }[];
}

export interface ObservationShardRow {
  scheme: AirportCodeScheme;
  code: string;
  sites: RawSite[];
}

export interface TransitionMemberRow {
  candidateId: string;
  sourceId: string | null;
  sourceEntityId: string | null;
  classification: string | null;
  firstRevisionObservedAt: string | null;
  lastRevisionObservedAt: string | null;
  candidateStatus: string | null;
  changes: Record<string, [string | null, string | null]>;
  sourceRevisions: HistoricalCandidate["sourceRevisions"];
  possibleSites: RawSite[];
}

export interface TransitionCodeShardRow {
  scheme: AirportCodeScheme;
  code: string;
  leads: {
    eventGroupId: string;
    candidateId: string;
    side: "before" | "after";
    group: {
      name: string | null;
      country: string | null;
      status: string | null;
      classifications: string[];
      referenceId: string | null;
    };
    candidate: TransitionMemberRow;
  }[];
}

/** Canonical full event-group rows (all 88,330); not needed for code resolution. */
export interface TransitionGroupRow {
  eventGroupId: string;
  name: string | null;
  country: string | null;
  status: string | null;
  classifications: string[];
  physicalMatch: { referenceId?: string } | null;
  members: TransitionMemberRow[];
}

export interface SearchIndexRow {
  scheme: AirportCodeScheme;
  code: string;
  siteId: string;
  name: string;
  country: string | null;
  identityStatus: string;
  inPinnedSnapshot: boolean;
}

const observationsByCode = new Map<string, ObservationShardRow>();
const transitionsByCode = new Map<string, TransitionCodeShardRow>();
const loadedShards = new Set<string>();
const failedShards = new Set<string>();
let candidateVersion = 0;
const listeners = new Set<() => void>();

export function airportHistoryShard(key: string): string {
  return sha256Hex(key)[0]!;
}

export function observationShardPath(
  scheme: AirportCodeScheme,
  code: string,
): string {
  return `observations/${scheme.toLowerCase()}.${airportHistoryShard(`${scheme}:${code}`)}.jsonl.gz`;
}

export function transitionCodeShardPath(
  scheme: AirportCodeScheme,
  code: string,
): string {
  return `transitions/codes.${scheme.toLowerCase()}.${airportHistoryShard(`${scheme}:${code}`)}.jsonl.gz`;
}

export function transitionGroupShardPath(shard: string): string {
  return `transitions/groups.${shard}.jsonl.gz`;
}

export function airportHistoryCandidateVersion(): number {
  return candidateVersion;
}

export function subscribeAirportHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed(): void {
  candidateVersion += 1;
  for (const listener of listeners) listener();
}

/** Installs one parsed shard. `path` is the manifest-relative file name. */
export function installAirportHistoryShard(
  path: string,
  rows: readonly unknown[],
): void {
  if (
    path.startsWith("observations/") &&
    !path.includes("records.") &&
    !path.includes("search-index")
  ) {
    for (const row of rows as ObservationShardRow[])
      observationsByCode.set(`${row.scheme}:${row.code}`, row);
  } else if (path.startsWith("transitions/codes.")) {
    for (const row of rows as TransitionCodeShardRow[])
      transitionsByCode.set(`${row.scheme}:${row.code}`, row);
  } else if (path === "observations/search-index.jsonl.gz") {
    searchRows = (
      rows as [string, string, string, string, string | null, string, number][]
    ).map(
      ([scheme, code, siteId, name, country, identityStatus, snapshot]) => ({
        scheme: scheme as AirportCodeScheme,
        code,
        siteId,
        name,
        country,
        identityStatus,
        inPinnedSnapshot: Boolean(snapshot),
      }),
    );
  }
  loadedShards.add(path);
  failedShards.delete(path);
  changed();
}

export function markAirportHistoryShardUnavailable(path: string): void {
  failedShards.add(path);
  changed();
}

/** Test helper: forget every installed candidate shard. */
export function resetAirportHistoryCandidates(): void {
  observationsByCode.clear();
  transitionsByCode.clear();
  loadedShards.clear();
  failedShards.clear();
  searchRows = null;
  changed();
}

export function isAirportHistoryShardLoaded(path: string): boolean {
  return loadedShards.has(path);
}

/** Shards needed before the candidate layer can answer for a code. */
export function requiredCandidateShards(
  code: string,
  scheme: AirportCodeScheme = "IATA",
): string[] {
  const normalized = code.toUpperCase();
  return [
    observationShardPath(scheme, normalized),
    transitionCodeShardPath(scheme, normalized),
  ];
}

function candidateLayerReady(code: string, scheme: AirportCodeScheme): boolean {
  return requiredCandidateShards(code, scheme).every((path) =>
    loadedShards.has(path),
  );
}

export interface AirportHistoryLoader {
  /** Returns the parsed JSONL rows of one package file. */
  loadRows(path: string): Promise<unknown[]>;
}

const pendingLoads = new Map<string, Promise<void>>();

async function loadShard(
  loader: AirportHistoryLoader,
  path: string,
): Promise<void> {
  if (loadedShards.has(path)) return;
  let pending = pendingLoads.get(path);
  if (!pending) {
    pending = loader
      .loadRows(path)
      .then((rows) => installAirportHistoryShard(path, rows))
      .catch(() => markAirportHistoryShardUnavailable(path))
      .finally(() => pendingLoads.delete(path));
    pendingLoads.set(path, pending);
  }
  await pending;
}

/** Loads every candidate shard the given codes need (observations + transition code index). */
export async function ensureAirportHistoryCodes(
  loader: AirportHistoryLoader,
  codes: Iterable<{ code: string; scheme?: AirportCodeScheme }>,
): Promise<void> {
  const paths = new Set<string>();
  for (const { code, scheme = "IATA" } of codes) {
    const normalized = code.toUpperCase();
    if (!isValidAirportCode(normalized, scheme)) continue;
    for (const path of requiredCandidateShards(normalized, scheme))
      paths.add(path);
  }
  await Promise.all([...paths].map((path) => loadShard(loader, path)));
}

let searchRows: SearchIndexRow[] | null = null;

export function airportHistorySearchRows(): SearchIndexRow[] | null {
  return searchRows;
}

export async function ensureAirportHistorySearchIndex(
  loader: AirportHistoryLoader,
): Promise<void> {
  await loadShard(loader, "observations/search-index.jsonl.gz");
}

// ----------------------------------------------------------- resolution ---

export function isValidAirportCode(
  code: string,
  scheme: AirportCodeScheme = "IATA",
): boolean {
  return scheme === "IATA" ? /^[A-Z]{3}$/.test(code) : /^[A-Z]{4}$/.test(code);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function site(raw: RawSite): CandidateSite {
  return {
    siteId: raw.siteId,
    formalAirportId: raw.airportId,
    locationIds:
      raw.locationIds ??
      [
        ...new Set((raw.observations ?? []).flatMap((o) => o.locationIds)),
      ].sort(),
    referenceIds: raw.referenceIds ?? [],
    name: raw.name,
    country: raw.country,
    latitude: raw.coordinates?.[0] ?? null,
    longitude: raw.coordinates?.[1] ?? null,
    timezone: raw.timezone,
    identityStatus: raw.identityStatus,
    ambiguousLocation: raw.ambiguousLocation,
  };
}

function codeSide(
  changes: Record<string, [string | null, string | null]>,
  scheme: AirportCodeScheme,
): [string | null, string | null] {
  const keys =
    scheme === "IATA"
      ? ["iata", "iata_code"]
      : ["icao", "icao_code", "gps_code"];
  for (const key of keys) {
    const value = changes[key];
    if (Array.isArray(value)) return [value[0] || null, value[1] || null];
  }
  return [null, null];
}

function collectCandidates(code: string, scheme: AirportCodeScheme) {
  const key = `${scheme}:${code}`;
  const observations = observationsByCode.get(key);
  const transitions = transitionsByCode.get(key);
  const candidateSites = (observations?.sites ?? []).map(site);
  const observationRows: CandidateObservation[] = (
    observations?.sites ?? []
  ).flatMap((raw) =>
    (raw.observations ?? []).map((o) => ({
      observationId: o.observationId,
      referenceId: o.referenceId,
      siteId: raw.siteId,
      sourceId: o.sourceId,
      kind: o.kind,
      side: o.side,
      candidateId: o.candidateId,
      commit: o.commit,
      blob: o.blob,
      revisionObservedAt: o.revisionObservedAt,
    })),
  );
  const candidates: HistoricalCandidate[] = [];
  for (const lead of transitions?.leads ?? []) {
    const member = lead.candidate;
    const [before, after] = codeSide(member.changes, scheme);
    candidates.push({
      eventGroupId: lead.eventGroupId,
      candidateId: lead.candidateId,
      side: lead.side,
      before,
      after,
      groupName: lead.group.name,
      groupCountry: lead.group.country,
      referenceId: lead.group.referenceId,
      classifications: lead.group.classifications,
      memberClassification: member.classification,
      groupStatus: lead.group.status,
      candidateStatus: member.candidateStatus,
      sourceId: member.sourceId,
      sourceEntityId: member.sourceEntityId,
      firstRevisionObservedAt: member.firstRevisionObservedAt,
      lastRevisionObservedAt: member.lastRevisionObservedAt,
      sourceRevisions: member.sourceRevisions,
      possibleSites: member.possibleSites.map((raw) => ({
        ...site(raw),
        linkedByCandidate: Boolean(raw.linkedByCandidate),
      })),
    });
  }
  return {
    candidateSites,
    observationRows,
    candidates,
    hasHistoricalObservation: observationRows.some(
      (o) => o.kind !== "pinned_snapshot",
    ),
  };
}

function sitesWithCoordinates(
  candidateSites: CandidateSite[],
  candidates: HistoricalCandidate[],
): CandidateSite[] {
  const all = new Map<string, CandidateSite>();
  for (const item of [
    ...candidateSites,
    ...candidates.flatMap((c) => c.possibleSites),
  ])
    all.set(item.siteId, item);
  return [...all.values()];
}

function formalAirportView(
  airportId: string,
  country: string | null = null,
): AirportHistoryAirport | null {
  const airport = formalAirports.get(airportId);
  if (!airport) return null;
  return {
    airportId,
    name: airport.name,
    latitude: airport.latitude,
    longitude: airport.longitude,
    timezone: airport.timezone,
    country,
    basis: "formal",
  };
}

/**
 * Resolves a code at a local calendar date (YYYY-MM-DD). Priority:
 * formal assignment -> worldwide historical candidates -> current directory -> unknown.
 */
export function resolveAirportAtDate(
  rawCode: string,
  date: string,
  scheme: AirportCodeScheme = "IATA",
): AirportHistoryResolution {
  const code = rawCode.trim().toUpperCase();
  const currentDirectoryAirport =
    scheme === "IATA" ? (airportByIata.get(code) ?? null) : null;
  const base = {
    code,
    scheme,
    queryDate: date,
    airportId: null,
    airport: null,
    matchedAssignment: null,
    formalMatches: [] as AssignmentMatch[],
    candidateSites: [] as CandidateSite[],
    candidates: [] as HistoricalCandidate[],
    candidateSources: [] as string[],
    observationTimestamps:
      [] as AirportHistoryResolution["observationTimestamps"],
    currentDirectoryAirport,
    dataVersion: airportHistoryDataVersion,
  };
  const uncertainty = (
    partial: Partial<AirportHistoryUncertainty>,
  ): AirportHistoryUncertainty => ({
    reason: "none",
    possibleAirportIds: [],
    assignments: [],
    candidateTimezones: [],
    candidateSitesMatchCurrentDirectory: null,
    timestampMeaning: TIMESTAMP_MEANING,
    ...partial,
  });
  if (!isValidAirportCode(code, scheme)) {
    return { ...base, status: "unknown_code", uncertainty: uncertainty({}) };
  }
  if (!isIsoDate(date)) {
    return {
      ...base,
      status: "unknown_code",
      currentDirectoryAirport,
      uncertainty: uncertainty({ reason: "invalid_date" }),
    };
  }

  // 1. Formal layer.
  const matches = formalAssignmentsForCode(code, scheme)
    .map((assignment) => ({
      assignment,
      relation: assignmentDateRelation(date, assignment),
    }))
    .filter((match) => match.relation !== "excluded");
  const certain = new Set(
    matches
      .filter((m) => m.relation === "certain")
      .map((m) => m.assignment.airportId),
  );
  const possible = new Set(
    matches
      .filter((m) => m.relation === "possible")
      .map((m) => m.assignment.airportId),
  );
  const assignmentSummary = matches.map((m) => ({
    assignmentId: m.assignment.assignmentId,
    airportId: m.assignment.airportId,
    relation: m.relation,
    validFrom: m.assignment.validFrom,
    validTo: m.assignment.validTo,
  }));

  // Candidates are attached to every answer whose shards are loaded.
  const ready = candidateLayerReady(code, scheme);
  const collected = ready ? collectCandidates(code, scheme) : null;
  const candidateFields = collected
    ? {
        candidateSites: collected.candidateSites,
        candidates: collected.candidates,
        candidateSources: [
          ...new Set([
            ...collected.observationRows.map((o) => o.sourceId),
            ...collected.candidates
              .map((c) => c.sourceId)
              .filter((v): v is string => Boolean(v)),
          ]),
        ].sort(),
        observationTimestamps: [
          ...collected.observationRows
            .filter((o) => o.revisionObservedAt)
            .map((o) => ({
              id: o.observationId,
              sourceId: o.sourceId,
              revisionObservedAt: o.revisionObservedAt!,
              meaning: "directory_revision_observed" as const,
            })),
          ...collected.candidates.flatMap((c) =>
            c.sourceRevisions
              .filter((r) => r.revisionObservedAt)
              .map((r) => ({
                id: c.candidateId,
                sourceId: c.sourceId ?? "",
                revisionObservedAt: r.revisionObservedAt!,
                meaning: "directory_revision_observed" as const,
              })),
          ),
        ],
      }
    : {};
  const allSites = collected
    ? sitesWithCoordinates(collected.candidateSites, collected.candidates)
    : [];
  const candidateTimezones = [
    ...new Set(
      allSites.map((s) => s.timezone).filter((tz): tz is string => Boolean(tz)),
    ),
  ].sort();

  if (matches.length) {
    if (certain.size === 1 && [...possible].every((id) => certain.has(id))) {
      const airportId = [...certain][0]!;
      const matched = matches.find(
        (m) => m.relation === "certain" && m.assignment.airportId === airportId,
      )!;
      return {
        ...base,
        ...candidateFields,
        status: "resolved",
        airportId,
        airport: formalAirportView(
          airportId,
          currentDirectoryAirport?.country ?? null,
        ),
        matchedAssignment: matched.assignment,
        formalMatches: matches,
        uncertainty: uncertainty({
          possibleAirportIds: [airportId],
          assignments: assignmentSummary,
          candidateTimezones,
        }),
      };
    }
    const possibleAirportIds = [...new Set([...certain, ...possible])].sort();
    return {
      ...base,
      ...candidateFields,
      status: certain.size > 1 ? "ambiguous" : "uncertain",
      formalMatches: matches,
      uncertainty: uncertainty({
        reason:
          certain.size > 1
            ? "multiple_certain_airports"
            : "date_in_uncertain_boundary",
        possibleAirportIds,
        assignments: assignmentSummary,
        candidateTimezones,
      }),
    };
  }

  // 2. Worldwide candidates (never resolve, never mint an airportId).
  if (!collected) {
    return {
      ...base,
      status: "candidate_index_unavailable",
      uncertainty: uncertainty({ reason: "candidate_index_unavailable" }),
    };
  }
  const hasCandidates =
    collected.candidates.length > 0 || collected.candidateSites.length > 0;
  if (hasCandidates) {
    let consistent: boolean | null = null;
    if (currentDirectoryAirport) {
      const located = allSites.filter(
        (s) => s.latitude !== null && s.longitude !== null,
      );
      consistent =
        located.length > 0 &&
        located.every(
          (s) =>
            distanceKilometers(currentDirectoryAirport, {
              latitude: s.latitude!,
              longitude: s.longitude!,
            }) <= SAME_SITE_KILOMETERS,
        );
    }
    if (currentDirectoryAirport && consistent) {
      // Every location hypothesis is the current directory's own site: the
      // directory is the explicit basis. History stays attached and visible.
      return {
        ...base,
        ...candidateFields,
        status: "current_directory_only",
        airport: currentDirectoryView(currentDirectoryAirport),
        uncertainty: uncertainty({
          reason: "no_formal_assignment",
          candidateTimezones,
          candidateSitesMatchCurrentDirectory: true,
        }),
      };
    }
    return {
      ...base,
      ...candidateFields,
      status: "historical_candidate",
      uncertainty: uncertainty({
        reason: "no_formal_assignment",
        candidateTimezones,
        candidateSitesMatchCurrentDirectory: currentDirectoryAirport
          ? false
          : null,
      }),
    };
  }

  // 3. Current directory.
  if (currentDirectoryAirport) {
    return {
      ...base,
      ...candidateFields,
      status: "current_directory_only",
      airport: currentDirectoryView(currentDirectoryAirport),
      uncertainty: uncertainty({ reason: "no_formal_assignment" }),
    };
  }
  // 4. Unknown.
  return {
    ...base,
    ...candidateFields,
    status: "unknown_code",
    uncertainty: uncertainty({ reason: "no_formal_assignment" }),
  };
}

function currentDirectoryView(
  airport: AirportReference,
): AirportHistoryAirport {
  return {
    airportId: null,
    name: airport.name.en,
    latitude: airport.latitude,
    longitude: airport.longitude,
    timezone: airport.timezone,
    country: airport.country,
    basis: "current_directory",
  };
}

// --------------------------------------------------------------- search ---

export type HistoricalAirportSearchResult =
  | {
      kind: "formal";
      airportId: string;
      name: string;
      latitude: number;
      longitude: number;
      timezone: string;
      matchedName: string;
      assignments: FormalAssignment[];
    }
  | {
      kind: "candidate";
      scheme: AirportCodeScheme;
      code: string;
      siteId: string;
      name: string;
      country: string | null;
      identityStatus: string;
      inPinnedSnapshot: boolean;
    };

function fold(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLocaleLowerCase();
}

/**
 * Searches formal historical airports (names, historical names and every code
 * they ever held) and, once the search index shard is loaded, worldwide
 * candidate sites by historical code or name. Candidates stay candidates.
 */
export function searchHistoricalAirports(
  query: string,
  limit = 8,
): HistoricalAirportSearchResult[] {
  const term = fold(query.trim());
  if (!term || limit <= 0) return [];
  const upper = query.trim().toUpperCase();
  const results: HistoricalAirportSearchResult[] = [];
  const scored: [number, HistoricalAirportSearchResult][] = [];
  for (const airport of formalAirports.values()) {
    const assignments = formalAssignments.filter(
      (row) => row.airportId === airport.airportId,
    );
    const historicalNames = formalHistoricalNames
      .filter((row) => row.airportId === airport.airportId)
      .map((row) => row.name);
    const names = [airport.name, ...historicalNames];
    const codeHit = assignments.some((row) => row.code === upper);
    const codePrefix = assignments.some((row) => row.code.startsWith(upper));
    const nameHit = names.find((name) => fold(name).includes(term));
    if (!codeHit && !codePrefix && !nameHit) continue;
    scored.push([
      codeHit ? 0 : codePrefix ? 1 : 2,
      {
        kind: "formal",
        airportId: airport.airportId,
        name: airport.name,
        latitude: airport.latitude,
        longitude: airport.longitude,
        timezone: airport.timezone,
        matchedName: nameHit ?? airport.name,
        assignments,
      },
    ]);
  }
  const rows = searchRows ?? [];
  for (const row of rows) {
    const codeHit = row.code === upper;
    const nameHit = term.length >= 3 && fold(row.name).includes(term);
    if (!codeHit && !nameHit) continue;
    // A row that is merely today's directory entry for a code already in the
    // directory adds nothing; historical rows and unknown codes do.
    if (
      row.inPinnedSnapshot &&
      row.scheme === "IATA" &&
      airportByIata.has(row.code) &&
      !codeHit
    )
      continue;
    scored.push([codeHit ? 3 : 4, { kind: "candidate", ...row }]);
  }
  scored.sort(
    (a, b) => a[0] - b[0] || resultLabel(a[1]).localeCompare(resultLabel(b[1])),
  );
  for (const [, item] of scored) {
    if (results.length >= limit) break;
    results.push(item);
  }
  return results;
}

function resultLabel(result: HistoricalAirportSearchResult): string {
  return result.kind === "formal"
    ? `${result.name}|${result.airportId}`
    : `${result.code}|${result.name}|${result.siteId}`;
}

// --------------------------------------------------------------- loading ---

async function gunzip(bytes: Uint8Array): Promise<string> {
  // A server may already have removed the gzip layer (Content-Encoding).
  if (!(bytes[0] === 0x1f && bytes[1] === 0x8b))
    return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return await new Response(stream).text();
}

/**
 * Builds a loader over any byte source (same-origin static asset, local file in
 * tests). It verifies the manifest SHA-256 of every file before installing it,
 * so a stale or truncated cache entry is reported unavailable, not trusted.
 */
export function createAirportHistoryLoader(
  readBytes: (path: string) => Promise<Uint8Array>,
  options: { verify?: boolean } = {},
): AirportHistoryLoader {
  const verify = options.verify ?? true;
  return {
    async loadRows(path: string) {
      const expected = manifest.files[path];
      if (!expected) throw new Error(`Unknown airport-history file: ${path}`);
      const bytes = await readBytes(path);
      if (verify && globalThis.crypto?.subtle) {
        const digest = new Uint8Array(
          await globalThis.crypto.subtle.digest(
            "SHA-256",
            bytes as BufferSource,
          ),
        );
        const hex = [...digest]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const content = hex === expected.sha256;
        if (!content) {
          // Accept a transport-decoded body only if its content hash matches.
          const text = await gunzip(bytes);
          const decoded = new Uint8Array(
            await globalThis.crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(text) as BufferSource,
            ),
          );
          const decodedHex = [...decoded]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
          if (decodedHex !== expected.contentSha256)
            throw new Error(
              `Airport-history file failed SHA-256 verification: ${path}`,
            );
          return parseJsonl(text);
        }
      }
      return parseJsonl(await gunzip(bytes));
    },
  };
}

function parseJsonl(text: string): unknown[] {
  const rows: unknown[] = [];
  for (const line of text.split("\n")) if (line) rows.push(JSON.parse(line));
  return rows;
}
