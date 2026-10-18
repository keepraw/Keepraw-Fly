#!/usr/bin/env bash
# Production archive/container and installer transaction integration checks.
set -Eeuo pipefail
cd "$(dirname "$0")/.."
for script in deploy/install.sh scripts/package-release.sh scripts/publish-release.sh; do bash -n "$script"; done
work=$(mktemp -d)
project="keepraw-fly-test-$$"
cleanup() {
  docker rm -f "$project-subpath" >/dev/null 2>&1 || true
  docker rm -f "$project-port-conflict" >/dev/null 2>&1 || true
  docker compose -p "$project" --env-file "$work/test.env" -f compose.yaml down -v >/dev/null 2>&1 || true
  if [[ -f $work/instance/compose.yaml ]]; then
    docker compose -p keepraw-fly --project-directory "$work/instance" -f "$work/instance/compose.yaml" down -v >/dev/null 2>&1 || true
  fi
  rm -rf "$work"
}
trap cleanup EXIT
mkdir "$work/zip" "$work/tar" "$work/container" "$work/fixture" "$work/bin"
(cd artifacts/release && sha256sum -c SHA256SUMS)
tag=$(bash scripts/release-version.sh)
unzip -q "artifacts/release/keepraw-fly-$tag.zip" -d "$work/zip"
tar -xzf "artifacts/release/keepraw-fly-$tag.tar.gz" -C "$work/tar"
diff -r "$work/zip" "$work/tar"
(cd "$work/tar" && sha256sum -c FILES.sha256 >/dev/null)
docker build -f deploy/Dockerfile --build-arg "REVISION=$(git rev-parse HEAD)" -t keepraw-fly:deployment-test .
cat > "$work/test.env" <<ENV
KEEPRAW_IMAGE=keepraw-fly:deployment-test
SITE_ADDRESS=https://localhost
HTTP_PORT=18080
HTTPS_PORT=18443
ENV
docker compose -p "$project" --env-file "$work/test.env" -f compose.yaml up -d --wait --wait-timeout 90
id=$(docker compose -p "$project" --env-file "$work/test.env" -f compose.yaml ps -q web)
docker exec "$id" sh -c '! command -v node && ! command -v pnpm && test -f /srv/index.html'
docker cp "$id:/srv/." "$work/container/"
diff -r "$work/tar" "$work/container"
# Caddy's localhost internal CA exercises real TLS without claiming public ACME.
docker cp "$id:/data/caddy/pki/authorities/local/root.crt" "$work/root.crt"
HTTPS_PROXY= HTTP_PROXY= ALL_PROXY= curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 1 \
  --cacert "$work/root.crt" https://localhost:18443/release.json > "$work/served.json"
cmp "$work/served.json" "$work/tar/release.json"
mkdir -p "$work/subpath/Keepraw-Fly"
cp -a "$work/tar/." "$work/subpath/Keepraw-Fly/"
docker run -d --name "$project-subpath" -e SITE_ADDRESS=https://localhost \
  -p 127.0.0.1:18444:443 -v "$work/subpath:/srv:ro" keepraw-fly:deployment-test >/dev/null
for attempt in {1..20}; do
  if docker cp "$project-subpath:/data/caddy/pki/authorities/local/root.crt" "$work/subpath-root.crt" 2>/dev/null; then break; fi
  sleep 1
done
HTTPS_PROXY= HTTP_PROXY= ALL_PROXY= curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 1 \
  --cacert "$work/subpath-root.crt" https://localhost:18444/Keepraw-Fly/release.json > "$work/served-subpath.json"
cmp "$work/served-subpath.json" "$work/tar/release.json"
# Security headers and cache rules from the real image's Caddy, root and subpath.
policy=$(node --input-type=module -e 'const m = await import(process.argv[1]); console.log(m.headerPolicy)' "$PWD/apps/web/security-policy.mjs")
asset=$(cd "$work/tar/assets" && ls index-*.js | head -n1)
check_headers() { # cacert base-url
  local headers
  for path in / "assets/$asset"; do
    headers=$(HTTPS_PROXY='' HTTP_PROXY='' ALL_PROXY='' curl -fsS -D - -o /dev/null --cacert "$1" "$2$path" | tr -d '\r')
    grep -qixF "content-security-policy: $policy" <<< "$headers"
    grep -qix 'strict-transport-security: max-age=31536000' <<< "$headers"
    grep -qix 'x-frame-options: DENY' <<< "$headers"
    grep -qix 'referrer-policy: no-referrer' <<< "$headers"
    grep -qix 'x-content-type-options: nosniff' <<< "$headers"
    ! grep -qi '^server:' <<< "$headers"
    if [[ $path == / ]]; then grep -qix 'cache-control: no-cache' <<< "$headers"
    else grep -qix 'cache-control: public, max-age=31536000, immutable' <<< "$headers"; fi
  done
}
check_headers "$work/root.crt" https://localhost:18443/
check_headers "$work/subpath-root.crt" https://localhost:18444/Keepraw-Fly/
if [[ ${KEEPRAW_BROWSER_SMOKE:-0} == 1 ]]; then
  node scripts/smoke-release.mjs https://localhost:18443/ https://localhost:18444/Keepraw-Fly/
fi
docker rm -f "$project-subpath" >/dev/null
docker compose -p "$project" --env-file "$work/test.env" -f compose.yaml down -v
# Exercise installer file transactions using real containers; only registry/download
# transport is replaced with a known local fixture before the public release exists.
cp compose.yaml "$work/fixture/"
printf 'ghcr.io/keepraw/keepraw-fly@sha256:%064d\n' 1 > "$work/fixture/image.txt"
(cd "$work/fixture" && sha256sum compose.yaml image.txt > SHA256SUMS)
real_docker=$(command -v docker)
real_curl=$(command -v curl)
mkdir "$work/fixture/v0.1.1"
cp compose.yaml "$work/fixture/v0.1.1/"
printf 'ghcr.io/keepraw/keepraw-fly@sha256:%064d\n' 2 > "$work/fixture/v0.1.1/image.txt"
# Releases after v0.1.0 must carry provenance; the installer verifies it with gh.
# A recording fake gh accepts only the official identity and the subjects listed
# in the fixture bundle (scripts/test-installer-provenance.sh covers refusals).
fixture_revision=$(git rev-parse HEAD)
printf '{\n  "version": "0.1.1",\n  "revision": "%s",\n  "author": "keepraw",\n  "image": "%s"\n}\n' \
  "$fixture_revision" "$(cat "$work/fixture/v0.1.1/image.txt")" > "$work/fixture/v0.1.1/provenance.json"
(cd "$work/fixture/v0.1.1" && sha256sum compose.yaml image.txt provenance.json > SHA256SUMS \
  && sha256sum compose.yaml image.txt provenance.json | awk '{print $1}' > attestation.sigstore.json)
# The image attestation lists the attested image digest (the fake gh resolves
# oci://...@sha256:<digest> to that digest, as the registry would).
printf '%064d\n' 2 > "$work/fixture/v0.1.1/image-attestation.sigstore.json"
cat > "$work/bin/curl" <<'MOCK'
#!/usr/bin/env bash
set -eu
url=; output=
while (($#)); do
 case "$1" in
  https://github.com/*) url=$1; shift ;;
  -o) output=$2; shift 2 ;;
  *) shift ;;
 esac
done
if [[ $url == */v0.1.1/* ]]; then
  cp "$FIXTURE/v0.1.1/$(basename "$url")" "$output"
else
  cp "$FIXTURE/$(basename "$url")" "$output"
fi
MOCK
cat > "$work/bin/docker" <<'MOCK'
#!/usr/bin/env bash
set -eu
if [[ ${1:-} == pull ]]; then exit 0; fi
if [[ ${1:-} == compose ]]; then
  if [[ " $* " == *' up '* && " $* " != *' --help '* && -n ${FAIL_FIRST_START:-} && ! -e $FAIL_FIRST_START ]]; then
    touch "$FAIL_FIRST_START"
    export KEEPRAW_IMAGE=keepraw-fly:deployment-test
    "$REAL_DOCKER" "$@"
    exit 42
  fi
  if [[ " $* " == *' up '* && " $* " != *' --help '* && -n ${FAIL_UP_ONCE:-} && ! -e $FAIL_UP_ONCE ]]; then
    touch "$FAIL_UP_ONCE"
    exit 42
  fi
  export KEEPRAW_IMAGE=keepraw-fly:deployment-test
fi
exec "$REAL_DOCKER" "$@"
MOCK
cat > "$work/bin/gh" <<'MOCK'
#!/usr/bin/env bash
set -eu
if [[ ${1:-} == --version ]]; then echo "gh version 2.102.0 (2026-09-30)"; exit 0; fi
[[ $1 == attestation && $2 == verify ]] || exit 64
file=$3; shift 3
args=" $* "
[[ $args == *" --repo keepraw/Keepraw-Fly "* ]]
[[ $args == *" --cert-identity https://github.com/keepraw/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main "* ]]
[[ $args == *" --source-ref refs/heads/main "* && $args == *" --source-digest $FIXTURE_REVISION "* ]]
[[ $args == *" --deny-self-hosted-runners "* ]]
bundle=$(sed -n 's/.*--bundle \([^ ]*\).*/\1/p' <<< "$args")
if [[ $file == oci://* ]]; then digest=${file##*@sha256:}; else digest=$(sha256sum "$file" | awk '{print $1}'); fi
grep -qx "$digest" "$bundle"
MOCK
chmod +x "$work/bin/"*
export FIXTURE_REVISION="$fixture_revision"
export REAL_DOCKER="$real_docker" FIXTURE="$work/fixture"
export PATH="$work/bin:$PATH"
install_args=(--dir "$work/instance" --version v0.1.0 --local --http-port 18080 --https-port 18443 --yes)
# A failed first start cleans up only the resources created by this transaction,
# so the next attempt can succeed without orphaned certificate volumes.
if FAIL_FIRST_START="$work/failed-first" bash deploy/install.sh "${install_args[@]}"; then
  echo 'Expected first-start failure' >&2; exit 1
fi
[[ ! -d $work/instance ]]
[[ -z $(docker volume ls -q --filter label=com.docker.compose.project=keepraw-fly) ]]
bash deploy/install.sh "${install_args[@]}"
bash deploy/install.sh --dir "$work/instance" --version v0.1.0 --yes
(cd "$work/instance" && sha256sum -c .keepraw-managed)
# A simulated future release has a different immutable reference; verify both
# explicit upgrade selection and return to the original version/reference.
bash deploy/install.sh --dir "$work/instance" --version v0.1.1 --yes
grep -q '^KEEPRAW_VERSION=v0.1.1$' "$work/instance/.env"
grep -q '0000000000000002$' "$work/instance/.env"
bash deploy/install.sh --dir "$work/instance" --version v0.1.0 --yes
grep -q '^KEEPRAW_VERSION=v0.1.0$' "$work/instance/.env"
grep -q '0000000000000001$' "$work/instance/.env"
cp "$work/instance/.env" "$work/before.env"
docker run -d --name "$project-port-conflict" -p 127.0.0.1:18085:80 keepraw-fly:deployment-test >/dev/null
if bash deploy/install.sh "${install_args[@]}" --http-port 18085; then echo 'Expected port-conflict refusal' >&2; exit 1; fi
docker rm -f "$project-port-conflict" >/dev/null
# A startup failure must restore the previous configuration and service.
if FAIL_UP_ONCE="$work/failed-once" bash deploy/install.sh "${install_args[@]}" --http-port 18082; then
  echo 'Expected simulated startup failure' >&2; exit 1
fi
cmp "$work/before.env" "$work/instance/.env"
"$real_curl" -fsS --noproxy '*' http://127.0.0.1:18080/release.json >/dev/null
# Corruption and manual edits must fail before changing a running instance.
printf '\n# corrupt\n' >> "$work/fixture/compose.yaml"
if bash deploy/install.sh "${install_args[@]}"; then echo 'Expected checksum failure' >&2; exit 1; fi
cmp "$work/before.env" "$work/instance/.env"
printf '\n# manual change\n' >> "$work/instance/.env"
if bash deploy/install.sh "${install_args[@]}"; then echo 'Expected managed-edit refusal' >&2; exit 1; fi
cp "$work/before.env" "$work/instance/.env"
mkdir "$work/unmanaged"
if bash deploy/install.sh --dir "$work/unmanaged" --yes; then echo 'Expected unmanaged-dir refusal' >&2; exit 1; fi
if bash deploy/install.sh --version latest --yes; then echo 'Expected floating-version refusal' >&2; exit 1; fi
# A foreign installation must not take over the running Compose project.
if bash deploy/install.sh --dir "$work/foreign" --yes; then echo 'Expected project ownership refusal' >&2; exit 1; fi
echo 'PASS: identical archives/container, security headers/cache rules (root+subpath), no Node runtime, trusted local TLS, repeat install, explicit upgrade/rollback, startup recovery, port/corruption/edit/ownership/floating-version refusal.'
