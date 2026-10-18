#!/usr/bin/env bash
# Regression for manifest coverage in the real release verifier. gh is a
# recording stand-in, not Sigstore; this test makes no real signature claim.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/assets"
sha=$(printf 'a%.0s' {1..40})
image="ghcr.io/keepraw/keepraw-fly@sha256:$(printf 'b%.0s' {1..64})"
printf '%s\n' "$image" > "$work/assets/image.txt"
jq -n --arg image "$image" --arg sha "$sha" '{image: $image, revision: $sha}' > "$work/assets/provenance.json"
printf 'release payload\n' > "$work/assets/payload.txt"
(cd "$work/assets" && sha256sum image.txt provenance.json payload.txt > SHA256SUMS)
(cd "$work/assets" && sha256sum SHA256SUMS image.txt provenance.json payload.txt | awk '{print $1}') > "$work/assets/attestation.sigstore.json"
printf '%s\n' "${image##*@sha256:}" > "$work/assets/image-attestation.sigstore.json"
cat > "$work/bin/gh" <<'MOCK'
#!/usr/bin/env bash
set -Eeuo pipefail
if [[ ${1:-} == --version ]]; then echo 'gh version 2.102.0'; exit 0; fi
[[ $1 == attestation && $2 == verify ]]
subject=$3; shift 3
bundle=
while (($#)); do
  if [[ $1 == --bundle ]]; then bundle=$2; shift 2; else shift; fi
done
if [[ $subject == oci://* ]]; then digest=${subject##*@sha256:};
else digest=$(sha256sum "$subject" | awk '{print $1}'); fi
grep -qx "$digest" "$bundle"
printf '%s\n' "${subject##*/}" >> "$VERIFICATION_LOG"
MOCK
chmod +x "$work/bin/gh"
export PATH="$work/bin:$PATH" VERIFICATION_LOG="$work/verified.log"
bash scripts/verify-release-provenance.sh "$work/assets" "$sha"
grep -qx SHA256SUMS "$VERIFICATION_LOG"
grep -qx payload.txt "$VERIFICATION_LOG"
echo 'ok - checksum manifest, payloads and image are verified (mock gh)'
# Removing a payload from the checksum manifest leaves sha256sum -c green.
# The manifest signature must still stop publication before upload.
sed -i '/payload.txt/d' "$work/assets/SHA256SUMS"
if bash scripts/verify-release-provenance.sh "$work/assets" "$sha" > "$work/refusal.log" 2>&1; then
  echo 'FAIL: altered checksum manifest was accepted' >&2; exit 1
fi
grep -q 'Provenance verification failed for .*SHA256SUMS' "$work/refusal.log"
echo 'ok - refuses a manifest with a removed payload entry (mock gh)'
echo 'PASS: release manifest provenance regression; no real Sigstore verification'
