#!/usr/bin/env python3
"""Publish a validated version update on an isolated branch and open its review PR."""

import argparse
import json
import re
import subprocess
from pathlib import Path

DATA = Path("packages/core/data")
PIN = DATA / "airport-history/formal/manifest.json"
FILES = (
    PIN,
    PIN.with_name("airports.json"),
    PIN.with_name("directory.json"),
    DATA / "airport-names.json",
)


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def publish(report, command=run):
    pin = json.loads(PIN.read_bytes())
    version = pin["dataVersion"]
    if not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", version):
        raise ValueError("Invalid version in the validated pin")
    branch = f"automation/airport-history-v{version}"
    title = f"Update Airport History data to v{version}"
    ref = f"refs/heads/{branch}"
    if command("git", "ls-remote", "--heads", "origin", ref):
        command("git", "fetch", "--no-tags", "origin", ref)
        remote = json.loads(command("git", "show", f"FETCH_HEAD:{PIN.as_posix()}"))
        if remote != pin:
            raise ValueError(f"The existing {branch} branch has a different publication pin")
    else:
        command("git", "switch", "-c", branch)
        command("git", "config", "user.name", "github-actions[bot]")
        command("git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
        command("git", "add", "--", *map(str, FILES))
        command("git", "commit", "-m", title)
        command(
            "git", "-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential",
            "push", "origin", f"HEAD:{ref}",
        )
    open_prs = json.loads(command(
        "gh", "pr", "list", "--base", "main", "--head", branch,
        "--state", "open", "--json", "number,url",
    ))
    if open_prs:
        pr = open_prs[0]
        command("gh", "pr", "edit", str(pr["number"]), "--title", title, "--body-file", str(report))
        return pr["url"]
    return command(
        "gh", "pr", "create", "--base", "main", "--head", branch,
        "--title", title, "--body-file", str(report),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    args = parser.parse_args()
    print(publish(args.report))
