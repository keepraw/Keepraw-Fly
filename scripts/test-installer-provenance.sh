#!/usr/bin/env bash
# Docker-free installer checks for release provenance verification.
# Transport (curl), Docker, ss and the GitHub CLI are replaced with recording
# fakes; the installer's real decision logic runs unmodified. The fake gh
# accepts a bundle only for the exact identity, ref, digest and files the real
# release workflow would sign, so wrong identities and tampered files fail.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin" "$work/fixture/v0.1.0" "$work/fixture/v0.2.0"
revision=$(printf '%040d' 7)

identity=https://github.com/keepraw/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main
image_digest=$(printf '%064d' 3)

# A fake "bundle" carries what a real Sigstore bundle's certificate and
# in-toto statement would: the signer, repository, ref, source commit, runner
# and subject digests. The fake gh accepts it only when every claim equals
# the policy flags the caller passed and the artifact digest is a subject,
# so the installer's flags (not the fixture) decide every outcome.
bundle() { # out source-sha identity repo subject-hex...
  local out=$1 source=$2 who=$3 repo=$4; shift 4
  { echo "fake-sigstore-bundle v1"; echo "identity $who"; echo "repo $repo"
    echo "ref refs/heads/main"; echo "source $source"; echo "runner github-hosted"
    for subject in "$@"; do echo "subject $subject"; done; } > "$out"
}
make_release() { # dir version [attested]
  local dir=$1 version=$2
  cp compose.yaml "$dir/"
  printf 'ghcr.io/keepraw/keepraw-fly@sha256:%s\n' "$image_digest" > "$dir/image.txt"
  printf '{\n  "version": "%s",\n  "revision": "%s",\n  "author": "keepraw",\n  "image": "ghcr.io/keepraw/keepraw-fly@sha256:%s",\n  "ci_run_id": "1",\n  "image_run_id": "2"\n}\n' \
    "${version#v}" "$revision" "$image_digest" > "$dir/provenance.json"
  (cd "$dir" && sha256sum compose.yaml image.txt provenance.json > SHA256SUMS)
  if [[ ${3:-} == attested ]]; then
    bundle "$dir/attestation.sigstore.json" "$revision" "$identity" keepraw/Keepraw-Fly \
      $(cd "$dir" && sha256sum compose.yaml image.txt provenance.json | awk '{print $1}')
    bundle "$dir/image-attestation.sigstore.json" "$revision" "$identity" keepraw/Keepraw-Fly "$image_digest"
  fi
}
make_release "$work/fixture/v0.1.0" v0.1.0
make_release "$work/fixture/v0.2.0" v0.2.0 attested
cp -r "$work/fixture/v0.2.0" "$work/pristine"
restore() { rm -rf "$work/fixture/v0.2.0"; cp -r "$work/pristine" "$work/fixture/v0.2.0"; }
resum() { (cd "$work/fixture/v0.2.0" && sha256sum compose.yaml image.txt provenance.json > SHA256SUMS); }

cat > "$work/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -eu
url=; output=
while (($#)); do case "$1" in https://*) url=$1; shift ;; -o) output=$2; shift 2 ;; *) shift ;; esac; done
version=$(basename "$(dirname "$url")")
source="$FIXTURE/$version/$(basename "$url")"
[[ -f $source ]] || { echo "curl: (22) 404 $url" >&2; exit 22; }
cp "$source" "$output"
MOCK
cat > "$work/bin/gh" <<'MOCK'
#!/usr/bin/env bash
set -eu
if [[ ${1:-} == --version ]]; then echo "gh version ${FAKE_GH_VERSION:-2.102.0} (2026-09-30)"; exit 0; fi
[[ $1 == attestation && $2 == verify ]] || exit 64
subject=$3; shift 3
declare -A flag=()
while (($#)); do
  case "$1" in --deny-self-hosted-runners) flag[$1]=1; shift ;; *) flag[$1]=$2; shift 2 ;; esac
done
echo "verify $(basename "$subject") ${flag[--cert-identity]} ${flag[--source-digest]}" >> "$GH_LOG"
b=${flag[--bundle]}
claim() { sed -n "s/^$1 //p" "$b"; }
[[ $(head -n1 "$b") == "fake-sigstore-bundle v1" ]] || { echo "malformed bundle" >&2; exit 1; }
[[ $(claim repo) == "${flag[--repo]}" && $(claim identity) == "${flag[--cert-identity]}" ]] || { echo "signer mismatch" >&2; exit 1; }
[[ $(claim ref) == "${flag[--source-ref]}" && $(claim source) == "${flag[--source-digest]}" ]] || { echo "source mismatch" >&2; exit 1; }
[[ -n ${flag[--deny-self-hosted-runners]:-} && $(claim runner) == github-hosted ]] || exit 1
if [[ $subject == oci://* ]]; then
  # The real gh resolves the reference in the registry; the fake registry
  # serves REGISTRY_DIGEST (default: the digest named in the reference).
  digest=${REGISTRY_DIGEST:-${subject##*@sha256:}}
else
  digest=$(sha256sum "$subject" | awk '{print $1}')
fi
claim subject | grep -qx "$digest" || { echo "subject digest not attested" >&2; exit 1; }
MOCK
cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
case "$*" in
  "compose up --help") echo "--wait" ;;
  ps\ *|volume\ ls*|network\ ls*) ;;
  *) echo "docker $*" >> "$DOCKER_LOG" ;;
esac
exit 0
MOCK
printf '#!/usr/bin/env bash\nexit 0\n' > "$work/bin/ss"
chmod +x "$work/bin/"*
export PATH="$work/bin:$PATH" FIXTURE="$work/fixture" GH_LOG="$work/gh.log" DOCKER_LOG="$work/docker.log" EXPECT_REVISION="$revision"

run() { # expected-status description args...
  local expected=$1 description=$2; shift 2
  local status=0
  : > "$GH_LOG"; : > "$DOCKER_LOG"
  rm -rf "$work/instance"
  bash deploy/install.sh --dir "$work/instance" --local --yes "$@" > "$work/out" 2>&1 || status=$?
  if [[ $expected == ok && $status != 0 ]] || [[ $expected == fail && $status == 0 ]]; then
    cat "$work/out" >&2; echo "FAIL: $description (exit $status)" >&2; exit 1
  fi
  echo "ok - $description"
}

run ok "attested release verifies every file and the image before deployment" --version v0.2.0
grep -q '^verify compose.yaml ' "$GH_LOG" && grep -q '^verify image.txt ' "$GH_LOG" && grep -q '^verify provenance.json ' "$GH_LOG"
grep -q "^verify keepraw-fly@sha256:$image_digest " "$GH_LOG"
grep -q 'compose.*up -d --wait' "$DOCKER_LOG"
grep -q "pull ghcr.io/keepraw/keepraw-fly@sha256:$image_digest" "$DOCKER_LOG"
grep -q 'Verified provenance: v0.2.0 files and image' "$work/out"

run ok "legacy v0.1.0 stays installable (rollback) and is reported as checksum-only" --version v0.1.0
[[ ! -s $GH_LOG ]]
grep -q 'predates release provenance attestations' "$work/out"
grep -q 'Neither its files nor its image carry provenance' "$work/out"

refused() { # nothing was pulled or started
  ! grep -qE ' (pull|up) ' "$DOCKER_LOG"
}

sed -i 's/^runner .*/runner self-hosted/' "$work/fixture/v0.2.0/attestation.sigstore.json"
run fail "a file attestation from a self-hosted runner is refused" --version v0.2.0; refused; restore

printf 'not a bundle\n' > "$work/fixture/v0.2.0/attestation.sigstore.json"
run fail "a corrupted file attestation bundle is refused" --version v0.2.0; refused
grep -q 'Provenance verification failed' "$work/out"; restore

bundle "$work/fixture/v0.2.0/attestation.sigstore.json" "$revision" \
  https://github.com/attacker/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main attacker/Keepraw-Fly \
  $(cd "$work/fixture/v0.2.0" && sha256sum compose.yaml image.txt provenance.json | awk '{print $1}')
run fail "files signed by another repository's workflow are refused" --version v0.2.0; refused; restore

bundle "$work/fixture/v0.2.0/attestation.sigstore.json" "$(printf '%040d' 8)" "$identity" keepraw/Keepraw-Fly \
  $(cd "$work/fixture/v0.2.0" && sha256sum compose.yaml image.txt provenance.json | awk '{print $1}')
run fail "a file attestation for another source commit is refused" --version v0.2.0; refused; restore

printf 'ghcr.io/keepraw/keepraw-fly@sha256:%064d\n' 9 > "$work/fixture/v0.2.0/image.txt"; resum
run fail "a swapped image digest with recomputed SHA256SUMS is refused" --version v0.2.0; refused
grep -q 'Provenance verification failed for image.txt' "$work/out"; restore

rm "$work/fixture/v0.2.0/attestation.sigstore.json"
run fail "a release without its file attestation bundle is refused" --version v0.2.0; refused; restore

# OCI image attestation (image-attestation.sigstore.json)
rm "$work/fixture/v0.2.0/image-attestation.sigstore.json"
run fail "a release without the image attestation is refused" --version v0.2.0; refused
grep -q 'Cannot download image-attestation.sigstore.json' "$work/out"; restore

printf '{"mediaType": "broken"\n' > "$work/fixture/v0.2.0/image-attestation.sigstore.json"
run fail "a corrupted image attestation is refused" --version v0.2.0; refused
grep -q 'Provenance verification failed for image' "$work/out"; restore

bundle "$work/fixture/v0.2.0/image-attestation.sigstore.json" "$revision" "$identity" keepraw/Keepraw-Fly "$(printf '%064d' 4)"
run fail "an image attestation for a different digest is refused" --version v0.2.0; refused; restore

REGISTRY_DIGEST=$(printf '%064d' 5) run fail "a registry serving a different image than the attested digest is refused" --version v0.2.0; refused

bundle "$work/fixture/v0.2.0/image-attestation.sigstore.json" "$revision" \
  https://github.com/keepraw/Keepraw-Fly/.github/workflows/ci.yml@refs/heads/main keepraw/Keepraw-Fly "$image_digest"
run fail "an image built by another workflow is refused" --version v0.2.0; refused; restore

bundle "$work/fixture/v0.2.0/image-attestation.sigstore.json" "$revision" \
  https://github.com/fork/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main fork/Keepraw-Fly "$image_digest"
run fail "an image built by another repository is refused" --version v0.2.0; refused; restore

bundle "$work/fixture/v0.2.0/image-attestation.sigstore.json" "$(printf '%040d' 8)" "$identity" keepraw/Keepraw-Fly "$image_digest"
run fail "an image whose source commit differs from the release is refused" --version v0.2.0; refused; restore

sed -i "s/\"image\": \"[^\"]*\"/\"image\": \"ghcr.io\/keepraw\/keepraw-fly@sha256:$(printf '%064d' 6)\"/" "$work/fixture/v0.2.0/provenance.json"; resum
bundle "$work/fixture/v0.2.0/attestation.sigstore.json" "$revision" "$identity" keepraw/Keepraw-Fly \
  $(cd "$work/fixture/v0.2.0" && sha256sum compose.yaml image.txt provenance.json | awk '{print $1}')
run fail "provenance.json naming another image than image.txt is refused" --version v0.2.0; refused
grep -q 'names a different image' "$work/out"; restore

FAKE_GH_VERSION=2.101.0 run fail "GitHub CLI older than 2.102.0 is refused" --version v0.2.0; refused
grep -q 'too old' "$work/out"

sed -i 's/"version": "0.2.0"/"version": "0.3.0"/' "$work/fixture/v0.2.0/provenance.json"; resum
run fail "provenance metadata for another version is refused" --version v0.2.0; restore

run fail "a floating version is refused" --version latest
echo "PASS: installer provenance verification (2 success and 17 refusal cases; mock gh, not real Sigstore)"
