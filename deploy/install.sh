#!/usr/bin/env bash
# Keepraw-Fly installer. Downloads only an explicitly selected official release.
set -Eeuo pipefail
umask 077
version=v0.1.1
directory=/opt/keepraw-fly
domain=
mode=
http_port=
https_port=
yes=false
stage=
backup=
applying=false
existed=false
die() { echo "Error: $*" >&2; exit 1; }
usage() {
  cat <<'HELP'
Keepraw-Fly: Bash, Linux amd64/arm64, curl, sha256sum, ss, Docker + Compose v2,
and GitHub CLI >= 2.102.0 for releases after v0.1.0 (provenance verification).
Usage: bash install.sh [--version v0.1.1] [--dir /opt/keepraw-fly]
                       [--domain YOUR_DOMAIN | --local]
                       [--http-port PORT] [--https-port PORT] [--yes]
--domain enables automatic public HTTPS; DNS must point to this VPS.
--local binds only 127.0.0.1 (HTTP 8080, HTTPS mapping 8443 by default).
Re-run without address flags to preserve the current address and ports.
No system packages or other web-server configurations are changed.
HELP
}
while (($#)); do
  case "$1" in
    --version|--dir|--domain|--http-port|--https-port)
      (($# >= 2)) || die "Missing value for $1"
      case "$1" in
        --version) version=$2 ;;
        --dir) directory=$2 ;;
        --domain) domain=$2; mode=domain ;;
        --http-port) http_port=$2 ;;
        --https-port) https_port=$2 ;;
      esac
      shift 2 ;;
    --local) mode=local; shift ;;
    --yes) yes=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) die "Unknown option: $1 (see --help)" ;;
  esac
done
[[ $version =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "Use an explicit stable version, e.g. v0.1.1"
[[ $(uname -s) == Linux ]] || die "Linux is required"
case "$(uname -m)" in x86_64|aarch64|arm64) ;; *) die "Supported architectures: amd64 and arm64" ;; esac
for command in curl sha256sum ss docker realpath flock; do
  command -v "$command" >/dev/null || die "Missing $command. Install it using your distribution's instructions, then retry."
done
docker info >/dev/null 2>&1 || die "Docker daemon unavailable or permission denied. Check 'docker info'; use an authorized Docker user."
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 plugin is required"
docker compose up --help | grep -- '--wait' >/dev/null || die "Upgrade Compose: 'up --wait' is required"
[[ $directory == /* && $directory != / && $directory != *[$'\n\r\t ']* ]] || die "--dir must be an absolute path without whitespace"
[[ ! -L $directory ]] || die "Deployment directory must not be a symlink"
directory=$(realpath -m "$directory")
parent=$(dirname "$directory")
[[ -d $parent && -w $parent ]] || die "Need write permission to $parent; create it first or run with the appropriate privileges"
exec 9<"$parent"
flock -n 9 || die "Another installer is running in $parent"
compose() { docker compose --project-name keepraw-fly --project-directory "$directory" -f "$directory/compose.yaml" "$@"; }
get_env() { sed -n "s/^$1=//p" "$directory/.env"; }
if [[ -d $directory ]]; then
  [[ -f $directory/.keepraw-managed ]] || die "Existing directory is not installer-managed; choose an empty path"
  (cd "$directory" && sha256sum -c .keepraw-managed >/dev/null) || die "Managed files were edited. Back them up and restore their recorded versions before using the installer, or manage Compose manually."
  existed=true
fi
for container in $(docker ps -aq --filter label=com.docker.compose.project=keepraw-fly); do
  owner=$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$container")
  [[ $existed == true && $owner == "$directory" ]] || die "Docker project keepraw-fly already belongs to $owner; use that deployment directory"
done
if [[ $existed != true ]]; then
  existing_volumes=$(docker volume ls -q --filter label=com.docker.compose.project=keepraw-fly)
  existing_networks=$(docker network ls -q --filter label=com.docker.compose.project=keepraw-fly)
  [[ -z $existing_volumes && -z $existing_networks ]] || die "Docker project keepraw-fly has existing volumes/networks. Reuse its original managed directory or inspect/remove only those resources first."
fi
if [[ -z $mode && $existed == true ]]; then
  site=$(get_env SITE_ADDRESS)
  bind=$(get_env BIND_ADDRESS)
  http_port=${http_port:-$(get_env HTTP_PORT)}
  https_port=${https_port:-$(get_env HTTPS_PORT)}
  if [[ $site == :80 ]]; then mode=local; else mode=domain; domain=$site; fi
else
  mode=${mode:-local}
fi
if [[ $mode == domain ]]; then
  [[ ${#domain} -le 253 && $domain =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$ ]] || die "--domain requires a DNS hostname only (no scheme, path, port or wildcard)"
  site=$domain; bind=0.0.0.0
  http_port=${http_port:-80}; https_port=${https_port:-443}
else
  site=:80; bind=127.0.0.1
  http_port=${http_port:-8080}; https_port=${https_port:-8443}
fi
for port in "$http_port" "$https_port"; do
  [[ $port =~ ^[1-9][0-9]{0,4}$ ]] && ((port <= 65535)) || die "Invalid port: $port"
done
[[ $http_port != "$https_port" ]] || die "HTTP and HTTPS ports must differ"
own_ports=
if [[ $existed == true ]]; then
  own_id=$(compose ps -q web)
  if [[ -n $own_id ]]; then own_ports=$(docker port "$own_id"); fi
fi
for port in "$http_port" "$https_port"; do
  if [[ -n $(ss -H -ltn "sport = :$port") ]] && ! grep -qE ":$port$" <<< "$own_ports"; then
    die "TCP port $port is occupied. Inspect 'ss -ltnp'; choose another port or use your existing reverse proxy."
  fi
done
stage=$(mktemp -d "$parent/.keepraw-download.XXXXXX")
cleanup() {
  result=$?
  trap - EXIT
  if [[ $applying == true && $result != 0 ]]; then
    echo "Installation failed. Restoring previous configuration." >&2
    if [[ $existed == true ]]; then
      cp "$backup/compose.yaml" "$backup/.env" "$backup/.keepraw-managed" "$directory/"
      compose up -d --wait --wait-timeout 90 || echo "Recovery failed; inspect $backup and 'docker compose logs'." >&2
    else
      # Preflight established that this is a new project with no prior resources.
      compose down --volumes || true
      rm -f "$directory/compose.yaml" "$directory/.env" "$directory/.keepraw-managed"
      rmdir "$directory" 2>/dev/null || true
    fi
  fi
  [[ -z $stage ]] || rm -rf "$stage"
  exit "$result"
}
trap cleanup EXIT
base="https://github.com/keepraw/Keepraw-Fly/releases/download/$version"
fetch() {
  curl --fail --show-error --silent --location --retry 3 --proto '=https' --proto-redir '=https' \
    "$base/$1" -o "$stage/$1" || die "Cannot download $1 for $version. Confirm the official release exists and is complete."
}
# Releases published before provenance attestations existed. Their files are
# only checked against SHA256SUMS from the same release (integrity, not
# authenticity). Never add a release here that was published with attestations.
legacy_unattested=" v0.1.0 "
if [[ $legacy_unattested == *" $version "* ]]; then
  attested=false
  verified_files=(compose.yaml image.txt)
else
  attested=true
  verified_files=(compose.yaml image.txt provenance.json)
fi
for file in SHA256SUMS "${verified_files[@]}"; do fetch "$file"; done
for file in "${verified_files[@]}"; do
  line=$(awk -v name="$file" '$2 == name || $2 == "./" name { print }' "$stage/SHA256SUMS")
  [[ $(wc -l <<< "$line") == 1 && $line =~ ^[0-9a-f]{64}[[:space:]] ]] || die "Missing/invalid checksum for $file"
  (cd "$stage" && sha256sum -c <<< "$line") || die "Checksum mismatch: $file"
done
if [[ $attested == true ]]; then
  # Authenticity: GitHub Artifact Attestations signed by the official release
  # workflow on main, from the release's source commit, on a hosted runner.
  # gh < 2.102.0 matched signer identities by prefix (GHSA-wjmr-j3rp-mh2g).
  gh_minimum=2.102.0
  command -v gh >/dev/null || die "GitHub CLI (gh) >= $gh_minimum is required to verify $version provenance. Install it from https://cli.github.com, then retry."
  gh_version=$(gh --version | sed -n 's/^gh version \([0-9][0-9.]*\).*/\1/p' | head -n1)
  [[ -n $gh_version && $(printf '%s\n%s\n' "$gh_minimum" "$gh_version" | sort -V | head -n1) == "$gh_minimum" ]] \
    || die "GitHub CLI ${gh_version:-unknown} is too old; provenance verification requires >= $gh_minimum"
  fetch attestation.sigstore.json
  fetch image-attestation.sigstore.json
  revision=$(sed -n 's/^ *"revision": "\([0-9a-f]\{40\}\)",\{0,1\}$/\1/p' "$stage/provenance.json")
  [[ $revision =~ ^[0-9a-f]{40}$ ]] || die "provenance.json has no source revision"
  grep -qx "  \"version\": \"${version#v}\"," "$stage/provenance.json" || die "provenance.json does not describe $version"
  release_identity=https://github.com/keepraw/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main
  verify_provenance() { # subject bundle label
    gh attestation verify "$1" --bundle "$2" \
      --repo keepraw/Keepraw-Fly --cert-identity "$release_identity" \
      --source-ref refs/heads/main --source-digest "$revision" --deny-self-hosted-runners >/dev/null \
      || die "Provenance verification failed for $3 ($version). Refusing to deploy: it is not an official keepraw/Keepraw-Fly release build."
  }
  for file in "${verified_files[@]}"; do
    verify_provenance "$stage/$file" "$stage/attestation.sigstore.json" "$file"
  done
fi
image=$(cat "$stage/image.txt")
[[ $image =~ ^ghcr.io/keepraw/keepraw-fly@sha256:[0-9a-f]{64}$ ]] || die "Invalid official image digest"
if [[ $attested == true ]]; then
  grep -qx "  \"image\": \"$image\",\{0,1\}" "$stage/provenance.json" \
    || die "provenance.json names a different image than image.txt ($image)"
  # The image's own attestation (pushed by release.yml for this exact digest):
  # gh resolves oci://...@sha256 from the registry and checks that the signed
  # subject is that digest, signed by release.yml on main from $revision.
  verify_provenance "oci://$image" "$stage/image-attestation.sigstore.json" "image $image"
  echo "Verified provenance: $version files and image built by keepraw/Keepraw-Fly release.yml from $revision"
else
  echo "Warning: $version predates release provenance attestations; only SHA-256 checksums published in the same release are verified. Neither its files nor its image carry provenance." >&2
fi
cat > "$stage/.env" <<ENV
KEEPRAW_VERSION=$version
KEEPRAW_IMAGE=$image
SITE_ADDRESS=$site
BIND_ADDRESS=$bind
HTTP_PORT=$http_port
HTTPS_PORT=$https_port
ENV
docker compose --project-name keepraw-fly --env-file "$stage/.env" -f "$stage/compose.yaml" config -q
cat <<INFO
Keepraw-Fly $version ($image)
Will write: $directory/compose.yaml, .env, .keepraw-managed
Will manage ONLY Docker project keepraw-fly: web container, default network,
caddy_data and caddy_config volumes (TLS certificates, not flight records).
Existing managed configuration is saved under $directory/history before changes.
Address: $site; bind $bind; TCP $http_port -> 80, $https_port -> 443.
Other web servers and Docker projects are not edited. No system packages installed.
INFO
if [[ $yes != true ]]; then
  read -r -p 'Continue? [y/N] ' answer || die "No answer. Inspect the plan, then use --yes for unattended installation."
  [[ $answer == y || $answer == Y ]] || die "Cancelled before changing the deployment"
fi
docker pull "$image" || die "Cannot pull the public image. Check GHCR access, network and architecture. Configuration is unchanged."
if [[ $existed == true ]]; then
  backup="$directory/history/$(date -u +%Y%m%dT%H%M%SZ)-$$"
  mkdir -p "$backup"
  cp "$directory/compose.yaml" "$directory/.env" "$directory/.keepraw-managed" "$backup/"
else
  mkdir -m 0755 "$directory"
fi
applying=true
cp "$stage/compose.yaml" "$stage/.env" "$directory/"
(cd "$directory" && sha256sum compose.yaml .env > .keepraw-managed)
chmod 0644 "$directory/compose.yaml" "$directory/.keepraw-managed"
compose up -d --wait --wait-timeout 90
applying=false
if [[ $mode == domain ]]; then
  address="https://$domain"
  [[ $https_port == 443 ]] || address="$address:$https_port"
  echo "Caddy obtains HTTPS certificates after DNS and public TCP 80/443 reach this VPS."
  echo "Container health confirms the server, not successful public certificate issuance. Check HTTPS and logs."
else
  address="http://localhost:$http_port"
  echo "Loopback-only mode. Use an SSH tunnel or your existing HTTPS reverse proxy for remote access."
fi
cat <<INFO
Ready: $address
Version: $version
Image: $image
Maintenance (use the same authorized Docker user):
  cd $directory
  docker compose -p keepraw-fly logs -f --tail=100
  docker compose -p keepraw-fly stop
  docker compose -p keepraw-fly up -d --wait
  docker compose -p keepraw-fly down
Upgrade/rollback: rerun the verified installer with --version and --dir $directory.
Export JSON in the browser before upgrades/migration. The VPS has no flight archive.
INFO
