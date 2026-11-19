"""Exercise publication and pull request handling using offline fixtures."""

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import airport_history_directory


def load(script):
    spec = importlib.util.spec_from_file_location(script, Path(__file__).with_name(f"{script}.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


updater = load("update-airport-history")
publisher = load("propose-airport-history-update")

SITE = "apt_11111111-1111-4111-8111-111111111111"
NEW_SITE = "apt_22222222-2222-4222-8222-222222222222"
LEGACY = "apt_33333333-3333-4333-8333-333333333333"
HORIZON = {"fromInclusive": "2000-01-01", "toExclusive": "2026-11-19"}
SOURCE = {"sourceId": "source", "verificationStatus": "verified"}
AIRPORT = {
    "airportId": SITE,
    "externalIds": {"ourAirports": "1"},
    "name": {"value": "Airport A", "sourceIds": ["source"]},
    "coordinates": {"value": {"latitude": 10, "longitude": 20}, "sourceIds": ["source"]},
    "timezone": {"value": "Europe/London", "sourceIds": ["source"]},
}
ASSIGNMENT = {
    "assignmentId": "test-aaa",
    "airportId": SITE,
    "scheme": "IATA",
    "code": "AAA",
    "sourceIds": ["source"],
    "verificationStatus": "verified",
    "verifiedOn": "2026-11-18",
    "validFrom": {"earliest": None, "latest": "2000-01-01", "precision": "unknown"},
    "validTo": {"earliest": "2026-11-19", "latest": None, "precision": "unknown"},
}


def dataset(version="0.13.0"):
    return copy.deepcopy({
        "dataVersion": version, "schemaVersion": "3.0.0",
        "airports": [AIRPORT], "assignments": [ASSIGNMENT], "names": [], "sources": [SOURCE],
    })


def encoded(value):
    return (json.dumps(value) + "\n").encode()


def publication(data):
    return {
        "commit": "a" * 40 if data["dataVersion"] == "0.13.0" else "b" * 40,
        "schemaVersion": data["schemaVersion"],
        "dataVersion": data["dataVersion"],
        "queryHorizon": HORIZON,
        "files": {updater.DATASET: {"sha256": updater.sha(encoded(data))}},
    }


def add_site(data):
    data["airports"].append({**AIRPORT, "airportId": NEW_SITE, "externalIds": {}})
    data["assignments"].append({**ASSIGNMENT, "assignmentId": "test-bbb", "code": "BBB", "airportId": NEW_SITE})
    return data


class FormalUpdateTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.data = Path(temp.name)
        self.before = dataset()
        self.old_pin = publication(self.before)
        self.directory = {SITE: {"city": "", "country": "ZZ", "status": "operating"}}
        self.paths = {
            "DATA": self.data, "FORMAL": self.data, "PIN": self.data / "pin.json",
            "TARGET": self.data / "dataset.json", "DIRECTORY": self.data / "directory.json",
            "NAMES": self.data / "names.json",
        }
        for field, data in [
            ("PIN", self.old_pin), ("TARGET", self.before),
            ("DIRECTORY", self.directory), ("NAMES", {SITE: {"names": {"ja": ["空港A", "source"]}}}),
        ]:
            self.paths[field].write_bytes(encoded(data))
        (self.data / "airports.iata.json").write_bytes(encoded([]))
        self.snapshot = self.data / "airports.csv"
        self.set_snapshot("1,Harbor,GB,medium_airport\n")
        self.addCleanup(patch.stopall)
        patch.multiple(updater, **self.paths).start()

    def set_snapshot(self, records):
        data = f"id,municipality,iso_country,type\n{records}".encode()
        self.snapshot.write_bytes(data)
        self.snapshot_sha = updater.sha(data)

    def simulate(self, incoming, pin=None, download=None):
        pin = pin or publication(incoming)
        report = self.data / "report.md"
        with (
            patch.object(updater, "fetch", side_effect=[encoded(pin), download or encoded(incoming)]) as fetch,
            patch.object(airport_history_directory, "OURAIRPORTS_SHA256", self.snapshot_sha),
            patch("sys.argv", ["update", "--ourairports", str(self.snapshot), "--report", str(report)]),
        ):
            updater.main()
        return fetch, report

    def test_no_new_formal_version_leaves_files_untouched(self):
        before = self.paths["TARGET"].stat().st_mtime_ns
        fetch, report = self.simulate(self.before)
        fetch.assert_called_once_with(updater.PUBLICATION, 16_384)
        self.assertFalse(report.exists())
        self.assertEqual(self.paths["TARGET"].stat().st_mtime_ns, before)

    def test_new_version_is_verified_and_adds_fallback_name_record(self):
        after = add_site(dataset("0.14.0"))
        fetch, report = self.simulate(after)
        self.assertEqual(fetch.call_args.args[0], f"{updater.UPSTREAM}/{'b' * 40}/{updater.DATASET}")
        self.assertEqual(self.paths["TARGET"].read_bytes(), encoded(after))
        self.assertEqual(json.loads(self.paths["PIN"].read_bytes()), publication(after))
        self.assertEqual(json.loads(self.paths["NAMES"].read_bytes())[NEW_SITE], {})
        self.assertIn("ja-JP | 1 / 2 | 1", report.read_text())
        self.assertIn("IATA assignments added: 1", report.read_text())

    def assert_rejected(self, after, **kwargs):
        with self.assertRaises(SystemExit) as error:
            self.simulate(after, **kwargs)
        self.assertEqual(error.exception.code, 1)
        self.assertEqual(json.loads(self.paths["PIN"].read_bytes()), self.old_pin)
        self.assertEqual(self.paths["TARGET"].read_bytes(), encoded(self.before))

    def test_same_version_with_different_hash(self):
        self.assert_rejected(add_site(dataset()))

    def test_invalid_sha256(self):
        self.assert_rejected(dataset("0.14.0"), download=b"damaged")

    def test_rejects_an_unverified_directory_snapshot(self):
        self.snapshot.write_bytes(b"damaged")
        self.assert_rejected(dataset("0.14.0"))

    def test_download_writes_only_a_verified_immutable_snapshot(self):
        path = self.data / "downloaded.csv"
        with (
            patch.object(updater, "fetch", return_value=self.snapshot.read_bytes()) as fetch,
            patch.object(airport_history_directory, "OURAIRPORTS_SHA256", self.snapshot_sha),
            patch("sys.argv", ["update", "--fetch-ourairports", str(path)]),
        ):
            updater.main()
        fetch.assert_called_once_with(updater.OURAIRPORTS["csv"])
        self.assertEqual(path.read_bytes(), self.snapshot.read_bytes())

    def test_refreshes_existing_metadata_and_enriches_a_new_airport(self):
        self.save_existing_reference()
        self.set_snapshot("1,New Municipality,CA,closed\n2,New Airport City,GB,small_airport\n")
        after = add_site(dataset("0.14.0"))
        after["airports"][0]["timezone"]["value"] = None
        after["airports"][1]["externalIds"] = {"ourAirports": "2"}
        _, report = self.simulate(after)
        updated = json.loads(self.paths["DIRECTORY"].read_bytes())
        self.assertEqual(updated[SITE], {
            "city": "New Municipality", "citySource": "ourAirports",
            "country": "CA", "countrySource": "ourAirports", "status": "closed",
            "timezone": "Europe/London", "legacyIds": [LEGACY],
        })
        for key, value in [
            ("city", "New Airport City"), ("country", "GB"), ("status", "operating"),
        ]:
            self.assertEqual(updated[NEW_SITE][key], value)
        self.assertNotIn("legacyIds", updated[NEW_SITE])
        self.assertIn("New airports missing city, country, status or timezone: 0", report.read_text())
        self.assertIn("Existing airports with unverified current status: 0", report.read_text())

    def test_keeps_reviewed_closure_for_its_snapshot_revision(self):
        after = dataset("0.14.0")
        review = {SITE: {"snapshotRevision": "a" * 40, "status": "closed", "sourceIds": ["source"]}}
        reference = {"1": {"type": "medium_airport"}}
        for revision, status in (("a" * 40, "closed"), ("b" * 40, "operating")):
            with (
                self.subTest(revision=revision),
                patch.dict(airport_history_directory.OURAIRPORTS, revision=revision, statusReviews=review),
            ):
                directory = airport_history_directory.directory_rows(after, self.directory, [], reference)
                self.assertEqual(directory[SITE]["status"], status)

    def save_existing_reference(self):
        self.directory[SITE] = {
            "city": "Fly City", "country": "US", "status": "operating",
            "timezone": "Europe/London", "legacyIds": [LEGACY], "currentIata": "AAA",
        }
        self.paths["DIRECTORY"].write_bytes(encoded(self.directory))
        (self.data / "airports.iata.json").write_bytes(encoded([
            ["AAA", "Airport A", "Fly City", "US", 10, 20, "Europe/London", LEGACY, "KAAA"],
        ]))

    def test_preserves_known_locality_and_reports_missing_metadata(self):
        self.save_existing_reference()
        self.set_snapshot("")
        after = add_site(dataset("0.14.0"))
        after["airports"][0]["timezone"]["value"] = None
        _, report = self.simulate(after)
        updated = json.loads(self.paths["DIRECTORY"].read_bytes())
        self.assertEqual(updated[SITE], {
            "city": "Fly City", "country": "US", "status": "unknown",
            "timezone": "Europe/London", "legacyIds": [LEGACY],
        })
        self.assertEqual(updated[NEW_SITE], {"city": "", "country": "ZZ", "status": "unknown"})
        for line in (
            "Missing city: 1", "Country ZZ: 1", "Unknown status: 2",
            "New airports missing city, country, status or timezone: 1",
            "Existing airports with unverified current status: 1",
        ):
            self.assertIn(line, report.read_text())

    def test_unsupported_schema(self):
        self.assert_rejected({**dataset("0.14.0"), "schemaVersion": "4.0.0"})

    def test_removed_site_and_assignments(self):
        after = add_site(dataset("0.14.0"))
        after["airports"].pop(0)
        after["assignments"].pop(0)
        self.assert_rejected(after)
        self.assertIn("Removed airportId", (self.data / "report.md").read_text())

    def test_changed_physical_id_under_an_existing_assignment(self):
        after = add_site(dataset("0.14.0"))
        after["assignments"][0]["airportId"] = NEW_SITE
        self.assert_rejected(after)
        self.assertIn("Changed airportId", (self.data / "report.md").read_text())

    def test_overlapping_certain_assignments(self):
        after = add_site(dataset("0.14.0"))
        after["assignments"][1]["code"] = "AAA"
        self.assert_rejected(after)

    def test_rejects_a_move_of_an_existing_airport(self):
        after = dataset("0.14.0")
        after["airports"][0]["coordinates"]["value"]["latitude"] = 11
        self.assert_rejected(after)
        self.assertIn("Changed reference position", (self.data / "report.md").read_text())


class UpdatePullRequestTest(unittest.TestCase):
    def test_existing_pull_request_is_updated_without_a_new_branch(self):
        pin = publication(dataset("0.14.0"))
        calls = []

        def command(*args):
            calls.append(args)
            if args[:2] == ("git", "ls-remote"):
                return "existing branch"
            if args[:2] == ("git", "show"):
                return json.dumps(pin)
            if args[:3] == ("gh", "pr", "list"):
                return '[{"number": 17, "url": "https://example.test/pull/17"}]'
            return ""

        with patch.object(Path, "read_bytes", return_value=encoded(pin)):
            url = publisher.publish(Path("report.md"), command)
        self.assertEqual(url, "https://example.test/pull/17")
        self.assertIn((
            "gh", "api", "--method", "PATCH", "repos/{owner}/{repo}/pulls/17",
            "--raw-field", "title=Update Airport History data to v0.14.0",
            "--field", "body=@report.md", "--jq", ".html_url",
        ), calls)
        self.assertFalse(any((args[0] == "git" and "push" in args) or args[:3] == ("gh", "pr", "create") for args in calls))

    def test_new_publication_pushes_a_branch_and_creates_a_pull_request(self):
        pin = publication(dataset("0.14.0"))
        calls = []

        def command(*args):
            calls.append(args)
            if args[:3] == ("gh", "pr", "list"):
                return "[]"
            if args[:3] == ("gh", "pr", "create"):
                return "https://example.test/pull/18"
            return ""

        with patch.object(Path, "read_bytes", return_value=encoded(pin)):
            url = publisher.publish(Path("report.md"), command)
        self.assertEqual(url, "https://example.test/pull/18")
        self.assertIn(("git", "switch", "-c", "automation/airport-history-v0.14.0"), calls)
        self.assertTrue(any(
            args[0] == "git" and "push" in args
            and args[-1] == "HEAD:refs/heads/automation/airport-history-v0.14.0"
            for args in calls
        ))


if __name__ == "__main__":
    unittest.main()
