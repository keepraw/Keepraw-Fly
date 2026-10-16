#!/usr/bin/env bash
# Owner-only final operation. Never run with the Actions GITHUB_TOKEN.
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $# -ge 2 ]] || { echo 'Usage: bash scripts/publish-release.sh CI_RUN_ID IMAGE_RUN_ID [--publish]' >&2; exit 1; }
ci=$1
image_run=$2
publish=${3:-}
[[ $ci =~ ^[0-9]+$ && $image_run =~ ^[0-9]+$ && ( -z $publish || $publish == --publish ) ]]
repo=keepraw/Keepraw-Fly
tag=v0.1.0
[[ $(gh api user --jq .login) == keepraw ]] || { echo 'Authenticate gh as keepraw; no impersonation is permitted.' >&2; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
gh api "repos/$repo/actions/runs/$ci" > "$work/ci.json"
jq -e '.conclusion == "success" and .event == "push" and .head_branch == "main" and .path == ".github/workflows/ci.yml" and .repository.full_name == "keepraw/Keepraw-Fly"' "$work/ci.json"
sha=$(jq -r .head_sha "$work/ci.json")
[[ $(gh api "repos/$repo/git/ref/tags/$tag" --jq .object.sha) == "$sha" ]]
gh api "repos/$repo/actions/runs/$image_run" > "$work/image.json"
jq -e '.conclusion == "success" and .event == "workflow_dispatch" and .head_branch == "main" and .path == ".github/workflows/release.yml" and .repository.full_name == "keepraw/Keepraw-Fly"' "$work/image.json"
gh run download "$image_run" --repo "$repo" --name release-v0.1.0 --dir "$work/assets"
(cd "$work/assets" && sha256sum -c SHA256SUMS)
jq -e --arg sha "$sha" --arg ci "$ci" --arg image "$image_run" \
  '.revision == $sha and .version == "0.1.0" and .author == "keepraw" and .ci_run_id == $ci and .image_run_id == $image' "$work/assets/provenance.json"
# Check anonymous GHCR access before exposing a release users cannot install.
token=$(curl -fsS 'https://ghcr.io/token?service=ghcr.io&scope=repository:keepraw/keepraw-fly:pull' | jq -er .token)
digest=$(sed 's/.*@//' "$work/assets/image.txt")
curl -fsS -H "Authorization: Bearer $token" -H 'Accept: application/vnd.oci.image.index.v1+json' \
  "https://ghcr.io/v2/keepraw/keepraw-fly/manifests/$digest" > "$work/manifest.json"
jq -e 'any(.manifests[]; .platform.os == "linux" and .platform.architecture == "amd64") and any(.manifests[]; .platform.os == "linux" and .platform.architecture == "arm64")' "$work/manifest.json"
status=$(gh api "repos/$repo/releases/tags/$tag" --silent 2>"$work/lookup.err" && echo exists || cat "$work/lookup.err")
if [[ $status == exists ]]; then echo 'Release already exists; refusing to replace it.' >&2; exit 1; fi
[[ $status == *'HTTP 404'* ]] || { echo "$status" >&2; exit 1; }
cp "$work/assets/RELEASE_NOTES.md" "$work/body.md"
cat >> "$work/body.md" <<INFO

## Verified provenance

- Commit: $sha
- Full main CI: https://github.com/$repo/actions/runs/$ci
- Image build: https://github.com/$repo/actions/runs/$image_run
- Docker: $(cat "$work/assets/image.txt")
INFO
gh release create "$tag" --repo "$repo" --verify-tag --target "$sha" --draft \
  --title 'Keepraw-Fly v0.1.0' --notes-file "$work/body.md"
gh api "repos/$repo/releases/tags/$tag" > "$work/release.json"
jq -e --arg sha "$sha" '.author.login == "keepraw" and .draft == true and .tag_name == "v0.1.0" and .target_commitish == $sha' "$work/release.json" || {
  echo 'Draft author/target mismatch. Draft left unpublished for owner inspection.' >&2; exit 1;
}
gh release upload "$tag" "$work/assets/"* --repo "$repo"
gh release download "$tag" --repo "$repo" --dir "$work/verify"
(cd "$work/verify" && sha256sum -c SHA256SUMS)
diff -r "$work/assets" "$work/verify"
gh api "repos/$repo/releases/tags/$tag" > "$work/release.json"
[[ $(jq '.assets | length' "$work/release.json") == $(find "$work/assets" -type f | wc -l) ]]
if [[ $publish == --publish ]]; then
  gh release edit "$tag" --repo "$repo" --draft=false --latest
  gh api "repos/$repo/releases/tags/$tag" --jq '{html_url,tag_name,target_commitish,draft,author:.author.login,assets:[.assets[]|{name,size,digest,browser_download_url}]}'
else
  echo 'Verified draft is ready. Publish with the keepraw account after reviewing attachments.'
fi
