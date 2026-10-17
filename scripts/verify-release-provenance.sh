#!/usr/bin/env bash
# Verify GitHub Artifact Attestations for a downloaded release directory.
# Usage: bash scripts/verify-release-provenance.sh DIR COMMIT_SHA
#
# Every file listed in DIR/SHA256SUMS must be covered
# by DIR/attestation.sigstore.json, signed by release.yml on refs/heads/main of
# keepraw/Keepraw-Fly, built from COMMIT_SHA on a GitHub-hosted runner. The
# pushed image digest named in image.txt must carry the same provenance.
set -Eeuo pipefail
[[ $# == 2 && -d $1 && $2 =~ ^[0-9a-f]{40}$ ]] || { echo "usage: $0 DIR COMMIT_SHA" >&2; exit 2; }
dir=$1 sha=$2
repo=keepraw/Keepraw-Fly
identity="https://github.com/$repo/.github/workflows/release.yml@refs/heads/main"
bash "$(dirname "$0")/check-gh-version.sh"
for bundle in attestation.sigstore.json image-attestation.sigstore.json; do
  [[ -s $dir/$bundle ]] || { echo "Missing provenance bundle $bundle; refusing unattested release" >&2; exit 1; }
done
verify() {
  gh attestation verify "$1" --bundle "$2" --repo "$repo" --cert-identity "$identity" \
    --source-ref refs/heads/main --source-digest "$sha" --deny-self-hosted-runners >/dev/null \
    || { echo "Provenance verification failed for $1" >&2; exit 1; }
}
(cd "$dir" && sha256sum -c SHA256SUMS >/dev/null)
while read -r _ name; do
  verify "$dir/${name#./}" "$dir/attestation.sigstore.json"
done < "$dir/SHA256SUMS"
image=$(cat "$dir/image.txt")
[[ $image =~ ^ghcr\.io/keepraw/keepraw-fly@sha256:[0-9a-f]{64}$ ]] || { echo "Invalid image reference" >&2; exit 1; }
verify "oci://$image" "$dir/image-attestation.sigstore.json"
echo "Provenance verified: $(wc -l < "$dir/SHA256SUMS") attachments and $image from $sha"
