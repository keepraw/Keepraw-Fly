#!/usr/bin/env bash
# gh attestation verify before 2.102.0 matched --signer-workflow by prefix
# (GHSA-wjmr-j3rp-mh2g) and --source-ref case-insensitively (GHSA-4mq3-hpgx-9cx8).
set -Eeuo pipefail
minimum=2.102.0
command -v gh >/dev/null || { echo "GitHub CLI (gh) >= $minimum is required to verify release provenance" >&2; exit 1; }
actual=$(gh --version | sed -n 's/^gh version \([0-9][0-9.]*\).*/\1/p' | head -n1)
[[ -n $actual && $(printf '%s\n%s\n' "$minimum" "$actual" | sort -V | head -n1) == "$minimum" ]] \
  || { echo "GitHub CLI $actual is too old; provenance verification requires >= $minimum" >&2; exit 1; }
