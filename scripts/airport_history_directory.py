"""Maintain Fly's physical-site crosswalk and reference metadata."""

import csv
import hashlib
import io
import json
import math
import re
import unicodedata
from pathlib import Path

SOURCE_PATH = Path(__file__).resolve().parents[1] / "packages/core/data/airports.source.json"
OURAIRPORTS = json.loads(SOURCE_PATH.read_bytes())["formalDirectory"]
OURAIRPORTS_SHA256 = OURAIRPORTS["sha256"]
IATA = re.compile(r"[A-Z]{3}")
ICAO = re.compile(r"[A-Z]{4}")
OPERATING_TYPES = {
    "small_airport", "medium_airport", "large_airport",
    "heliport", "seaplane_base", "balloonport",
}


def verify_ourairports(data):
    if hashlib.sha256(data).hexdigest() != OURAIRPORTS_SHA256:
        raise ValueError("OurAirports reference metadata failed SHA-256 verification")
    return data


def parse_ourairports(data):
    data = verify_ourairports(data)
    return {row["id"]: row for row in csv.DictReader(io.StringIO(data.decode("utf-8-sig")))}


def read_ourairports(path):
    return parse_ourairports(path.read_bytes())


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


def directory_rows(dataset, previous, fly_rows, ourairports, previous_airports=()):
    """Refresh reference fields and carry forward reviewed physical-site links."""
    fly_by_id = {row[7]: row for row in fly_rows}
    previous_zones = {
        row["airportId"]: row["timezone"]["value"] for row in previous_airports
    }
    verified_sources = {
        row["sourceId"] for row in dataset["sources"] if row["verificationStatus"] == "verified"
    }
    status_reviews = {
        airport_id: review["status"]
        for airport_id, review in OURAIRPORTS.get("statusReviews", {}).items()
        if review["snapshotRevision"] == OURAIRPORTS["revision"]
        and review["sourceIds"] and verified_sources.issuperset(review["sourceIds"])
    }

    directory = {}
    for airport in dataset["airports"]:
        airport_id = airport["airportId"]
        old = previous.get(airport_id, {})
        if isinstance(old, list):
            _, alias, city, country, _, zone = old
            old = {"city": city, "country": country, "timezone": zone}
            if alias:
                old["iata"] = alias
        row = dict(old)
        row.pop("currentIata", None)
        reference = ourairports.get(airport.get("externalIds", {}).get("ourAirports"), {})
        local = next(
            (fly_by_id[id_] for id_ in [airport_id, *row.get("legacyIds", [])] if id_ in fly_by_id),
            None,
        )
        city = (reference.get("municipality") or "").strip()
        country = (reference.get("iso_country") or "").strip()
        if country == "ZZ" or not re.fullmatch(r"[A-Z]{2}", country):
            country = ""
        for key, value, fallback in (
            ("city", city, local[2] if local else ""),
            ("country", country, local[3] if local else "ZZ"),
        ):
            if value and value != row.get(key):
                row[f"{key}Source"] = "ourAirports"
            old_value = (row.get(key) or "").strip()
            row[key] = value or (old_value if old_value != "ZZ" else "") or fallback
        airport_type = reference.get("type")
        if airport_id in status_reviews:
            row["status"] = status_reviews[airport_id]
        elif airport_type == "closed":
            row["status"] = "closed"
        elif airport_type in OPERATING_TYPES:
            row["status"] = "operating"
        else:
            row["status"] = "unknown"
        if not airport["timezone"]["value"]:
            zone = previous_zones.get(airport_id) or row.get("timezone") or (local[6] if local else None)
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
        if "iata" in row and not IATA.fullmatch(row["iata"]):
            raise ValueError(f"Invalid historical search alias for {airport_id}")
        for legacy_id in row.get("legacyIds", []):
            if legacy_id not in fly_ids or legacy_id in expected or legacy_id in aliases:
                raise ValueError(f"Conflicting directory crosswalk for {legacy_id}")
            aliases.add(legacy_id)
