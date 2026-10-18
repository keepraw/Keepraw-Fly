#!/usr/bin/env bash
# Fail-closed release source check, run before anything is pushed, signed or
# uploaded. Usage:
#   bash scripts/verify-release-source.sh CI_RUN_JSON EVENT_SHA [TAG_SHA]
#
# CI_RUN_JSON is GET /repos/keepraw/Keepraw-Fly/actions/runs/<ci_run_id>.
# EVENT_SHA is the release workflow's own github.sha. For workflow_dispatch it
# is the tip of the dispatched ref, and it is what GitHub puts in the OIDC
# token and therefore in every attestation's source digest
# (SourceRepositoryDigest). Checking out another commit does not change it, so
# the CI commit, the tag commit and the event commit must be one commit.
# Prints that commit on success.
set -Eeuo pipefail
die() { echo "::error::$*" >&2; exit 1; }
[[ $# == 2 || $# == 3 ]] || { echo "usage: $0 CI_RUN_JSON EVENT_SHA [TAG_SHA]" >&2; exit 2; }
ci_json=$1 event_sha=$2 tag_sha=${3:-}
[[ -s $ci_json ]] || die "CI run metadata is missing"
jq -e 'type == "object"' "$ci_json" >/dev/null 2>&1 || die "CI run metadata is not a JSON object"
jq -e '.status == "completed" and .conclusion == "success"' "$ci_json" >/dev/null \
  || die "CI run $(jq -r '.id // "?"' "$ci_json") did not succeed ($(jq -r '"\(.status // "?")/\(.conclusion // "?")"' "$ci_json"))"
jq -e '.event == "push" and .head_branch == "main" and .path == ".github/workflows/ci.yml" and .repository.full_name == "keepraw/Keepraw-Fly" and .head_repository.full_name == "keepraw/Keepraw-Fly"' "$ci_json" >/dev/null \
  || die "CI run is not an official keepraw/Keepraw-Fly ci.yml push run on main"
ci_sha=$(jq -er '.head_sha' "$ci_json") || die "CI run has no head_sha"
[[ $ci_sha =~ ^[0-9a-f]{40}$ ]] || die "CI head_sha is not a full commit SHA: $ci_sha"
[[ $event_sha =~ ^[0-9a-f]{40}$ ]] || die "Release event SHA is not a full commit SHA: $event_sha"
[[ $ci_sha == "$event_sha" ]] \
  || die "CI run built $ci_sha but this release run is for $event_sha (main moved, or an older CI run was chosen). Attestations would name $event_sha, so nothing is published. Dispatch the release while main is at the CI commit."
if [[ -n $tag_sha ]]; then
  [[ $tag_sha =~ ^[0-9a-f]{40}$ ]] || die "Tag target is not a full commit SHA: $tag_sha"
  [[ $tag_sha == "$ci_sha" ]] || die "Release tag points at $tag_sha, not the CI and release commit $ci_sha"
fi
echo "$ci_sha"
