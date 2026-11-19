#!/usr/bin/env python3
"""Audit the committed Fly crosswalk against dated codes and the pinned snapshot."""

import argparse
import csv
import hashlib
import json
from bisect import bisect_left, bisect_right
from collections import Counter, defaultdict
from datetime import date, timedelta
from itertools import combinations
from pathlib import Path

from airport_history_directory import (
    ICAO, IATA, OURAIRPORTS, claim_can_resolve, distance_km, folded_name,
    legacy_sources, read_ourairports, same_site_candidates,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "packages/core/data"
COORDINATE_THRESHOLD_KM = 0.4


def formal_codes(dataset, horizon):
    all_codes = defaultdict(lambda: {"IATA": set(), "ICAO": set()})
    by_code = defaultdict(list)
    for row in dataset["assignments"]:
        all_codes[row["airportId"]][row["scheme"]].add(row["code"])
        by_code[row["scheme"], row["code"]].append(row)
    sources = legacy_sources(dataset)
    last_day = (date.fromisoformat(horizon["toExclusive"]) - timedelta(days=1)).isoformat()
    current = defaultdict(lambda: {"IATA": set(), "ICAO": set()})
    for (scheme, code), rows in by_code.items():
        possible = [
            row for row in rows
            if (not row["validFrom"]["earliest"] or row["validFrom"]["earliest"] <= last_day)
            and (not row["validTo"]["latest"] or last_day < row["validTo"]["latest"])
        ]
        if len({row["airportId"] for row in possible}) != 1:
            continue
        if not all(claim_can_resolve(row, sources) for row in possible):
            continue
        if any(
            row["validFrom"]["latest"] and row["validTo"]["earliest"]
            and row["validFrom"]["latest"] <= last_day < row["validTo"]["earliest"]
            for row in possible
        ):
            current[possible[0]["airportId"]][scheme].add(code)
    return all_codes, current


def audit_rows(dataset, directory, fly_rows, ourairports, horizon):
    airports = {airport["airportId"]: airport for airport in dataset["airports"]}
    fly = {row[7]: row for row in fly_rows}
    aliases = defaultdict(set)
    for airport_id, entry in directory.items():
        for legacy in entry.get("legacyIds", []):
            if legacy not in fly:
                raise ValueError(f"Missing Fly source record for committed link {legacy} → {airport_id}")
            aliases[legacy].add(airport_id)

    by_code = defaultdict(set)
    by_name = defaultdict(set)
    for id_, row in fly.items():
        if IATA.fullmatch(row[0]):
            by_code["IATA", row[0]].add(id_)
        if ICAO.fullmatch(row[8]):
            by_code["ICAO", row[8]].add(id_)
        name = folded_name(row[1])
        if name:
            by_name[name].add(id_)
    by_latitude = sorted(fly, key=lambda id_: fly[id_][4])
    latitudes = [fly[id_][4] for id_ in by_latitude]
    references = sorted(
        (float(row["latitude_deg"]), id_, row)
        for id_, row in ourairports.items()
        if row.get("latitude_deg") and row.get("longitude_deg")
    )
    reference_latitudes = [lat for lat, _, _ in references]

    all_codes, current = formal_codes(dataset, horizon)
    candidates = defaultdict(dict)
    qualified_by_formal = defaultdict(set)
    group_agrees = {}
    for id_, airport in airports.items():
        entry = directory[id_]
        reference = ourairports.get(airport.get("externalIds", {}).get("ourAirports"), {})
        point = airport["coordinates"]["value"]
        lat, lon = point["latitude"], point["longitude"]
        name = folded_name(airport["name"]["value"] or "")
        codes = all_codes[id_]
        group = [fly[legacy] for legacy in entry.get("legacyIds", []) if legacy in fly]
        if len(group) > 1:
            group_agrees[id_] = all(
                bool(folded_name(a[1])) and folded_name(a[1]) == folded_name(b[1])
                and a[3] == b[3] and distance_km(*a[4:6], *b[4:6]) <= COORDINATE_THRESHOLD_KM
                for a, b in combinations(group, 2)
            )
        selected = {row[7] for row in group}
        if id_ in fly:
            selected.add(id_)
        code_or_name = set(by_name[name]) if name else set()
        for scheme, values in codes.items():
            for code in values:
                code_or_name.update(by_code[scheme, code])
        span = COORDINATE_THRESHOLD_KM / 110
        nearby = {
            legacy for legacy in by_latitude[
                bisect_left(latitudes, lat - span):bisect_right(latitudes, lat + span)
            ]
            if distance_km(lat, lon, *fly[legacy][4:6]) <= COORDINATE_THRESHOLD_KM
        }
        qualified = same_site_candidates(
            airport, (fly[legacy] for legacy in code_or_name), codes, reference
        )
        qualified_ids = {row[7] for row in qualified}
        qualified_by_formal[id_] = qualified_ids
        for legacy in selected | code_or_name | nearby:
            row = fly[legacy]
            iata_matches = bool(IATA.fullmatch(row[0]) and row[0] in codes["IATA"])
            icao_matches = bool(ICAO.fullmatch(row[8]) and row[8] in codes["ICAO"])
            name_matches = bool(name and name == folded_name(row[1]))
            country = reference.get("iso_country") or entry["country"]
            country_matches = country == row[3] if country != "ZZ" and row[3] != "ZZ" else None
            distance = distance_km(lat, lon, *row[4:6])
            nearby_reference = []
            if legacy in selected and distance > 3:
                old_lat, old_lon = row[4:6]
                for other_lat, other_id, other in references[
                    bisect_left(reference_latitudes, old_lat - span):
                    bisect_right(reference_latitudes, old_lat + span)
                ]:
                    if other_id == reference.get("id") or other.get("type") in {"heliport", "balloonport"}:
                        continue
                    separation = distance_km(old_lat, old_lon, other_lat, float(other["longitude_deg"]))
                    if separation <= COORDINATE_THRESHOLD_KM:
                        nearby_reference.append(
                            f"{other_id} {other['ident']} {other['name']} ({other['type']}, {separation:.3f} km)"
                        )
            evidence = []
            if legacy == id_:
                evidence.append("same permanent ID")
            if iata_matches:
                evidence.append("formal IATA assignment")
            if icao_matches:
                evidence.append("formal ICAO assignment")
            if name_matches:
                evidence.append("normalized name")
            if legacy in nearby:
                evidence.append("within 0.4 km")
            elif distance <= 3:
                evidence.append("within 3 km")
            candidates[legacy][id_] = {
                "formal_airport_id": id_,
                "formal_name": airport["name"]["value"],
                "formal_country": country,
                "formal_country_source": "OurAirports" if reference.get("iso_country") else "formal directory",
                "formal_latitude": lat,
                "formal_longitude": lon,
                "formal_status": entry["status"],
                "formal_ourairports_id": reference.get("id", ""),
                "formal_current_iata": " ".join(sorted(current[id_]["IATA"])),
                "formal_current_icao": " ".join(sorted(current[id_]["ICAO"])),
                "formal_all_iata": " ".join(sorted(codes["IATA"])),
                "formal_all_icao": " ".join(sorted(codes["ICAO"])),
                "iata_agrees": iata_matches,
                "icao_agrees": icao_matches,
                "name_agrees": name_matches,
                "country_agrees": country_matches,
                "distance_km": distance,
                "other_ourairports_sites_at_old_point": "; ".join(nearby_reference),
                "matching_evidence": "; ".join(evidence),
                "qualified_candidate": legacy in qualified_ids,
                "nearby_without_identifier_agreement": legacy in nearby and not (
                    iata_matches or icao_matches or name_matches or legacy == id_
                ),
            }

    results = []
    for legacy, fly_row in sorted(fly.items()):
        committed = aliases[legacy] | ({legacy} if legacy in airports else set())
        evidence = candidates[legacy]
        qualified = sorted(
            id_ for id_, candidate in evidence.items() if candidate["qualified_candidate"]
        )
        base = {
            "legacy_id": legacy,
            "old_iata": fly_row[0],
            "old_icao": fly_row[8],
            "old_name": fly_row[1],
            "old_country": fly_row[3],
            "old_latitude": fly_row[4],
            "old_longitude": fly_row[5],
            "old_status": fly_row[9] if len(fly_row) > 9 else "operating",
            "candidate_count": len(evidence),
            "multiple_candidates": len(evidence) > 1,
            "qualified_formal_candidate_count": len(qualified),
            "qualified_formal_candidate_ids": " ".join(qualified),
            "committed_formal_ids": " ".join(sorted(committed)),
            "committed_formal_count": len(committed),
        }
        if not committed:
            risks = ["competing qualified formal identities"] if len(qualified) > 1 else []
            results.append({
                **base,
                "record_type": "unmatched",
                "mapped": False,
                "potential_cross_site_merge": bool(risks),
                "manual_review": "; ".join(risks),
            })

        for id_, candidate in sorted(evidence.items(), key=lambda item: (item[0] not in committed, item[0])):
            chosen = id_ in committed
            group = directory[id_].get("legacyIds", [])
            risks = []
            if chosen:
                if len(committed) > 1:
                    risks.append("duplicate committed ownership")
                if len(qualified) > 1:
                    risks.append("competing qualified formal identities")
                if candidate["country_agrees"] is False:
                    risks.append("country discrepancy")
                if candidate["distance_km"] > 3:
                    risks.append("reference points over 3 km apart")
                if candidate["other_ourairports_sites_at_old_point"]:
                    risks.append("different snapshot airport near the Fly point")
                if id_ != legacy and not candidate["qualified_candidate"]:
                    risks.append("original evidence thresholds not met")
                if id_ != legacy and not (candidate["icao_agrees"] or candidate["name_agrees"]):
                    risks.append(
                        "IATA and proximity only" if candidate["iata_agrees"]
                        else "no corroborating code or name"
                    )
                if group_agrees.get(id_) is False:
                    risks.append("inconsistent linked Fly records")
            elif candidate["nearby_without_identifier_agreement"]:
                risks.append("proximity without agreeing IATA, ICAO or name")
            elif candidate["qualified_candidate"] and len(qualified) > 1:
                risks.append("competing qualified formal identity")
            results.append({
                **base, **candidate,
                "record_type": ("same_id" if id_ == legacy else "mapped") if chosen else "candidate",
                "mapped": chosen,
                "qualified_fly_candidate_count": len(qualified_by_formal[id_]),
                "linked_fly_ids": " ".join(group),
                "linked_fly_records_agree": group_agrees.get(id_),
                "potential_cross_site_merge": bool(risks),
                "manual_review": "; ".join(risks),
            })
    return results


def markdown(rows, manifest, data_hash, directory_hash, fly_hash):
    chosen = [row for row in rows if row["record_type"] in {"mapped", "same_id"}]
    mapped = [row for row in chosen if row["record_type"] == "mapped"]
    unmatched = [row for row in rows if row["record_type"] == "unmatched"]
    suspects = [row for row in mapped if row["potential_cross_site_merge"]]
    competing = {
        row["legacy_id"] for row in rows if row["qualified_formal_candidate_count"] > 1
    }
    duplicates = {
        row["legacy_id"] for row in chosen if row["committed_formal_count"] > 1
    }
    nearby = [
        row for row in rows if row.get("nearby_without_identifier_agreement")
    ]
    groups = {
        row["formal_airport_id"]: row for row in mapped
        if row.get("linked_fly_records_agree") is not None
    }
    risks = Counter(reason for row in suspects for reason in row["manual_review"].split("; "))
    labels = [
        ("Committed crosswalk links", len(mapped)),
        ("Fly IDs already equal to a formal ID", sum(row["record_type"] == "same_id" for row in chosen)),
        ("Unmatched Fly IDs", len(unmatched)),
        ("Unmatched Fly IDs with one or more qualified candidates", sum(row["qualified_formal_candidate_count"] > 0 for row in unmatched)),
        ("Fly IDs with multiple evidence candidates", len({row["legacy_id"] for row in rows if row["multiple_candidates"]})),
        ("Fly IDs with competing qualified formal candidates", len(competing)),
        ("Fly IDs with multiple committed owners", len(duplicates)),
        ("Formal sites linked to multiple Fly IDs", len(groups)),
        ("Multi-link sites with conflicting Fly names, countries or reference points", sum(not row["linked_fly_records_agree"] for row in groups.values())),
        ("Proximity-only candidate pairs", len(nearby)),
        ("Committed links without matching code or name", sum(
            not (row["iata_agrees"] or row["icao_agrees"] or row["name_agrees"])
            for row in mapped
        )),
        ("Committed links with differing normalized names", sum(not row["name_agrees"] for row in mapped)),
        ("Committed links needing manual review", len(suspects)),
    ]
    version = manifest["dataVersion"]
    lines = [
        f"# Airport crosswalk audit for {version}",
        "",
        "Review of the existing Fly-to-Airport History physical identities. The companion CSV records",
        "the selected mappings, direct ID matches, unmatched Fly IDs and alternative candidates.",
        f"[Complete CSV](airport-crosswalk-{version}.csv)",
        "",
        "| Audit result | Count |",
        "| --- | ---: |",
        *[f"| {label} | {count:,} |" for label, count in labels],
        "",
        "## Method",
        "",
        "Each Fly record is compared against the formal IATA and ICAO assignments, normalized",
        "airport names and physical coordinates. Current formal codes use verified coverage",
        "on the last civil day of the manifest horizon. Airport History supplies assignment dates.",
        "The OurAirports snapshot supplies the comparison country through the formal external ID.",
        "",
        "The CSV includes pairs sharing an assignment, a normalized name, a committed link or a",
        "reference point within 0.4 km. A qualified candidate meets the original crosswalk's",
        "evidence rules. These require a matching ICAO or normalized name within 3 km and the",
        "same country, both IATA and ICAO within 5 km, or IATA within 0.4 km and the same country.",
        "The audit exposes candidates in both directions before applying the committed links.",
        "Proximity without supporting codes or names warrants manual review. Country differences",
        "and reference points over 3 km apart also warrant review, even with agreeing codes.",
        "Name differences are recorded on every examined pair. An agreeing normalized name is",
        "one signal alongside the codes and location.",
        "",
        "## Manual review",
        "",
        "Treat the flags as leads for independent verification of the physical identity at",
        "both ends of each link. Prioritize old Fly reference points near a different airport",
        "in the pinned snapshot.",
        "",
        "| Fly IATA | Formal site | Formal OurAirports ID | Other snapshot sites near the Fly reference point |",
        "| --- | --- | --- | --- |",
        *[
            f"| {row['old_iata']} | {row['formal_name']} | {row['formal_ourairports_id']} | "
            f"{row['other_ourairports_sites_at_old_point']} |"
            for row in suspects if row["other_ourairports_sites_at_old_point"]
        ],
        "",
        "| Flag on a committed link | Count |",
        "| --- | ---: |",
        *[f"| {risk} | {count:,} |" for risk, count in sorted(risks.items())],
        "",
        "| Fly ID | Formal airport ID | Old IATA / ICAO | Formal name | km | Review reason |",
        "| --- | --- | --- | --- | ---: | --- |",
    ]
    for row in suspects:
        name = str(row["formal_name"]).replace("|", "\\|").replace("\n", " ")
        lines.append(
            f"| `{row['legacy_id']}` | `{row['formal_airport_id']}` | "
            f"{row['old_iata']} / {row['old_icao']} | {name} | "
            f"{row['distance_km']:.3f} | {row['manual_review']} |"
        )
    lines.extend([
        "",
        "### Multiple Fly IDs linked to one formal site",
        "",
        "| Formal airport ID | Fly IDs | Fly name, country and location evidence |",
        "| --- | --- | --- |",
        *[
            f"| `{id_}` | {', '.join(f'`{legacy}`' for legacy in row['linked_fly_ids'].split())} | "
            f"{'Consistent' if row['linked_fly_records_agree'] else 'Review differences'} |"
            for id_, row in sorted(groups.items())
        ],
        "",
        "Filter the CSV by `record_type`, `qualified_formal_candidate_count` or",
        "`potential_cross_site_merge` to inspect every unmatched and competing pair.",
        "",
        "## Inputs",
        "",
        f"- Formal dataset commit `{manifest['commit']}` and SHA-256 `{data_hash}`.",
        f"- Formal directory SHA-256 `{directory_hash}`.",
        f"- Fly directory SHA-256 `{fly_hash}`.",
        f"- OurAirports snapshot `{OURAIRPORTS['revision']}` and SHA-256 `{OURAIRPORTS['sha256']}`. [Snapshot]({OURAIRPORTS['csv']})",
        "",
        "Run the audit with the verified snapshot to regenerate both files.",
        "",
        "```sh",
        "python3 scripts/update-airport-history.py --fetch-ourairports /tmp/ourairports.csv",
        "python3 scripts/audit-airport-crosswalk.py --ourairports /tmp/ourairports.csv",
        "pnpm exec prettier --write docs/audits/airport-crosswalk-*.md",
        "```",
        "",
    ])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ourairports", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "docs/audits")
    args = parser.parse_args()
    formal = DATA / "airport-history/formal"
    manifest = json.loads((formal / "manifest.json").read_bytes())
    data = (formal / "airports.json").read_bytes()
    directory = (formal / "directory.json").read_bytes()
    fly = (DATA / "airports.iata.json").read_bytes()
    data_hash, directory_hash, fly_hash = (
        hashlib.sha256(blob).hexdigest() for blob in (data, directory, fly)
    )
    if data_hash != manifest["files"]["data/airports.json"]["sha256"]:
        parser.error("Formal data failed SHA-256 verification")
    rows = audit_rows(
        json.loads(data), json.loads(directory), json.loads(fly),
        read_ourairports(args.ourairports), manifest["queryHorizon"],
    )
    args.output_dir.mkdir(parents=True, exist_ok=True)
    basename = f"airport-crosswalk-{manifest['dataVersion']}"
    fields = list(dict.fromkeys(key for row in rows for key in row))
    with (args.output_dir / f"{basename}.csv").open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            if "distance_km" in row:
                writer.writerow({**row, "distance_km": f"{row['distance_km']:.3f}"})
            else:
                writer.writerow(row)
    report = markdown(rows, manifest, data_hash, directory_hash, fly_hash)
    (args.output_dir / f"{basename}.md").write_text(report, encoding="utf-8")
    print(f"Wrote {len(rows):,} audit rows for {manifest['dataVersion']}")


if __name__ == "__main__":
    main()
