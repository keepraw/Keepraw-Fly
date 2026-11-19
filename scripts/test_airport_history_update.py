"""Exercise publication and pull request handling using offline fixtures."""

import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def load(script):
    spec = importlib.util.spec_from_file_location(script, Path(__file__).with_name(f"{script}.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


updater = load("update-airport-history")
publisher = load("propose-airport-history-update")

SITE = "apt_11111111-1111-4111-8111-111111111111"
NEW_SITE = "apt_22222222-2222-4222-8222-222222222222"
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
        self.addCleanup(patch.stopall)
        patch.multiple(updater, **self.paths).start()

    def simulate(self, incoming, pin=None, download=None):
        pin = pin or publication(incoming)
        report = self.data / "report.md"
        with (
            patch.object(updater, "fetch", side_effect=[encoded(pin), download or encoded(incoming)]) as fetch,
            patch("sys.argv", ["update", "--report", str(report)]),
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
        self.assertIn(("gh", "pr", "edit", "17", "--title", "Update Airport History data to v0.14.0", "--body-file", "report.md"), calls)
        self.assertFalse(any((args[0] == "git" and "push" in args) or args[:3] == ("gh", "pr", "create") for args in calls))


if __name__ == "__main__":
    unittest.main()
