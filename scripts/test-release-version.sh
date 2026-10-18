#!/usr/bin/env bash
# Failure tests for the single release-version source (scripts/release-version.sh).
set -Eeuo pipefail
cd "$(dirname "$0")/.."
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
fresh() {
  rm -rf "$work/repo"; mkdir -p "$work/repo"
  cp --parents package.json apps/*/package.json packages/*/package.json compose.yaml \
    deploy/Dockerfile deploy/install.sh .github/workflows/fork-pages.yml docs/releases/*.md \
    scripts/release-version.sh "$work/repo/"
}
expect_fail() { # description command...
  local description=$1; shift
  if (cd "$work/repo" && "$@") > "$work/out" 2>&1; then
    echo "FAIL: expected refusal: $description" >&2; exit 1
  fi
  echo "ok - refuses $description: $(tail -n1 "$work/out")"
}
fresh
tag=$(cd "$work/repo" && bash scripts/release-version.sh)
version=${tag#v}
[[ $(cd "$work/repo" && bash scripts/release-version.sh "$tag") == "$tag" ]] && echo "ok - accepts matching tag $tag"
expect_fail "a tag that differs from package.json" bash scripts/release-version.sh v99.0.0
expect_fail "an invalid tag" bash scripts/release-version.sh "v$version-rc.1"
expect_fail "a floating tag" bash scripts/release-version.sh latest
jq '.version = "1.0"' "$work/repo/package.json" > "$work/p" && mv "$work/p" "$work/repo/package.json"
expect_fail "a non X.Y.Z package version" bash scripts/release-version.sh
fresh; jq '.version = "9.9.9"' "$work/repo/apps/web/package.json" > "$work/p" && mv "$work/p" "$work/repo/apps/web/package.json"
expect_fail "a workspace package with a different version" bash scripts/release-version.sh
fresh; sed -i "s/^ARG VERSION=.*/ARG VERSION=9.9.9/" "$work/repo/deploy/Dockerfile"
expect_fail "a stale Dockerfile default" bash scripts/release-version.sh
fresh; sed -i "s/^version=v.*/version=v9.9.9/" "$work/repo/deploy/install.sh"
expect_fail "a stale installer default" bash scripts/release-version.sh
fresh; sed -i "s#keepraw-fly:$tag#keepraw-fly:v9.9.9#" "$work/repo/compose.yaml"
expect_fail "a stale compose image tag" bash scripts/release-version.sh
fresh; sed -i "s/^        default: $tag$/        default: v9.9.9/" "$work/repo/.github/workflows/fork-pages.yml"
expect_fail "a stale Fork Pages default" bash scripts/release-version.sh
fresh; rm "$work/repo/docs/releases/$tag.md"
expect_fail "missing release notes" bash scripts/release-version.sh
# A future bump only needs the mirrors updated together: simulate v$version -> next.
fresh
next="${version%.*}.$(( ${version##*.} + 1 ))"
for manifest in package.json apps/web/package.json packages/*/package.json; do
  jq --arg v "$next" '.version = $v' "$work/repo/$manifest" > "$work/p" && mv "$work/p" "$work/repo/$manifest"
done
sed -i "s/^ARG VERSION=.*/ARG VERSION=$next/" "$work/repo/deploy/Dockerfile"
sed -i "s/^version=v.*/version=v$next/" "$work/repo/deploy/install.sh"
sed -i "s#keepraw-fly:$tag#keepraw-fly:v$next#" "$work/repo/compose.yaml"
sed -i "s/^        default: $tag$/        default: v$next/" "$work/repo/.github/workflows/fork-pages.yml"
cp "$work/repo/docs/releases/$tag.md" "$work/repo/docs/releases/v$next.md"
[[ $(cd "$work/repo" && bash scripts/release-version.sh "v$next") == "v$next" ]] && echo "ok - a consistent bump to v$next is accepted"
echo "PASS: release version source"
