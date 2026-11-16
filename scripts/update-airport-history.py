#!/usr/bin/env python3
"""Fetch/check only the reviewed upstream dataset. Never build the worldwide research corpus."""
import argparse
import hashlib
from pathlib import Path
from urllib.request import urlopen

REVISION = "bb1046455e949c6c0bf3a18769464cb232bec19e"
SHA256 = "4573fb7e6fac8e02c8e3f57443599385dffada17b250a29f1a18964f6d6d8cc9"
URL = f"https://raw.githubusercontent.com/keepraw/airport-history/{REVISION}/data/airports.json"
TARGET = Path(__file__).resolve().parents[1] / "packages/core/data/airport-history/formal/airports.json"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    with urlopen(URL, timeout=30) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise SystemExit("Pinned formal dataset failed SHA-256 verification")
    if args.check:
        if TARGET.read_bytes() != data:
            raise SystemExit("Committed formal data differs from the pinned upstream dataset")
        print(f"Reviewed airport dataset matches {REVISION}")
    else:
        TARGET.write_bytes(data)


if __name__ == "__main__":
    main()
