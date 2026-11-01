#!/usr/bin/env python3
"""Rebuild Keepraw Fly's permanent two-layer airport-history data package.

The package is generated from ONE pinned keepraw/airport-history commit:

1. The upstream checkout is fetched at the pinned commit (or an existing
   checkout is verified to be exactly that commit with a clean tree).
2. The upstream full-corpus builder ``bulk/worldwide.py build`` is executed
   unchanged. It verifies every pinned input hash and materializes all 16
   reference shards, all 88,330 event groups and their selected candidates.
3. The SQLite result plus the original group/candidate/reference rows are
   exported into browser-sized, deterministic, code-sharded JSONL.GZ files.

Nothing here downloads a GitHub Actions artifact, and the application never
contacts GitHub: the generated files are committed to Keepraw Fly.

Usage:
  python3 scripts/update-airport-history.py                # rebuild in place
  python3 scripts/update-airport-history.py --check        # rebuild + compare
  python3 scripts/update-airport-history.py --upstream DIR # reuse a checkout
  python3 scripts/update-airport-history.py --commit SHA   # move the pin
"""
from __future__ import annotations

import argparse
import gzip
import hashlib
import io
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from collections import defaultdict
from pathlib import Path

REPOSITORY = "https://github.com/keepraw/airport-history"
UPSTREAM_COMMIT = "19b7b1decfe2b43916fd4607b049ebb79293ae77"
PACKAGE_SCHEMA_VERSION = "1.0.0"
ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "packages/core/data/airport-history"
SHARDS = "0123456789abcdef"
SCHEMES = ("IATA", "ICAO", "GPS", "LOCAL", "IDENT")
FLIGHT_SCHEMES = ("IATA", "ICAO")
# Raw candidate change keys kept verbatim. Other keys (links, keywords, elevation)
# are dropped only to keep the package compact; every candidate keeps its
# commit/blob locators so the original row can always be re-read upstream.
CHANGE_KEYS = (
    "iata", "iata_code", "icao", "icao_code", "gps_code", "ident", "local_code",
    "name", "type", "lat", "lon", "latitude", "longitude", "latitude_deg",
    "longitude_deg", "country", "iso_country", "municipality", "city", "tz",
    "timezone", "scheduled_service",
)
MEANING = {
    "revisionObservedAt": "Time an upstream directory revision was observed. NOT a code effective date, NOT an allocation date.",
    "locationId": "loc_ IDs are physical location hypotheses, never approved airports.",
    "airportId": "apt_ IDs are reviewed physical airports from the formal layer. Only formal assignments resolve a date.",
    "ourairports": "A current OurAirports row is not proof of a historical IATA/ICAO allocation.",
}


def canonical(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def shard_of(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()[0]


def read_jsonl(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        for line in stream:
            yield json.loads(line)


def gzip_bytes(raw: bytes) -> bytes:
    """Deterministic gzip: empty file name, fixed mtime 0, level 9."""
    buffer = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=buffer, mtime=0, compresslevel=9) as stream:
        stream.write(raw)
    return buffer.getvalue()


def run(command, cwd=None):
    subprocess.run(command, cwd=cwd, check=True)


def git_output(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def fetch_upstream(commit: str, workdir: Path) -> Path:
    target = workdir / "airport-history"
    target.mkdir(parents=True)
    run(["git", "init", "-q"], cwd=target)
    run(["git", "remote", "add", "origin", REPOSITORY + ".git"], cwd=target)
    run(["git", "fetch", "-q", "--depth", "1", "origin", commit], cwd=target)
    run(["git", "-c", "advice.detachedHead=false", "checkout", "-q", "FETCH_HEAD"], cwd=target)
    return target


def verify_upstream(path: Path, commit: str) -> None:
    head = git_output(path, "rev-parse", "HEAD")
    if head != commit:
        raise SystemExit(f"Upstream checkout is {head}, expected pinned {commit}")
    dirty = git_output(path, "status", "--porcelain", "--untracked-files=no")
    if dirty:
        raise SystemExit("Upstream checkout has modified tracked files; refusing to build")


# ---------------------------------------------------------------- build -----


class Package:
    def __init__(self) -> None:
        self.files: dict[str, dict] = {}
        self.payloads: dict[str, bytes] = {}

    def add_jsonl(self, name: str, rows: list, layer: str, schema: str) -> None:
        raw = "".join(canonical(row) + "\n" for row in rows).encode("utf-8")
        data = gzip_bytes(raw)
        self.payloads[name] = data
        self.files[name] = {
            "bytes": len(data), "contentSha256": sha256_bytes(raw), "layer": layer,
            "records": len(rows), "schemaVersion": schema, "sha256": sha256_bytes(data),
        }

    def add_raw(self, name: str, data: bytes, layer: str, schema: str, records: int) -> None:
        self.payloads[name] = data
        self.files[name] = {
            "bytes": len(data), "contentSha256": sha256_bytes(data), "layer": layer,
            "records": records, "schemaVersion": schema, "sha256": sha256_bytes(data),
        }


def coordinate(value):
    if not value:
        return None
    lat, lon = value.get("latitude"), value.get("longitude")
    if lat is None or lon is None:
        return None
    return [round(float(lat), 6), round(float(lon), 6)]


def build_package(upstream: Path, commit: str, workdir: Path) -> tuple[Package, dict]:
    database = workdir / "history-index.sqlite"
    builder = upstream / "bulk/worldwide.py"
    completed = subprocess.run([sys.executable, str(builder), "build", "--output", str(database)],
                               cwd=upstream, check=True, capture_output=True, text=True)
    build_report = json.loads(completed.stdout.strip().splitlines()[-1])
    db = sqlite3.connect(f"file:{database}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    metadata = {row["key"]: row["value"] for row in db.execute("SELECT key,value FROM metadata")}
    inputs = json.loads(metadata["inputs"])

    curated_path = upstream / "data/airports.json"
    curated_bytes = curated_path.read_bytes()
    curated = json.loads(curated_bytes)
    package = Package()
    package.add_raw("formal/airports.json", curated_bytes, "formal", curated["schemaVersion"], len(curated["airports"]))

    # ---- reference records: site metadata + location hypotheses ----------
    reference_dir = upstream / "reference/generated"
    site_meta: dict[str, dict] = {}
    record_meta: dict[str, dict] = {}
    record_count = 0
    record_rows: dict[str, list] = defaultdict(list)
    for shard in SHARDS:
        for record in read_jsonl(reference_dir / f"records.{shard}.jsonl.gz"):
            record_count += 1
            ref = record["referenceId"]
            record_rows[shard_of(ref)].append({
                "referenceId": ref, "sourceId": record["sourceId"], "sourceEntityId": record.get("sourceEntityId"),
                "name": record["name"], "country": record["country"], "region": record.get("region"),
                "municipality": record.get("municipality"), "facilityType": record.get("facilityType"),
                "timezone": record.get("timezone"), "identityStatus": record.get("identityStatus"),
                "presentAtSnapshot": record.get("presentAtSnapshot"), "observedAt": record.get("observedAt"),
                "snapshot": record.get("observation"), "flags": record.get("flags", []),
                "identifiers": record["identifiers"],
                # IATA/ICAO historical identifiers live, with commit/blob, in
                # the observation code shards (kind=source_transition). Only
                # other schemes would need a copy here.
                "historicalIdentifiers": [
                    {k: h.get(k) for k in ("scheme", "code", "side", "candidateId", "sourceId", "commit", "blob", "revisionObservedAt")}
                    for h in record.get("historicalIdentifiers", []) if h.get("scheme") not in FLIGHT_SCHEMES
                ],
                # Names identical to the current label add no history; the rest
                # power historical-name search. Every candidate keeps its own
                # name changes in the transitions layer.
                "historicalNames": sorted(
                    ({k: h.get(k) for k in ("name", "side", "candidateId", "sourceId", "revisionObservedAt")}
                     for h in record.get("historicalNames", []) if h.get("name") and h.get("name") != record["name"]),
                    key=lambda h: (h["name"], h.get("candidateId") or "", h.get("side") or "")),
                "locations": [
                    {"locationId": loc["locationId"], "kind": loc.get("kind"),
                     "coordinates": coordinate(loc.get("coordinates")),
                     "candidateIds": sorted(loc.get("candidateIds", [])),
                     "curatedAirportIds": sorted(loc.get("curatedAirportIds", []))}
                    for loc in record["locations"]
                ],
            })
            record_meta[ref] = {
                "name": record["name"], "country": record["country"],
                "municipality": record.get("municipality"), "timezone": record.get("timezone"),
                "facilityType": record.get("facilityType"), "sourceId": record["sourceId"],
                "sourceEntityId": record.get("sourceEntityId"),
                "presentAtSnapshot": record.get("presentAtSnapshot"),
                "locations": [
                    {"locationId": loc["locationId"], "kind": loc.get("kind"),
                     "coordinates": coordinate(loc.get("coordinates")),
                     "candidateIds": sorted(loc.get("candidateIds", [])),
                     "curatedAirportIds": sorted(loc.get("curatedAirportIds", []))}
                    for loc in record["locations"]
                ],
            }
    curated_airports = {a["airportId"]: a for a in curated["airports"]}
    for row in db.execute("SELECT * FROM sites ORDER BY site_id"):
        site_id = row["site_id"]
        timezone = None
        if site_id in curated_airports:
            timezone = curated_airports[site_id]["timezone"]["value"]
        elif row["reference_id"] in record_meta:
            timezone = record_meta[row["reference_id"]]["timezone"]
        site_meta[site_id] = {
            "siteId": site_id, "airportId": row["airport_id"], "name": row["name"],
            "country": row["country"],
            "coordinates": None if row["latitude"] is None else [round(row["latitude"], 6), round(row["longitude"], 6)],
            "timezone": timezone, "identityStatus": row["identity_status"],
        }
    source_sites = defaultdict(list)
    for row in db.execute("SELECT * FROM source_sites ORDER BY reference_id,location_id,site_id"):
        source_sites[row["reference_id"]].append({"locationId": row["location_id"], "siteId": row["site_id"]})

    # ---- observations layer ----------------------------------------------
    by_code: dict[tuple[str, str], dict[str, list]] = defaultdict(lambda: defaultdict(list))
    obs_by_candidate: dict[str, list] = defaultdict(list)
    obs_total = 0
    for row in db.execute("SELECT * FROM reference_observations ORDER BY scheme,code,site_id,observation_id"):
        obs_total += 1
        loc_ids = sorted({s["locationId"] for s in source_sites.get(row["reference_id"], []) if s["siteId"] == row["site_id"]})
        item = {
            "observationId": row["observation_id"], "referenceId": row["reference_id"],
            "locationIds": loc_ids, "sourceId": row["source_id"], "kind": row["kind"],
            "side": row["side"], "revisionObservedAt": row["revision_observed_at"],
            "candidateId": row["candidate_id"], "commit": row["source_commit"],
            "blob": row["source_blob"], "ambiguousLocation": bool(row["ambiguous_location"]),
        }
        by_code[(row["scheme"], row["code"])][row["site_id"]].append(item)
        if row["candidate_id"]:
            obs_by_candidate[row["candidate_id"]].append((row["site_id"], loc_ids, bool(row["ambiguous_location"])))

    obs_by_scheme = defaultdict(int)
    for (scheme, _code), sites in by_code.items():
        obs_by_scheme[scheme] += sum(len(v) for v in sites.values())
    observation_shards: dict[str, list] = defaultdict(list)
    code_counts = defaultdict(int)
    search_rows = []
    for (scheme, code), sites in sorted(by_code.items()):
        code_counts[scheme] += 1
        entry_sites = []
        for site_id, observations in sorted(sites.items()):
            meta = dict(site_meta[site_id])
            meta["municipality"] = None
            refs = sorted({o["referenceId"] for o in observations})
            for ref in refs:
                if ref in record_meta and record_meta[ref].get("municipality"):
                    meta["municipality"] = record_meta[ref]["municipality"]
                    break
            meta["referenceIds"] = refs
            meta["ambiguousLocation"] = any(o["ambiguousLocation"] for o in observations)
            meta["observations"] = observations
            entry_sites.append(meta)
            if scheme in FLIGHT_SCHEMES:
                search_rows.append([scheme, code, site_id, meta["name"], meta["country"],
                                    meta["identityStatus"], int(any(o["kind"] == "pinned_snapshot" for o in observations))])
        if scheme in FLIGHT_SCHEMES:
            observation_shards[f"observations/{scheme.lower()}.{shard_of(scheme + ':' + code)}.jsonl.gz"].append(
                {"scheme": scheme, "code": code, "sites": entry_sites})

    # ---- transitions layer -----------------------------------------------
    triage_dir = upstream / "reference/triage"
    discovery_dir = upstream / "research/discovery/generated"
    members = {row["candidate_id"]: row["group_id"] for row in db.execute("SELECT candidate_id,group_id FROM lead_members")}
    candidate_files = sorted(k[len("discovery/"):] for k in inputs if k.startswith("discovery/"))
    candidates: dict[str, dict] = {}
    for name in candidate_files:
        for item in read_jsonl(discovery_dir / name):
            cid = item["candidateId"]
            if cid not in members:
                continue
            changes = item.get("changes") or {}
            review = item.get("review") or {}
            candidates[cid] = {
                "changes": {k: changes[k] for k in CHANGE_KEYS if k in changes},
                "context": item.get("context"),
                "distanceKm": item.get("distanceKm"),
                "types": item.get("types", []),
                "candidateStatus": review.get("status"),
                "evidenceVerificationStatus": (item.get("evidence") or {}).get("verificationStatus"),
                "sourceRevisions": [
                    {"commit": o.get("commit"), "beforeBlob": o.get("beforeBlob"), "afterBlob": o.get("afterBlob"),
                     "action": o.get("action"), "revisionObservedAt": o.get("observedAt")}
                    for o in item.get("observations", [])
                ],
                "eventDate": (item.get("time") or {}).get("eventDate"),
                "eventDatePrecision": (item.get("time") or {}).get("eventDatePrecision"),
            }
    if len(candidates) != len(members):
        raise SystemExit(f"Candidate rows {len(candidates)} != selected members {len(members)}")

    code_obs = defaultdict(list)
    for row in db.execute("SELECT * FROM lead_code_observations ORDER BY scheme,code,group_id,candidate_id,side"):
        code_obs[(row["scheme"], row["code"])].append(
            {"eventGroupId": row["group_id"], "candidateId": row["candidate_id"], "side": row["side"]})

    group_shards: dict[str, list] = defaultdict(list)
    group_count = 0
    member_count = 0
    member_lookup: dict[str, dict] = {}
    group_lookup: dict[str, dict] = {}
    for group in read_jsonl(triage_dir / "groups.jsonl.gz"):
        group_count += 1
        match = group.get("physicalMatch") or {}
        ref = match.get("referenceId")
        group_members = []
        for member in sorted(group["members"], key=lambda m: m["candidateId"]):
            member_count += 1
            cid = member["candidateId"]
            detail = candidates[cid]
            linked = obs_by_candidate.get(cid, [])
            if linked:
                hyp = [{"siteId": s, "locationIds": l, "linkedByCandidate": True, "ambiguousLocation": a} for s, l, a in linked]
            elif ref and ref in source_sites:
                ss = source_sites[ref]
                hyp = [{"siteId": s["siteId"], "locationIds": [s["locationId"]], "linkedByCandidate": False,
                        "ambiguousLocation": len({x["siteId"] for x in ss}) > 1} for s in ss]
            else:
                hyp = []
            unique = {}
            for h in hyp:
                key = h["siteId"]
                if key in unique:
                    unique[key]["locationIds"] = sorted(set(unique[key]["locationIds"]) | set(h["locationIds"]))
                    unique[key]["ambiguousLocation"] = unique[key]["ambiguousLocation"] or h["ambiguousLocation"]
                else:
                    unique[key] = {**site_meta[key], **h}
            member_lookup[cid] = {
                "candidateId": cid, "sourceId": member.get("sourceId"),
                "sourceEntityId": member.get("sourceEntityId"),
                "classification": member.get("classification"),
                "distanceKm": member.get("distanceKm"),
                "firstRevisionObservedAt": member.get("firstRevisionObservedAt"),
                "lastRevisionObservedAt": member.get("lastRevisionObservedAt"),
                "observationCount": member.get("observationCount"),
                "possibleSites": [unique[k] for k in sorted(unique)],
                **detail,
            }
            group_members.append(member_lookup[cid])
        group_lookup[group["eventGroupId"]] = {
            "name": group.get("name"), "country": group.get("country"), "status": group.get("status"),
            "evidenceStatus": group.get("evidenceStatus"), "classifications": group.get("classifications", []),
            "referenceId": match.get("referenceId"),
        }
        group_shards[f"transitions/groups.{shard_of(group['eventGroupId'])}.jsonl.gz"].append({
            "eventGroupId": group["eventGroupId"], "name": group.get("name"), "country": group.get("country"),
            "status": group.get("status"), "evidenceStatus": group.get("evidenceStatus"),
            "classifications": group.get("classifications", []), "eventDate": group.get("eventDate"),
            "historicallyVerified": group.get("historicallyVerified"),
            "independentHistoricalConfirmations": group.get("independentHistoricalConfirmations"),
            "physicalMatch": match, "evidenceGaps": group.get("evidenceGaps", []),
            "sourceFamilies": group.get("sourceFamilies", []),
            "proposedHistoricalIntervals": group.get("proposedHistoricalIntervals", []),
            "members": group_members,
        })
    code_index_shards: dict[str, list] = defaultdict(list)
    transition_code_counts = defaultdict(int)
    for (scheme, code), entries in sorted(code_obs.items()):
        transition_code_counts[scheme] += 1
        code_index_shards[f"transitions/codes.{scheme.lower()}.{shard_of(scheme + ':' + code)}.jsonl.gz"].append(
            # Self-contained: the app answers a code from this one shard. The
            # canonical full group rows stay in transitions/groups.*.
            {"scheme": scheme, "code": code, "leads": [
                {**e, "group": group_lookup[e["eventGroupId"]], "candidate": member_lookup[e["candidateId"]]}
                for e in entries]})

    reuse = sorted(read_jsonl(triage_dir / "code-reuse-leads.jsonl.gz"), key=lambda r: (r["scheme"], r["code"]))

    # ---- write -----------------------------------------------------------
    # GPS/LOCAL/IDENT observations are not duplicated into code shards: each is
    # exactly one (record identifier x location hypothesis) pair of the records
    # layer. Re-derive them here and require the upstream SQLite count.
    derived = defaultdict(int)
    for rows in record_rows.values():
        for record in rows:
            pairs = set()
            for loc in record["locations"]:
                for site in (loc["curatedAirportIds"] or [loc["locationId"]]):
                    pairs.add((loc["locationId"], site))
            for scheme in ("GPS", "LOCAL", "IDENT"):
                value = record["identifiers"].get(scheme)
                if isinstance(value, str) and value and not any(ch.isspace() for ch in value):
                    derived[scheme] += len(pairs)
    for scheme in ("GPS", "LOCAL", "IDENT"):
        if derived[scheme] != obs_by_scheme[scheme]:
            raise SystemExit(f"{scheme} observations not derivable from records: {derived[scheme]} != {obs_by_scheme[scheme]}")
    for shard, rows in record_rows.items():
        rows.sort(key=lambda r: r["referenceId"])
        observation_shards[f"observations/records.{shard}.jsonl.gz"] = rows
    for shards in (observation_shards, group_shards, code_index_shards):
        for name in sorted(shards):
            layer = name.split("/")[0]
            rows = shards[name]
            rows.sort(key=lambda r: (r.get("scheme", ""), r.get("code", ""), r.get("eventGroupId", ""), r.get("referenceId", "")))
            package.add_jsonl(name, rows, layer, PACKAGE_SCHEMA_VERSION)
    search_rows.sort()
    package.add_jsonl("observations/search-index.jsonl.gz", search_rows, "observations", PACKAGE_SCHEMA_VERSION)
    package.add_jsonl("transitions/code-reuse-leads.jsonl.gz", reuse, "transitions", PACKAGE_SCHEMA_VERSION)

    triage_metrics = json.loads((triage_dir / "metrics.json").read_text())
    counts = {
        "formalAirports": len(curated["airports"]), "formalAssignments": len(curated["assignments"]),
        "formalSources": len(curated["sources"]), "formalNames": len(curated.get("names", [])),
        "referenceRecords": record_count, "referenceCodeObservations": obs_total,
        "materializedSites": len(site_meta), "eventGroups": group_count, "selectedCandidates": member_count,
        "transitionCodeObservations": sum(len(v) for v in code_obs.values()),
        "codeChangeObservations": triage_metrics["candidateClassifications"]["code_change_observation"],
        "geographicallyDistinctCodeLeads": len(reuse),
        "referenceCodeObservationsByScheme": dict(sorted(obs_by_scheme.items())),
        "exportedFlightCodeObservations": sum(obs_by_scheme[s] for s in FLIGHT_SCHEMES),
        "searchableObservationCodes": dict(sorted(code_counts.items())),
        "searchableTransitionCodes": dict(sorted(transition_code_counts.items())),
    }
    expected = build_report["metrics"]
    for ours, theirs in (("referenceRecords", "referenceRecords"), ("referenceCodeObservations", "referenceCodeObservations"),
                         ("eventGroups", "indexedEventGroups"), ("selectedCandidates", "indexedLeadMembers"),
                         ("formalAirports", "formalAirports"), ("formalAssignments", "formalCodeAssignments"),
                         ("transitionCodeObservations", "indexedTransitionCodeObservations"),
                         ("materializedSites", "materializedSites")):
        if counts[ours] != expected[theirs]:
            raise SystemExit(f"Count mismatch {ours}: {counts[ours]} != upstream {expected[theirs]}")
    if counts["eventGroups"] != triage_metrics["eventGroups"] or counts["selectedCandidates"] != triage_metrics["selectedCandidates"]:
        raise SystemExit("Event groups / candidates do not match upstream triage metrics")
    if counts["geographicallyDistinctCodeLeads"] != triage_metrics["geographicallyDistinctCodeLeads"]:
        raise SystemExit("Code reuse lead count does not match upstream triage metrics")

    # Upstream licensing travels with the redistributed data.
    for source, target in (("LICENSE-DATA", "licenses/LICENSE-DATA.CC0-1.0.txt"),
                           ("reference/LICENSE-airportsdata", "licenses/LICENSE-airportsdata.txt"),
                           ("THIRD_PARTY_NOTICES.md", "licenses/THIRD_PARTY_NOTICES.upstream.txt")):
        package.add_raw(target, (upstream / source).read_bytes(), "license", PACKAGE_SCHEMA_VERSION, 1)

    lock_inputs = {k: v for k, v in sorted(inputs.items())}
    for extra in ("data/airports.json", "bulk/worldwide.py", "reference/generated/manifest.json",
                  "reference/generated/metrics.json", "reference/triage/manifest.json",
                  "reference/triage/metrics.json", "reference/triage/code-reuse-leads.jsonl.gz",
                  "research/discovery/generated/manifest.json", "scripts/reference/common.py",
                  "LICENSE-DATA", "reference/LICENSE-airportsdata", "THIRD_PARTY_NOTICES.md"):
        lock_inputs["upstream/" + extra] = sha256_file(upstream / extra)
    source_lock = {
        "repository": REPOSITORY, "commit": commit,
        "tree": git_output(upstream, "rev-parse", "HEAD^{tree}"),
        "formalDataVersion": curated["dataVersion"], "formalSchemaVersion": curated["schemaVersion"],
        "builder": {"command": "python3 bulk/worldwide.py build", "sha256": sha256_file(builder),
                    "sqliteFormatVersion": metadata["formatVersion"],
                    "metrics": build_report["metrics"]},
        "inputs": lock_inputs,
        "note": "The SQLite database is a transient build product and is never committed or bundled. Its bytes depend on the local SQLite build, so only its format version and upstream metrics are locked here.",
    }
    package.add_raw("source-lock.json", (json.dumps(source_lock, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode(),
                    "lock", PACKAGE_SCHEMA_VERSION, len(lock_inputs))
    manifest = {
        "packageSchemaVersion": PACKAGE_SCHEMA_VERSION,
        "dataVersion": f"{curated['dataVersion']}+{commit[:12]}",
        "upstream": {"repository": REPOSITORY, "commit": commit, "formalDataVersion": curated["dataVersion"],
                     "formalSchemaVersion": curated["schemaVersion"]},
        "counts": counts,
        "derivedObservations": "GPS/LOCAL/IDENT reference observations are the records layer's identifiers x location hypotheses; the builder re-derives them and requires the upstream count.",
        "sharding": {"observations": "observations/<iata|icao>.<sha256('SCHEME:CODE')[0]>.jsonl.gz",
                     "records": "observations/records.<sha256(referenceId)[0]>.jsonl.gz",
                     "transitionCodes": "transitions/codes.<scheme>.<sha256('SCHEME:CODE')[0]>.jsonl.gz",
                     "transitionGroups": "transitions/groups.<sha256(eventGroupId)[0]>.jsonl.gz"},
        "gzip": {"mtime": 0, "filename": "", "level": 9},
        "meaning": MEANING,
        "files": dict(sorted(package.files.items())),
    }
    db.close()
    return package, manifest


def write_package(package: Package, manifest: dict, output: Path) -> None:
    if output.exists():
        shutil.rmtree(output)
    for name, data in package.payloads.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")


def compare(expected_dir: Path, actual_dir: Path) -> list[str]:
    problems = []
    names = lambda d: sorted(str(p.relative_to(d)) for p in d.rglob("*") if p.is_file())
    left, right = names(expected_dir), names(actual_dir)
    if left != right:
        problems.append(f"file set differs: only committed={sorted(set(left)-set(right))} only rebuilt={sorted(set(right)-set(left))}")
    for name in sorted(set(left) & set(right)):
        if sha256_file(expected_dir / name) != sha256_file(actual_dir / name):
            problems.append(f"{name}: SHA-256 differs")
    return problems


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--upstream", type=Path, help="existing airport-history checkout at the pinned commit")
    parser.add_argument("--commit", default=UPSTREAM_COMMIT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="rebuild into a temp dir and require byte-identical files")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix="keepraw-airport-history-") as temp:
        workdir = Path(temp)
        upstream = args.upstream.resolve() if args.upstream else fetch_upstream(args.commit, workdir)
        verify_upstream(upstream, args.commit)
        package, manifest = build_package(upstream, args.commit, workdir)
        if args.check:
            rebuilt = workdir / "rebuilt"
            write_package(package, manifest, rebuilt)
            problems = compare(args.output, rebuilt)
            if problems:
                print("\n".join(problems), file=sys.stderr)
                raise SystemExit("Committed airport-history package does not match a rebuild from the pinned commit")
            print(f"airport-history package matches {args.commit} ({len(manifest['files'])} files)")
        else:
            write_package(package, manifest, args.output)
            total = sum(f["bytes"] for f in manifest["files"].values())
            print(canonical({"commit": args.commit, "files": len(manifest["files"]), "bytes": total, "counts": manifest["counts"]}))


if __name__ == "__main__":
    main()
