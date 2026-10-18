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
# The release is whatever package.json declares at the verified CI commit.
tag=$(bash scripts/release-version.sh)
version=${tag#v}
bash scripts/check-gh-version.sh
[[ $(gh api user --jq .login) == keepraw ]] || { echo 'Authenticate gh as keepraw; no impersonation is permitted.' >&2; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# The by-tag REST endpoint excludes drafts. List releases with owner access so
# an existing draft is a conflict too, before attempting any creation/download.
gh api "repos/$repo/releases" --paginate --jq '.[] | select(.tag_name == "'"$tag"'") | .id' > "$work/existing-ids"
if [[ -s $work/existing-ids ]]; then echo 'Release or draft already exists; refusing to replace it.' >&2; exit 1; fi
gh api "repos/$repo/actions/runs/$ci" > "$work/ci.json"
jq -e '.conclusion == "success" and .event == "push" and .head_branch == "main" and .path == ".github/workflows/ci.yml" and .repository.full_name == "keepraw/Keepraw-Fly"' "$work/ci.json"
sha=$(jq -r .head_sha "$work/ci.json")
[[ $(git rev-parse HEAD) == "$sha" ]] || { echo "Check out the CI commit $sha before publishing (version source)." >&2; exit 1; }
[[ $(bash scripts/resolve-tag-commit.sh "$repo" "$tag") == "$sha" ]]
gh api "repos/$repo/actions/runs/$image_run" > "$work/image.json"
# The image run's own commit is the source digest of its attestations.
jq -e --arg sha "$sha" '.conclusion == "success" and .event == "workflow_dispatch" and .head_branch == "main" and .path == ".github/workflows/release.yml" and .repository.full_name == "keepraw/Keepraw-Fly" and .head_sha == $sha' "$work/image.json" \
  || { echo "Image run $image_run is not a successful release.yml run for $sha." >&2; exit 1; }
gh run download "$image_run" --repo "$repo" --name "release-$tag" --dir "$work/assets"
(cd "$work/assets" && sha256sum -c SHA256SUMS)
jq -e --arg sha "$sha" --arg ci "$ci" --arg image "$image_run" \
  --arg version "$version" '.revision == $sha and .version == $version and .author == "keepraw" and .ci_run_id == $ci and .image_run_id == $image' "$work/assets/provenance.json"
# Every attachment and the image must carry release.yml provenance for $sha.
bash scripts/verify-release-provenance.sh "$work/assets" "$sha"
# Check anonymous GHCR access before exposing a release users cannot install.
token=$(curl -fsS 'https://ghcr.io/token?service=ghcr.io&scope=repository:keepraw/keepraw-fly:pull' | jq -er .token)
digest=$(sed 's/.*@//' "$work/assets/image.txt")
curl -fsS -H "Authorization: Bearer $token" -H 'Accept: application/vnd.oci.image.index.v1+json' \
  "https://ghcr.io/v2/keepraw/keepraw-fly/manifests/$digest" > "$work/manifest.json"
jq -e 'any(.manifests[]; .platform.os == "linux" and .platform.architecture == "amd64") and any(.manifests[]; .platform.os == "linux" and .platform.architecture == "arm64")' "$work/manifest.json"
cp "$work/assets/RELEASE_NOTES.md" "$work/body.md"
cat >> "$work/body.md" <<INFO

## Verified provenance

- Commit: $sha
- Full main CI: https://github.com/$repo/actions/runs/$ci
- Image build: https://github.com/$repo/actions/runs/$image_run
- Docker: $(cat "$work/assets/image.txt")
INFO
gh release create "$tag" --repo "$repo" --verify-tag --target "$sha" --draft \
  --title "Keepraw-Fly $tag" --notes-file "$work/body.md"
release_api=$(gh release view "$tag" --repo "$repo" --json apiUrl --jq .apiUrl)
gh api "$release_api" > "$work/release.json"
jq -e --arg sha "$sha" --arg tag "$tag" '.author.login == "keepraw" and .draft == true and .tag_name == $tag and .target_commitish == $sha' "$work/release.json" || {
  echo 'Draft author/target mismatch. Draft left unpublished for owner inspection.' >&2; exit 1;
}
gh release upload "$tag" "$work/assets/"* --repo "$repo"
gh release download "$tag" --repo "$repo" --dir "$work/verify"
(cd "$work/verify" && sha256sum -c SHA256SUMS)
diff -r "$work/assets" "$work/verify"
gh api "$release_api" > "$work/release.json"
[[ $(jq '.assets | length' "$work/release.json") == $(find "$work/assets" -type f | wc -l) ]]
if [[ $publish == --publish ]]; then
  gh release edit "$tag" --repo "$repo" --draft=false --latest
  gh api "$release_api" --jq '{html_url,tag_name,target_commitish,draft,author:.author.login,assets:[.assets[]|{name,size,digest,browser_download_url}]}'
else
  echo 'Verified draft is ready. Publish with the keepraw account after reviewing attachments.'
fi
