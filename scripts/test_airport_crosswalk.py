"""Check the one-time crosswalk audit and its review classifications."""

import csv
import importlib.util
import json
import unittest
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "audit_airport_crosswalk", Path(__file__).with_name("audit-airport-crosswalk.py")
)
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)

HORIZON = {"fromInclusive": "2000-01-01", "toExclusive": "2026-11-19"}


def airport(id_, name, latitude):
    return {
        "airportId": id_,
        "name": {"value": name},
        "externalIds": {},
        "coordinates": {"value": {"latitude": latitude, "longitude": 20}},
    }


def assignment(id_, code, start, end):
    return {
        "airportId": id_,
        "code": code,
        "scheme": "IATA",
        "verificationStatus": "verified",
        "verifiedOn": start,
        "sourceIds": ["source"],
        "validFrom": {"earliest": start, "latest": start},
        "validTo": {"earliest": end, "latest": end},
    }


def fly(id_, name, code, latitude, country="GB"):
    return [code, name, name, country, latitude, 20, "Europe/London", id_, ""]


def inspect(airports, assignments, directory, rows):
    dataset = {
        "airports": airports,
        "assignments": assignments,
        "sources": [{"sourceId": "source", "verificationStatus": "verified"}],
    }
    return audit.audit_rows(dataset, directory, rows, {}, HORIZON)


class AuditTest(unittest.TestCase):
    def test_reports_competing_sites_and_duplicate_ownership(self):
        airports = [
            airport("former", "Harbor Airport", 10),
            airport("current", "Harbor Airport", 10.001),
        ]
        assignments = [
            assignment("former", "AAA", "2020-01-01", "2025-01-01"),
            assignment("current", "AAA", "2025-01-01", "2026-11-19"),
        ]
        directory = {
            "former": {"country": "GB", "status": "closed", "legacyIds": ["fly"]},
            "current": {"country": "GB", "status": "operating", "legacyIds": ["fly"]},
        }
        rows = inspect(airports, assignments, directory, [fly("fly", "Harbor Airport", "AAA", 10)])
        self.assertEqual(len(rows), 2)
        self.assertEqual({row["formal_airport_id"] for row in rows}, {"former", "current"})
        for row in rows:
            self.assertTrue(row["mapped"])
            self.assertTrue(row["multiple_candidates"])
            self.assertEqual(row["qualified_formal_candidate_count"], 2)
            self.assertIn("duplicate committed ownership", row["manual_review"])
        by_id = {row["formal_airport_id"]: row for row in rows}
        self.assertEqual(by_id["former"]["formal_all_iata"], "AAA")
        self.assertEqual(by_id["former"]["formal_current_iata"], "")
        self.assertEqual(by_id["current"]["formal_current_iata"], "AAA")

    def test_reports_proximity_without_linking_unmatched_ids(self):
        rows = inspect(
            [airport("other", "Railway Airfield", 10)], [],
            {"other": {"country": "GB", "status": "operating"}},
            [fly("fly", "Harbor Airport", "AAA", 10.001)],
        )
        self.assertEqual({row["record_type"] for row in rows}, {"unmatched", "candidate"})
        candidate = next(row for row in rows if row["record_type"] == "candidate")
        self.assertTrue(candidate["nearby_without_identifier_agreement"])
        self.assertTrue(candidate["potential_cross_site_merge"])
        self.assertFalse(candidate["qualified_candidate"])
        self.assertTrue(all(not row["mapped"] for row in rows))

    def test_compares_independent_evidence_for_multi_link_sites(self):
        for country in ("GB", "US"):
            with self.subTest(country=country):
                rows = inspect(
                    [airport("site", "Harbor Airport", 10)], [],
                    {"site": {"country": "GB", "status": "operating", "legacyIds": ["a", "b"]}},
                    [fly("a", "Harbor Airport", "AAA", 10), fly("b", "Harbor Airport", "BBB", 10, country)],
                )
                self.assertEqual({row["linked_fly_records_agree"] for row in rows}, {country == "GB"})
                self.assertEqual({row["potential_cross_site_merge"] for row in rows}, {country != "GB"})

    def test_0130_report_covers_every_committed_alias_and_fly_id(self):
        formal = audit.DATA / "airport-history/formal"
        manifest = json.loads((formal / "manifest.json").read_bytes())
        if manifest["dataVersion"] != "0.13.0":
            self.skipTest("The committed report records the 0.13.0 crosswalk")
        directory = json.loads((formal / "directory.json").read_bytes())
        fly_rows = json.loads((audit.DATA / "airports.iata.json").read_bytes())
        expected = {
            (legacy, airport_id)
            for airport_id, entry in directory.items()
            for legacy in entry.get("legacyIds", [])
        }
        report_path = audit.ROOT / "docs/audits/airport-crosswalk-0.13.0.csv"
        with report_path.open(encoding="utf-8") as source:
            rows = list(csv.DictReader(source))
        mapped = [
            (row["legacy_id"], row["formal_airport_id"])
            for row in rows if row["record_type"] == "mapped"
        ]
        self.assertEqual(len(mapped), 5893)
        self.assertEqual(set(mapped), expected)
        self.assertEqual({row["legacy_id"] for row in rows}, {row[7] for row in fly_rows})
        self.assertEqual(sum(row["record_type"] == "unmatched" for row in rows), 1962)


if __name__ == "__main__":
    unittest.main()
