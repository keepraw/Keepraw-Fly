"""Maintain Fly's physical-site crosswalk and reference metadata."""

import csv
import hashlib
import io
import json
import math
import re
import unicodedata
from collections import defaultdict

OURAIRPORTS_SHA256 = "27c6500d0a742edece15c5aaf960e08c01df0d4356c5c86255897b5d3749ad3b"
IATA = re.compile(r"[A-Z]{3}")
ICAO = re.compile(r"[A-Z]{4}")


def read_ourairports(path):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != OURAIRPORTS_SHA256:
        raise ValueError("OurAirports reference metadata failed SHA-256 verification")
    return {row["id"]: row for row in csv.DictReader(io.StringIO(data.decode("utf-8-sig")))}


def folded_name(value):
    text = unicodedata.normalize("NFKD", value.casefold())
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = re.sub(r"\b(international|airport|airfield|aerodrome|regional|intl)\b", "", text)
    return "".join(char for char in text if char.isalnum())


def distance_km(lat, lon, other_lat, other_lon):
    lat, lon, other_lat, other_lon = map(math.radians, (lat, lon, other_lat, other_lon))
    delta = (
        math.sin((lat - other_lat) / 2) ** 2
        + math.cos(lat) * math.cos(other_lat) * math.sin((lon - other_lon) / 2) ** 2
    )
    return 12742 * math.asin(min(1, math.sqrt(delta)))


def same_site_candidates(airport, local_rows, codes, reference):
    point = airport["coordinates"]["value"]
    if not point:
        return []
    iata, icao = codes["IATA"], codes["ICAO"]
    name = folded_name(airport["name"]["value"] or "")
    candidates = []
    for row in local_rows:
        same_iata = row[0] in iata
        same_icao = row[8] in icao and ICAO.fullmatch(row[8])
        same_name = bool(name and name == folded_name(row[1]))
        if not (same_iata or same_icao or same_name):
            continue
        distance = distance_km(point["latitude"], point["longitude"], *row[4:6])
        same_country = not reference.get("iso_country") or row[3] == reference["iso_country"]
        if (
            (same_country and distance <= 3 and (same_icao or same_name))
            or (same_iata and same_icao and distance <= 5)
            or (same_country and same_iata and distance <= 0.4)
        ):
            candidates.append(row)
    return candidates


def directory_rows(dataset, previous, fly_rows, ourairports):
    """Store locality, status and the reviewed aliases of each formal identity."""
    fly_by_id = {row[7]: row for row in fly_rows}
    formal_ids = {row["airportId"] for row in dataset["airports"]}
    reserved = formal_ids | {
        legacy_id
        for row in previous.values()
        if isinstance(row, dict)
        for legacy_id in row.get("legacyIds", [])
    }
    assigned = defaultdict(lambda: {"IATA": set(), "ICAO": set()})
    for row in dataset["assignments"]:
        assigned[row["airportId"]][row["scheme"]].add(row["code"])

    by_code = defaultdict(list)
    by_name = defaultdict(list)
    for row in fly_rows:
        for code in [row[0], row[8]]:
            if code:
                by_code[code].append(row)
        by_name[folded_name(row[1])].append(row)

    directory = {}
    for airport in dataset["airports"]:
        airport_id = airport["airportId"]
        old = previous.get(airport_id)
        if isinstance(old, dict):
            directory[airport_id] = old
            continue
        reference = ourairports.get(airport.get("externalIds", {}).get("ourAirports"), {})
        indexed = {
            row[7]: row
            for code in assigned[airport_id]["IATA"] | assigned[airport_id]["ICAO"]
            for row in by_code[code]
        }
        name_key = folded_name(airport["name"]["value"] or "")
        indexed.update({row[7]: row for row in by_name[name_key]} if name_key else {})
        candidates = same_site_candidates(
            airport, indexed.values(), assigned[airport_id], reference
        )
        candidates = [row for row in candidates if row[7] not in reserved]
        if len(candidates) > 1:
            # Basel and Mulhouse are separate designators for one reference point.
            # Reconcile only if all existing directory evidence identifies one site.
            if len({(row[1], row[3], row[4], row[5]) for row in candidates}) != 1:
                candidates = []
        legacy_ids = sorted(row[7] for row in candidates)
        reserved.update(legacy_ids)
        local = fly_by_id.get(airport_id) or (candidates[0] if candidates else None)
        status = "unknown"
        if reference.get("type") == "closed":
            status = "closed"
        elif reference.get("type"):
            status = "operating"
        row = {
            "city": reference.get("municipality") or (local[2] if local else ""),
            "country": reference.get("iso_country") or (local[3] if local else "ZZ"),
            "status": status,
        }
        if legacy_ids:
            row["legacyIds"] = legacy_ids
        if old:
            current, alias, city, country, status, zone = old
            row.update(city=city, country=country, status=status)
            if current:
                row["currentIata"] = current
            if alias:
                row["iata"] = alias
            if zone:
                row["timezone"] = zone
        directory[airport_id] = row
    return directory


def compact_object(rows):
    return (
        "{\n"
        + ",\n".join(
            f"  {json.dumps(key)}: {json.dumps(value, ensure_ascii=False, separators=(',', ':'))}"
            for key, value in sorted(rows.items())
        )
        + "\n}\n"
    ).encode()


def validate_directory(dataset, directory, fly_rows):
    expected = {row["airportId"] for row in dataset["airports"]}
    fly_ids = {row[7] for row in fly_rows}
    if len(fly_ids) != len(fly_rows) or set(directory) != expected:
        raise ValueError("Fly directory has duplicate IDs or missing formal identities")
    aliases = set()
    for airport_id, row in directory.items():
        if not isinstance(row.get("city"), str) or not re.fullmatch(r"[A-Z]{2}", row.get("country", "")):
            raise ValueError(f"Invalid locality metadata for {airport_id}")
        if row.get("status") not in {"operating", "closed", "unknown"}:
            raise ValueError(f"Invalid status for {airport_id}")
        for code in ("iata", "currentIata"):
            if code in row and not IATA.fullmatch(row[code]):
                raise ValueError(f"Invalid {code} for {airport_id}")
        for legacy_id in row.get("legacyIds", []):
            if legacy_id not in fly_ids or legacy_id in expected or legacy_id in aliases:
                raise ValueError(f"Conflicting directory crosswalk for {legacy_id}")
            aliases.add(legacy_id)
