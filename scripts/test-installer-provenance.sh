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

make_release() { # dir version [attested]
  local dir=$1 version=$2
  cp compose.yaml "$dir/"
  printf 'ghcr.io/keepraw/keepraw-fly@sha256:%064d\n' 3 > "$dir/image.txt"
  printf '{\n  "version": "%s",\n  "revision": "%s",\n  "author": "keepraw"\n}\n' "${version#v}" "$revision" > "$dir/provenance.json"
  (cd "$dir" && sha256sum compose.yaml image.txt provenance.json > SHA256SUMS)
  if [[ ${3:-} == attested ]]; then
    # The fake "bundle" records digests of the subjects it covers.
    (cd "$dir" && sha256sum compose.yaml image.txt provenance.json | awk '{print $1}' > attestation.sigstore.json)
  fi
}
make_release "$work/fixture/v0.1.0" v0.1.0
make_release "$work/fixture/v0.2.0" v0.2.0 attested

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
file=$3; shift 3
declare -A flag=()
while (($#)); do
  case "$1" in --deny-self-hosted-runners) flag[$1]=1; shift ;; *) flag[$1]=$2; shift 2 ;; esac
done
echo "verify $(basename "$file") ${flag[--cert-identity]} ${flag[--source-digest]}" >> "$GH_LOG"
[[ ${flag[--repo]} == keepraw/Keepraw-Fly ]] || exit 1
[[ ${flag[--cert-identity]} == "${EXPECT_IDENTITY:-https://github.com/keepraw/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main}" ]] || exit 1
[[ ${flag[--source-ref]} == refs/heads/main && ${flag[--source-digest]} == "$EXPECT_REVISION" ]] || exit 1
[[ -n ${flag[--deny-self-hosted-runners]:-} ]] || exit 1
[[ -z ${FAIL_SIGNATURE:-} ]] || { echo "signature invalid" >&2; exit 1; }
grep -qx "$(sha256sum "$file" | awk '{print $1}')" "${flag[--bundle]}"
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

run ok "attested release verifies every downloaded file before deployment" --version v0.2.0
grep -q '^verify compose.yaml ' "$GH_LOG" && grep -q '^verify image.txt ' "$GH_LOG" && grep -q '^verify provenance.json ' "$GH_LOG"
grep -q 'compose.*up -d --wait' "$DOCKER_LOG"
grep -q 'Verified provenance: v0.2.0' "$work/out"

run ok "legacy v0.1.0 stays installable (rollback) and is reported as checksum-only" --version v0.1.0
[[ ! -s $GH_LOG ]]
grep -q 'predates release provenance attestations' "$work/out"

FAIL_SIGNATURE=1 run fail "invalid signature is refused" --version v0.2.0
[[ ! -s $DOCKER_LOG ]] || ! grep -q ' up ' "$DOCKER_LOG"
grep -q 'Provenance verification failed' "$work/out"

EXPECT_IDENTITY=https://github.com/attacker/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main \
  run fail "a different signer identity is refused" --version v0.2.0

EXPECT_REVISION=$(printf '%040d' 8) run fail "an attestation for another source commit is refused" --version v0.2.0

cp "$work/fixture/v0.2.0/image.txt" "$work/image.bak"
printf 'ghcr.io/keepraw/keepraw-fly@sha256:%064d\n' 9 > "$work/fixture/v0.2.0/image.txt"
(cd "$work/fixture/v0.2.0" && sha256sum compose.yaml image.txt provenance.json > SHA256SUMS)
run fail "a swapped image digest with recomputed SHA256SUMS is refused" --version v0.2.0
grep -q 'Provenance verification failed for image.txt' "$work/out"
cp "$work/image.bak" "$work/fixture/v0.2.0/image.txt"
(cd "$work/fixture/v0.2.0" && sha256sum compose.yaml image.txt provenance.json > SHA256SUMS)

mv "$work/fixture/v0.2.0/attestation.sigstore.json" "$work/bundle.bak"
run fail "a release without its attestation bundle is refused" --version v0.2.0
mv "$work/bundle.bak" "$work/fixture/v0.2.0/attestation.sigstore.json"

FAKE_GH_VERSION=2.101.0 run fail "GitHub CLI older than 2.102.0 is refused" --version v0.2.0
grep -q 'too old' "$work/out"

sed -i 's/"version": "0.2.0"/"version": "0.3.0"/' "$work/fixture/v0.2.0/provenance.json"
(cd "$work/fixture/v0.2.0" && sha256sum compose.yaml image.txt provenance.json > SHA256SUMS)
run fail "provenance metadata for another version is refused" --version v0.2.0

run fail "a floating version is refused" --version latest
echo "PASS: installer provenance verification (success and 9 refusal cases)"
