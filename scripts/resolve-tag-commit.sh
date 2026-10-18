#!/usr/bin/env bash
# Prints the commit SHA a release tag points at, peeling annotated tags.
# Usage: bash scripts/resolve-tag-commit.sh OWNER/REPO vX.Y.Z   (needs gh + GH_TOKEN)
set -Eeuo pipefail
[[ $# == 2 && $1 =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ && $2 =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || { echo "usage: $0 OWNER/REPO vX.Y.Z" >&2; exit 2; }
ref=$(gh api "repos/$1/git/ref/tags/$2" --jq '.object.type + " " + .object.sha')
type=${ref%% *} sha=${ref#* }
if [[ $type == tag ]]; then
  sha=$(gh api "repos/$1/git/tags/$sha" --jq '.object.type + " " + .object.sha')
  [[ ${sha%% *} == commit ]] || { echo "tag $2 does not peel to a commit" >&2; exit 1; }
  sha=${sha#* }
elif [[ $type != commit ]]; then
  echo "tag $2 points at a $type" >&2; exit 1
fi
[[ $sha =~ ^[0-9a-f]{40}$ ]] || { echo "unexpected tag target: $sha" >&2; exit 1; }
echo "$sha"
