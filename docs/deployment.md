# Deployment — v0.1.0

[简体中文](deployment.zh-CN.md) · [Release](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.1.0)

## Use online

Open **<https://fly.keepraw.com>**. No installation is needed. This is a **demo provided by the developer**; choose **Try demo** for fictional flights or create your own archive.

All flight records live in the current browser's **IndexedDB**. There are no server accounts or automatic cloud synchronization. Different domains, browsers and devices have separate data. Export JSON in **Settings → Data and backup** regularly and **before migration or upgrades**, then import it at the destination. A static deployment update does not intentionally erase flight archives. Updating a Docker container is neither a backup nor a migration of personal data. The VPS serves website files only.

Use HTTPS for a public instance. Browser storage and persistent-storage permissions depend on browser policy and secure context. `http://localhost` is suitable for local testing; public plain HTTP is not the recommended deployment.

## GitHub Pages: no build required

1. Fork [keepraw/Keepraw-Fly](https://github.com/keepraw/Keepraw-Fly).
2. In your fork's **Actions** tab, enable workflows using **I understand my workflows, go ahead and enable them** if shown.
3. In **Settings → Pages → Build and deployment → Source**, choose **GitHub Actions**. Allow your default branch in the `github-pages` environment if you have restricted deployment branches.
4. In **Actions → Deploy official release to Fork Pages → Run workflow**, select the default branch and keep `version` set to **v0.1.0**. Leave `custom_domain` empty for the normal project site.
5. After the workflow succeeds, open the address shown in the `github-pages` deployment (your GitHub username followed by `.github.io/Keepraw-Fly/`). Keep the trailing slash.

The workflow downloads the official prebuilt tar.gz and `SHA256SUMS`, verifies the archive and its internal file manifest, then deploys. It checks that the release author is `keepraw`. It does **not** install Node.js/pnpm, compile source or run E2E. The inherited official CI jobs are skipped in forks. Deployment is manual; a new upstream version is never selected automatically. To upgrade or roll back, rerun with the exact official stable version you choose.

**Fork source edits do not appear in this mode.** It always serves the official release. Developers who need modified code can build their fork following the developer section below and upload `apps/web/dist/` using a workflow they maintain. Enabling source builds requires deliberately restoring validation in the fork; it cannot affect official CI.

For a custom domain, configure its DNS and **Settings → Pages → Custom domain**, enable **Enforce HTTPS**, and enter the same hostname in the workflow's `custom_domain` input. Do not enter a scheme or path. No official `CNAME` is inherited. Vite's relative assets and hash routing support both a project subdirectory and domain root without rewrites. The official `fly.keepraw.com` setting is unchanged. The fork workflow refuses to run in the official repository; official main deployment still requires all CI checks.

## VPS: Docker and automatic HTTPS

Prerequisites: Linux **amd64 or arm64**, Bash, curl, sha256sum, `ss` (iproute2), realpath, flock, and Docker Engine with the **Compose v2 plugin supporting `up --wait`**. Install Docker following [Docker's official Linux instructions](https://docs.docker.com/engine/install/). The installer does not install packages or modify another website's Nginx/Caddy/Docker configuration. Use an account authorized to access Docker; permission to access Docker is effectively administrative access.

For public HTTPS, first point a domain's A record (and AAAA only if IPv6 really works) to the VPS, and allow inbound **TCP 80 and 443** in its firewall and provider security group. Caddy serves the app and obtains/renews certificates in one container. DNS and certificate issuance can take time.

Download the fixed release installer, verify it, inspect it, then run it. The commands do not execute a remote root script automatically:

```bash
mkdir -p keepraw-fly-installer
cd keepraw-fly-installer
curl -fL --proto '=https' --proto-redir '=https' -o install.sh https://github.com/keepraw/Keepraw-Fly/releases/download/v0.1.0/install.sh
curl -fL --proto '=https' --proto-redir '=https' -o SHA256SUMS https://github.com/keepraw/Keepraw-Fly/releases/download/v0.1.0/SHA256SUMS
awk '$2 == "./install.sh" || $2 == "install.sh" {print}' SHA256SUMS > installer.sha256
test "$(wc -l < installer.sha256)" -eq 1
sha256sum -c installer.sha256
less install.sh
read -r -p 'Your domain hostname: ' KEEPRAW_DOMAIN
sudo bash install.sh --version v0.1.0 --domain "$KEEPRAW_DOMAIN"
```

The installer shows its exact file/resource plan and asks before applying it; `--yes` accepts that plan for unattended use. It writes `/opt/keepraw-fly/compose.yaml`, `.env` and `.keepraw-managed`; creates only Compose project `keepraw-fly`, its web container/network and Caddy certificate/config volumes. No flight records are stored in these volumes. It downloads checksummed Compose and image digest attachments from the chosen release and pins the container to that digest. It checks architecture, Docker permissions, ports and directory ownership. It refuses unmanaged directories, overlapping project ownership, and edits to installer-managed files. Failed downloads/pulls leave the deployment unchanged; failed startup restores previous managed configuration. Saved configuration is retained under `history/`.

Open the printed **https://** address and check the browser's certificate indicator. Container health only confirms that Caddy is running; it does not establish that a public certificate has been issued. Check logs if HTTPS is not ready.

For local testing or an existing HTTPS reverse proxy, use loopback mode:

```bash
sudo bash install.sh --version v0.1.0 --local
```

This binds `127.0.0.1:8080` to HTTP and `127.0.0.1:8443` to the unused HTTPS mapping. Remote access requires an SSH tunnel or your existing proxy terminating HTTPS. The installer does not edit that proxy. `--http-port` and `--https-port` change host mappings; public ACME validation must still reach Caddy on public 80/443 (forwarding is your responsibility). Public mode binds IPv4 `0.0.0.0`; publish an AAAA record only after configuring and testing an IPv6 path.

### Verifying release provenance

Releases after v0.1.0 ship `attestation.sigstore.json` and
`image-attestation.sigstore.json`. The installer requires
[GitHub CLI](https://cli.github.com) **2.102.0 or newer** for them (older versions
match signer identities by prefix) and refuses to deploy unless every downloaded
file **and the image digest in `image.txt`** were attested by this repository's
`release.yml` on `main` from the release's source commit on a GitHub-hosted
runner. The image is checked with its own bundle: `gh` resolves
`oci://ghcr.io/keepraw/keepraw-fly@sha256:…` in the registry and requires that
exact digest to be the signed subject; `provenance.json` must name the same
image. The image is then pulled by that digest, never by a tag. No GitHub token
is needed. v0.1.0 predates attestations: its files and image are only
checksum-verified, and the installer says so. To check yourself:

```bash
gh attestation verify keepraw-fly-vX.Y.Z.tar.gz --bundle attestation.sigstore.json \
  --repo keepraw/Keepraw-Fly \
  --cert-identity https://github.com/keepraw/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main \
  --source-ref refs/heads/main --deny-self-hosted-runners
gh attestation verify oci://ghcr.io/keepraw/keepraw-fly@sha256:… \
  --bundle image-attestation.sigstore.json --repo keepraw/Keepraw-Fly \
  --cert-identity https://github.com/keepraw/Keepraw-Fly/.github/workflows/release.yml@refs/heads/main \
  --source-ref refs/heads/main --source-digest <commit from provenance.json> --deny-self-hosted-runners
```

### Manual Compose

You can download and inspect `compose.yaml`, `image.txt` and `SHA256SUMS` from the [release attachments](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.1.0) instead of using the installer. Verify the selected files with `sha256sum -c` as above. In the directory containing `compose.yaml`:

```bash
read -r -p 'Your domain hostname: ' KEEPRAW_DOMAIN
printf 'KEEPRAW_IMAGE=%s\nSITE_ADDRESS=%s\nBIND_ADDRESS=0.0.0.0\nHTTP_PORT=80\nHTTPS_PORT=443\n' "$(cat image.txt)" "$KEEPRAW_DOMAIN" > .env
docker compose -p keepraw-fly config -q
docker compose -p keepraw-fly up -d --wait
```

Without `.env`, the standard Compose file uses the explicit `ghcr.io/keepraw/keepraw-fly:v0.1.0` tag and loopback HTTP 8080. The installer uses the stronger digest pin from `image.txt`. There is no `latest` dependency. Manual Compose and installer-managed directories are separate modes; the installer will not take over an unmanaged directory.

### Maintenance, upgrade, rollback and uninstall

For the default installer directory, use the same authorized Docker user:

```bash
cd /opt/keepraw-fly
sudo docker compose -p keepraw-fly ps
sudo docker compose -p keepraw-fly logs -f --tail=100
sudo docker compose -p keepraw-fly stop
sudo docker compose -p keepraw-fly up -d --wait
sudo docker compose -p keepraw-fly down
```

Upgrade: export JSON, download and verify the installer from the **chosen release**, then execute it with `--version` set to that exact version and `--dir /opt/keepraw-fly`. Omit address flags to retain your hostname and ports. Repeating the v0.1.0 command is safe and recreates only that managed deployment as needed. Only v0.1.0 is provided by this release; select future versions after reviewing their notes and schema compatibility.

Rollback to this release: use this verified installer with `--version v0.1.0 --dir /opt/keepraw-fly`. A previous exact configuration is also retained in `history/`; restore **all three** files (`compose.yaml`, `.env`, `.keepraw-managed`) together before `docker compose -p keepraw-fly up -d --wait`. Back up current files before a manual restoration. Retain the same origin to retain browser data. Restoring older software does not guarantee compatibility with a future data schema; JSON export remains necessary.

Uninstall: run `docker compose -p keepraw-fly down` in the deployment directory. To also remove **only this project's** TLS/config volumes, use `down --volumes`. Once you have inspected the directory and retained any desired configuration, remove `/opt/keepraw-fly` yourself. Do not run Docker-wide prune commands. Uninstalling the server does not delete browser data; removing that data requires an explicit browser action.

## Downloadable static files

The [v0.1.0 release](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.1.0) provides `keepraw-fly-v0.1.0.zip`, `keepraw-fly-v0.1.0.tar.gz`, `SHA256SUMS`, `install.sh`, `compose.yaml`, `Caddyfile`, `image.txt`, bilingual deployment guides, release notes and `provenance.json`.

Verify the selected archive against `SHA256SUMS`, extract it and publish the directory containing `index.html` to any HTTPS static host. These archives contain **production website files**, with no build step. ZIP, tar.gz, official Pages and Docker share the same main CI build. `release.json` identifies the application version and commit; `FILES.sha256` identifies every bundled file. `provenance.json` links the successful CI run, image build and digest. Checksums detect corrupted/mismatched downloads; obtain them through the official HTTPS release page.

## Troubleshooting

- **Actions absent/disabled:** enable Actions in the fork, then select the workflow manually. **Pages 404:** select GitHub Actions as source, inspect the deployment job, use the published URL and trailing slash. A fresh Pages site may take a few minutes.
- **Wrong version or fork changes missing:** this mode uses the explicitly selected official release, never fork source. Check `/release.json` relative to your site path.
- **Port conflict:** inspect `sudo ss -ltnp`; use loopback plus your existing HTTPS proxy or select free host ports. The installer never stops another website.
- **Docker permission/Compose error:** check `docker info` and `docker compose version` using the same user. Install or configure these tools yourself; no automatic system installation runs.
- **GHCR denied or checksum failure:** check network access and the complete official release; retry the fixed version. Do not bypass checksum or TLS validation.
- **HTTPS unavailable:** check DNS A/AAAA, public TCP 80/443, security groups, clock and `docker compose logs`. Health status alone is insufficient. Do not repeatedly delete certificate volumes, which can trigger CA rate limits.
- **No records after changing URL:** browser storage is isolated by origin (scheme, host and port), browser profile and device. Return to the previous origin, export JSON and import at the destination. Two project paths on the same origin are not storage isolation boundaries; use a separate hostname if needed.
- **Map/font/resource failure:** check the network panel for blocked bundled assets, correct subpath and trailing slash. Chinese MiSans fonts use the existing fixed external CDN; failure falls back to system fonts. Browser extensions and storage policies can also affect operation.

## Developers and official publishing

Only developers need Node.js **20.19+** and pnpm **10.14.0** (official CI uses Node 24):

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm preview
```

Open <http://127.0.0.1:4173>. Static output is `apps/web/dist/`; directly opening `index.html` as a file is unsupported. Hash routing requires no rewrite rules or backend. See [testing](testing.md).

The official [CI](../.github/workflows/ci.yml) keeps documentation, formatting, CSS, type, unit, build, six full Chromium shards and Firefox/WebKit smoke checks. `verify` requires all validation results to succeed; failure, cancellation or skipping prevents official deployment. Only a successful main push deploys the Pages artifact from **that same run**. Fork-only jobs cannot deploy to the official site.

For maintainers, the release procedure is:

1. Merge the release PR normally and wait for **all main CI** (including Pages deployment) to succeed. Record its run ID and commit SHA. No protection bypasses.
2. Confirm neither tag nor release `v0.1.0` exists. Create a lightweight `v0.1.0` tag at that SHA and push it; never move an existing tag.
3. Run **Build verified release image** on main with that `ci_run_id`. It verifies the successful official main run and tag, downloads its existing production artifacts, and publishes linux/amd64 + linux/arm64. It never rebuilds the app or creates a Release using `GITHUB_TOKEN`. **Dispatch it while `main` is still at the CI commit:** the run's own `github.sha` (the tip of `main` at dispatch) is the source commit GitHub writes into every attestation, so the job refuses, before any push, signature or upload, unless the CI commit, `github.sha` and the tag commit are the same; after signing it verifies the new attestations against that commit. Releasing an older commit after `main` has moved is not supported. On first publication ensure the GHCR package is **public** (package settings); anonymous pull must work.
4. With `gh` authenticated as **keepraw**, execute `bash scripts/publish-release.sh CI_RUN_ID IMAGE_RUN_ID --publish`, substituting the two actual run IDs. This verifies source, checksums and public image platforms; creates a draft; verifies the actual `author.login`; uploads and downloads every attachment for comparison; and finally publishes. A mismatched author leaves the draft unpublished. If permissions are unavailable, the owner runs this single final command after the artifacts are prepared.

Application package versions are `0.1.0`; tag is `v0.1.0`. The archive Schema version is managed independently in `packages/schema` and is unchanged by this deployment work. OCI metadata names `keepraw`; commit authors and third-party copyright notices are not rewritten. Existing [third-party notices](../THIRD_PARTY_NOTICES.md) and [license review](license-review-2026-10-10.md) remain applicable.

If the owner's CLI can create a draft but cannot upload attachments, **Build verified release image** also has an attachment-only mode: supply the existing `keepraw` draft's numeric `release_id`, the original `image_run_id` and `ci_run_id`. It validates the author, tag, commit and provenance, uploads the original artifacts to an empty draft, and downloads them for comparison. It never creates or publishes a Release and never replaces an existing attachment. The owner verifies and publishes the completed draft afterward.
