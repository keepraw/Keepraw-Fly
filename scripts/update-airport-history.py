#!/usr/bin/env python3
"""Verify and import formal versions published by Keepraw Airport History."""

import argparse
import hashlib
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen

from airport_history_directory import (
    ICAO, IATA, OURAIRPORTS, compact_object, directory_rows, distance_km,
    parse_ourairports, read_ourairports, validate_directory, verify_ourairports,
)

DATA = Path(__file__).resolve().parents[1] / "packages/core/data"
FORMAL = DATA / "airport-history/formal"
TARGET = FORMAL / "airports.json"
PIN = FORMAL / "manifest.json"
DIRECTORY = FORMAL / "directory.json"
NAMES = DATA / "airport-names.json"
UPSTREAM = "https://raw.githubusercontent.com/keepraw/airport-history"
DATASET = "data/airports.json"
SUPPORTED_SCHEMAS = {"3.0.0", "4.0.0"}
PUBLICATION = f"{UPSTREAM}/main/data/production-manifest.json"
LOCALES = {"en-US": "en", "en-GB": "en", "zh-CN": "zh-CN", "zh-TW": "zh-TW",
           "ja-JP": "ja", "ko-KR": "ko", "fr-FR": "fr", "de-DE": "de",
           "es": "es", "pt-BR": "pt"}
AIRPORT_ID = re.compile(r"apt_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}")
LIMIT = 32 * 1024 * 1024


def fetch(url, limit=LIMIT):
    request = Request(url, headers={"User-Agent": "Keepraw-Fly-airport-history-updater"})
    with urlopen(request, timeout=60) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError(f"Response exceeds the size limit: {url}")
    return data


def sha(data):
    return hashlib.sha256(data).hexdigest()


def version(text):
    if not isinstance(text, str) or not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", text):
        raise ValueError("Formal data versions must be stable numeric versions")
    return tuple(map(int, text.split(".")))


def day(text):
    if not isinstance(text, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        raise ValueError(f"Invalid civil date: {text!r}")
    return date.fromisoformat(text)


def validate_manifest(manifest):
    version(manifest["dataVersion"])
    if manifest["schemaVersion"] not in SUPPORTED_SCHEMAS:
        raise ValueError(f"Unsupported schema {manifest['schemaVersion']}; implement and test compatibility before importing")
    if not re.fullmatch(r"[0-9a-f]{40}", manifest["commit"]):
        raise ValueError("The upstream manifest must name an immutable commit")
    if set(manifest["files"]) != {DATASET} or not re.fullmatch(r"[0-9a-f]{64}", digest(manifest)):
        raise ValueError("The manifest must pin the SHA-256 of the formal dataset")
    horizon = manifest["queryHorizon"]
    if day(horizon["fromInclusive"]) >= day(horizon["toExclusive"]):
        raise ValueError("Invalid formal query horizon")
    return manifest


def digest(manifest):
    return manifest["files"][DATASET]["sha256"]


def indexed(rows, key):
    result = {row[key]: row for row in rows}
    if len(result) != len(rows):
        raise ValueError(f"Duplicate {key} in formal data")
    return result


def code_groups(dataset):
    groups = defaultdict(list)
    for row in dataset["assignments"]:
        groups[(row["scheme"], row["code"])].append(row)
    return groups


def validate_bounds(row):
    for key in ("validFrom", "validTo"):
        bound = row[key]
        earliest = day(bound["earliest"]) if bound["earliest"] else None
        latest = day(bound["latest"]) if bound["latest"] else None
        if earliest and latest and earliest > latest:
            raise ValueError(f"Inverted date bounds in {row}")
    start, end = row["validFrom"]["earliest"], row["validTo"]["latest"]
    if start and end and start >= end:
        raise ValueError(f"Empty possible interval in {row}")


def legacy_sources(dataset):
    if dataset["schemaVersion"] == "3.0.0":
        return indexed(dataset["sources"], "sourceId")
    return None


def claim_can_resolve(row, sources):
    if sources is None:
        return True
    return (
        row["verificationStatus"] == "verified"
        and bool(row.get("verifiedOn"))
        and bool(row["sourceIds"])
        and all(sources[source]["verificationStatus"] == "verified" for source in row["sourceIds"])
    )


def validate_dataset(data, manifest):
    if sha(data) != digest(manifest):
        raise ValueError("Formal dataset failed SHA-256 verification")
    dataset = json.loads(data)
    for field in ("schemaVersion", "dataVersion"):
        if dataset[field] != manifest[field]:
            raise ValueError(f"Manifest and dataset disagree on {field}")
    airports = indexed(dataset["airports"], "airportId")
    sources = legacy_sources(dataset)
    assignments = indexed(dataset["assignments"], "assignmentId")
    names = indexed(dataset["names"], "nameId")
    if not airports or not assignments:
        raise ValueError("Formal airport and assignment tables are required")
    if sources is not None and not sources:
        raise ValueError("Schema 3.0.0 requires a source table")
    if any(not AIRPORT_ID.fullmatch(airport_id) for airport_id in airports):
        raise ValueError("Invalid permanent airportId")
    claims = [*assignments.values(), *names.values()]
    for row in claims:
        if row["airportId"] not in airports:
            raise ValueError("Formal claim references a missing airport")
        if sources is not None and any(key not in sources for key in row["sourceIds"]):
            raise ValueError("Schema 3.0.0 claim references a missing source")
        validate_bounds(row)
    for row in airports.values():
        if sources is not None:
            for field in ("name", "coordinates", "timezone"):
                if any(key not in sources for key in row[field]["sourceIds"]):
                    raise ValueError(f"Schema 3.0.0 airport {field} references a missing source")
        point = row["coordinates"]["value"]
        if not point or not (-90 <= point["latitude"] <= 90 and -180 <= point["longitude"] <= 180):
            raise ValueError(f"Fly needs a valid reference point for {row['airportId']}")
        if not isinstance(row["name"]["value"], str) or not row["name"]["value"].strip():
            raise ValueError(f"Fly needs a canonical reference name for {row['airportId']}")
    for (scheme, code), rows in code_groups(dataset).items():
        if scheme not in {"IATA", "ICAO"} or not (IATA if scheme == "IATA" else ICAO).fullmatch(code):
            raise ValueError(f"Invalid formal code: {scheme} {code}")
        ranges = sorted(
            (row["validFrom"]["latest"], row["validTo"]["earliest"], row["airportId"])
            for row in rows
            if claim_can_resolve(row, sources) and row["validFrom"]["latest"] and row["validTo"]["earliest"]
        )
        for index, (start, end, airport_id) in enumerate(ranges):
            for next_start, next_end, next_id in ranges[index + 1:]:
                if next_start >= end:
                    break
                if start < min(end, next_end) and airport_id != next_id:
                    raise ValueError(f"Conflicting certain assignments for {scheme} {code}; review the physical sites")
    return dataset


def detect_breaking_changes(before, after):
    changes = []
    for table, key in (("airports", "airportId"), ("assignments", "assignmentId")):
        old, new = indexed(before[table], key), indexed(after[table], key)
        for row_id in sorted(old.keys() - new.keys()):
            changes.append(f"Removed {key} {row_id}")
        for row_id in sorted(old.keys() & new.keys()):
            original, current = old[row_id], new[row_id]
            if table == "assignments":
                for field in ("airportId", "scheme", "code"):
                    if original[field] != current[field]:
                        changes.append(f"Changed {field} of assignment {row_id}")
            else:
                a, b = original["coordinates"]["value"], current["coordinates"]["value"]
                old_external = original.get("externalIds", {})
                external = current.get("externalIds", {})
                if any(external.get(key) != value for key, value in old_external.items()):
                    changes.append(f"Changed external identity for {row_id}")
                if a and (not b or distance_km(a["latitude"], a["longitude"], b["latitude"], b["longitude"]) > 3):
                    changes.append(f"Changed reference position for {row_id}")
    return changes


def directory_inputs(dataset):
    return {
        row["airportId"]: (
            row.get("externalIds", {}),
            *(row[field]["value"] for field in ("name", "coordinates", "timezone")),
        )
        for row in dataset["airports"]
    }


def coverage(dataset, horizon):
    """Count resolved code/date pairs by interval boundaries, without daily snapshots."""
    start, end = horizon["fromInclusive"], horizon["toExclusive"]
    sources = legacy_sources(dataset)
    counts = {"IATA": 0, "ICAO": 0}
    for (scheme, _), rows in code_groups(dataset).items():
        bounds = sorted({start, end} | {
            bound for row in rows for field in ("validFrom", "validTo")
            for bound in (row[field]["earliest"], row[field]["latest"])
            if bound and start < bound < end
        })
        for left, right in zip(bounds, bounds[1:]):
            possible = [
                row for row in rows
                if left >= (row["validFrom"]["earliest"] or start)
                and left < (row["validTo"]["latest"] or end)
            ]
            if (
                len({row["airportId"] for row in possible}) == 1
                and all(claim_can_resolve(row, sources) for row in possible)
                and any(
                    row["validFrom"]["latest"] and row["validTo"]["earliest"]
                    and row["validFrom"]["latest"] <= left < row["validTo"]["earliest"]
                    for row in possible
                )
            ):
                counts[scheme] += (day(right) - day(left)).days
    return counts


def version_change(pinned, publication):
    if version(publication["dataVersion"]) < version(pinned["dataVersion"]):
        return False
    if publication["dataVersion"] == pinned["dataVersion"]:
        if digest(publication) != digest(pinned):
            raise ValueError("Upstream changed the SHA-256 without advancing dataVersion")
        if publication["queryHorizon"] != pinned["queryHorizon"]:
            raise ValueError("Upstream changed the query horizon without advancing dataVersion")
        return False
    return True


def labels_for_update(labels, directory, dataset):
    """Keep records keyed by physical ID and register new IDs for canonical fallback."""
    for airport in dataset["airports"]:
        airport_id = airport["airportId"]
        if airport_id in labels:
            continue
        aliases = directory[airport_id].get("legacyIds", [])
        # An approved physical crosswalk can reuse already-attributed labels.
        labels[airport_id] = next((labels[key] for key in aliases if key in labels), {})
    return labels


def coverage_by_locale(ids, labels):
    return {
        locale: sum(
            locale in labels.get(key, {}).get("names", {}) or
            base in labels.get(key, {}).get("names", {}) or base == "en"
            for key in ids
        )
        for locale, base in LOCALES.items()
    }


def report(before, after, old, new, directory, labels, breaking):
    old_airports = indexed(before["airports"], "airportId")
    airports = indexed(after["airports"], "airportId")
    old_assignments = indexed(before["assignments"], "assignmentId")
    assignments = indexed(after["assignments"], "assignmentId")
    added_ids = sorted(airports.keys() - old_airports.keys())
    removed_ids = sorted(old_airports.keys() - airports.keys())
    added_codes = assignments.keys() - old_assignments.keys()
    removed_codes = old_assignments.keys() - assignments.keys()
    changed_intervals = sorted(
        key for key in old_assignments.keys() & assignments.keys()
        if any(old_assignments[key][field] != assignments[key][field] for field in ("validFrom", "validTo"))
    )
    old_coverage = coverage(before, old["queryHorizon"])
    new_coverage = coverage(after, new["queryHorizon"])
    locale_coverage = coverage_by_locale(airports, labels)
    added_coverage = coverage_by_locale(added_ids, labels)
    missing_city = {id_ for id_, row in directory.items() if not row["city"].strip()}
    missing_country = {id_ for id_, row in directory.items() if row["country"] == "ZZ"}
    unknown_status = {id_ for id_, row in directory.items() if row["status"] == "unknown"}
    missing_timezone = {
        id_ for id_, airport in airports.items()
        if not (airport["timezone"]["value"] or directory[id_].get("timezone"))
    }
    incomplete = missing_city | missing_country | unknown_status | missing_timezone
    sections = [
        "## Publication",
        "",
        "| | Current | Incoming |",
        "| --- | --- | --- |",
        f"| Version | {old['dataVersion']} | {new['dataVersion']} |",
        f"| Schema | {old['schemaVersion']} | {new['schemaVersion']} |",
        f"| Commit | `{old['commit']}` | `{new['commit']}` |",
        f"| SHA-256 | `{digest(old)}` | `{digest(new)}` |",
        "",
        f"Schema {new['schemaVersion']} and SHA-256 verified.",
        "",
        "## Data changes",
        "",
        f"- Physical airports: {len(airports):,} (+{len(added_ids):,}, −{len(removed_ids):,})",
        f"- IATA assignments added: {sum(assignments[key]['scheme'] == 'IATA' for key in added_codes):,}",
        f"- ICAO assignments added: {sum(assignments[key]['scheme'] == 'ICAO' for key in added_codes):,}",
        f"- Assignments removed: {len(removed_codes):,}",
        f"- Historical intervals changed: {len(changed_intervals):,}",
        f"- Fly IDs linked to verified sites: {sum(len(row.get('legacyIds', [])) for row in directory.values()):,}",
        "",
        "## Directory metadata",
        "",
        f"- OurAirports snapshot: `{OURAIRPORTS['revision']}`",
        f"- Missing city: {len(missing_city):,}",
        f"- Country ZZ: {len(missing_country):,}",
        f"- Unknown status: {len(unknown_status):,}",
        f"- New airports missing city, country, status or timezone: {len(incomplete.intersection(added_ids)):,}",
        f"- Existing airports with unverified current status: {len(unknown_status.intersection(old_airports)):,}",
        "",
        "## Resolved code/date coverage",
        "",
        "| Scheme | Current | Incoming | Difference |",
        "| --- | ---: | ---: | ---: |",
        *[f"| {scheme} | {old_coverage[scheme]:,} | {new_coverage[scheme]:,} | {new_coverage[scheme] - old_coverage[scheme]:+,} |"
          for scheme in ("IATA", "ICAO")],
        "",
        "## Airport names",
        "",
        "| Locale | Formal airports with a label | New airports needing a label |",
        "| --- | ---: | ---: |",
        *[f"| {locale} | {locale_coverage[locale]:,} / {len(airports):,} | {len(added_ids) - added_coverage[locale]:,} |"
          for locale in LOCALES],
        "",
        "Missing localized names use the canonical English label.",
    ]
    if breaking:
        sections.extend(["", "## Manual review required", "", *[f"- {item}" for item in breaking]])
    for title, items in (
        ("Added airport IDs", added_ids), ("Removed airport IDs", removed_ids),
        ("Added assignment IDs", sorted(added_codes)), ("Removed assignment IDs", sorted(removed_codes)),
        ("Changed assignment intervals", changed_intervals),
    ):
        if items:
            preview = ", ".join(f"`{item}`" for item in items[:30])
            sections.extend(["", f"**{title}** ({len(items):,})", "", preview])
    return "\n".join(sections) + "\n"


def write_files(files):
    # Prepare all bytes before replacing tracked files. A failed run never stages
    # an update, and a retry validates the new pin against the dataset again.
    with TemporaryDirectory(dir=FORMAL) as temporary:
        prepared = []
        for index, (target, data) in enumerate(files):
            path = Path(temporary) / str(index)
            path.write_bytes(data)
            backup = path.with_suffix(".previous")
            if target.exists():
                backup.write_bytes(target.read_bytes())
            prepared.append((path, target, backup))
        replaced = []
        try:
            for path, target, backup in prepared:
                path.replace(target)
                replaced.append((target, backup))
        except OSError:
            for target, backup in reversed(replaced):
                if backup.exists():
                    backup.replace(target)
                else:
                    target.unlink(missing_ok=True)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate the vendored commit and directory")
    parser.add_argument("--verify-upstream", action="store_true", help="Compare pinned bytes to the immutable upstream commit")
    parser.add_argument("--same-schema", action="store_true", help="Leave schema transitions to a manual update PR")
    parser.add_argument("--manifest", type=Path, help="Use an explicitly supplied publication manifest")
    parser.add_argument("--ourairports", type=Path, help="Use the pinned OurAirports CSV for directory metadata")
    parser.add_argument("--fetch-ourairports", type=Path, help="Download and verify the pinned OurAirports CSV")
    parser.add_argument("--report", type=Path, help="Write the update report as Markdown")
    args = parser.parse_args()
    try:
        if args.fetch_ourairports:
            data = verify_ourairports(fetch(OURAIRPORTS["csv"]))
            args.fetch_ourairports.write_bytes(data)
            print(f"Verified OurAirports CSV at {OURAIRPORTS['revision']}")
            return
        old = validate_manifest(json.loads(PIN.read_bytes()))
        old_data = TARGET.read_bytes()
        before = validate_dataset(old_data, old)
        directory_bytes = DIRECTORY.read_bytes()
        previous = json.loads(directory_bytes)
        fly = json.loads((DATA / "airports.iata.json").read_bytes())
        if args.check:
            validate_directory(before, previous, fly)
            if args.verify_upstream and fetch(f"{UPSTREAM}/{old['commit']}/{DATASET}") != old_data:
                raise ValueError("Vendored data differs from the immutable upstream commit")
            print(f"Verified Airport History v{old['dataVersion']} ({old['commit']})")
            return
        new = validate_manifest(json.loads(args.manifest.read_bytes() if args.manifest else fetch(PUBLICATION, 16_384)))
        if not version_change(old, new):
            print(f"No new formal Airport History version (pinned v{old['dataVersion']}).")
            return
        if args.same_schema and new["schemaVersion"] != old["schemaVersion"]:
            print(f"Schema {new['schemaVersion']} is available for a manual update PR.")
            return
        raw = fetch(f"{UPSTREAM}/{new['commit']}/{DATASET}")
        after = validate_dataset(raw, new)
        breaking = detect_breaking_changes(before, after)
        directory = previous
        if old["schemaVersion"] == new["schemaVersion"] or directory_inputs(before) != directory_inputs(after):
            reference = (
                read_ourairports(args.ourairports)
                if args.ourairports
                else parse_ourairports(fetch(OURAIRPORTS["csv"]))
            )
            directory = directory_rows(after, previous, fly, reference, before["airports"])
            directory_bytes = compact_object(directory)
        validate_directory(after, directory, fly)
        labels = labels_for_update(json.loads(NAMES.read_bytes()) if NAMES.exists() else {}, directory, after)
        summary = report(before, after, old, new, directory, labels, breaking)
        if args.report:
            args.report.write_text(summary, encoding="utf-8")
        if breaking:
            raise ValueError("Manual review required:\n" + "\n".join(breaking))
        write_files([
            (TARGET, raw),
            (DIRECTORY, directory_bytes),
            (NAMES, compact_object(labels)),
            (PIN, (json.dumps(new, indent=2) + "\n").encode()),
        ])
        print(f"Prepared Airport History v{new['dataVersion']}.")
    except (OSError, ValueError, KeyError, TypeError) as error:
        parser.exit(1, f"Airport History update stopped: {error}\n")


if __name__ == "__main__":
    main()
