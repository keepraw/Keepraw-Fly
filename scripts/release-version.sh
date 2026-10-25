#!/usr/bin/env bash
# Single source of truth for the application release version: the root
# package.json "version". Prints "vX.Y.Z" after verifying that every
# release-relevant mirror agrees. With an argument, also requires that tag.
#
#   bash scripts/release-version.sh            # -> v0.2.0
#   bash scripts/release-version.sh v0.2.0     # fails unless the tag matches
#
# Mirrors are deliberate defaults inside self-contained release attachments
# (the installer and compose.yaml are downloaded and run without the repo),
# so they are checked rather than computed.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
die() { echo "release-version: $*" >&2; exit 1; }
command -v jq >/dev/null || die "jq is required"
version=$(jq -er .version package.json) || die "package.json has no version"
[[ $version =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] \
  || die "package.json version '$version' is not a stable X.Y.Z release"
tag="v$version"
for manifest in apps/web/package.json packages/*/package.json; do
  actual=$(jq -er .version "$manifest") || die "$manifest has no version"
  [[ $actual == "$version" ]] || die "$manifest is $actual, expected $version"
done
mirror() { # file, extended regex that must match exactly once
  [[ $(grep -cE -- "$2" "$1" || true) == 1 ]] || die "$1 does not pin $tag (expected /$2/)"
}
escaped=${version//./\\.}
mirror compose.yaml "image: \\$\\{KEEPRAW_IMAGE:-ghcr\\.io/keepraw/keepraw-fly:v$escaped\\}$"
mirror deploy/Dockerfile "^ARG VERSION=$escaped$"
mirror deploy/install.sh "^version=v$escaped$"
mirror .github/workflows/fork-pages.yml "^        default: v$escaped$"
[[ -f docs/releases/$tag.md ]] || die "docs/releases/$tag.md (release notes) is missing"
if (($#)); then
  [[ $1 =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || die "invalid release tag '$1'"
  [[ $1 == "$tag" ]] || die "tag $1 does not match package version $version"
fi
echo "$tag"
