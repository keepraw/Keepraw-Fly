#!/usr/bin/env bash
# Package the production build once; no second Vite build in the release workflow.
set -euo pipefail
cd "$(dirname "$0")/.."
output="${1:-artifacts/release}"
# RELEASE_TAG (optional) must match the single package.json version source.
tag="$(bash scripts/release-version.sh ${RELEASE_TAG:+"$RELEASE_TAG"})"
revision="$(git rev-parse HEAD)"
export SOURCE_DATE_EPOCH="$(git show -s --format=%ct HEAD)"
python3 - "$output" "$revision" "$tag" <<'PY'
import hashlib, json, os, pathlib, shutil, sys, time, zipfile
out = pathlib.Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
version = json.loads(pathlib.Path('package.json').read_text())['version']
assert version == json.loads(pathlib.Path('apps/web/package.json').read_text())['version']
assert sys.argv[3] == f'v{version}', 'release tag/version mismatch'
site = pathlib.Path('apps/web/dist')
assert (site / 'index.html').is_file()
metadata = {'version': version, 'revision': sys.argv[2], 'author': 'keepraw',
            'source': 'https://github.com/keepraw/Keepraw-Fly'}
(site / 'release.json').write_text(json.dumps(metadata, indent=2) + '\n')
(site / 'FILES.sha256').unlink(missing_ok=True)
files = sorted(p for p in site.rglob('*') if p.is_file())
(site / 'FILES.sha256').write_text(''.join(
    f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(site)}\n' for p in files))
with zipfile.ZipFile(out / f'keepraw-fly-v{version}.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for p in sorted(p for p in site.rglob('*') if p.is_file()):
        info = zipfile.ZipInfo(str(p.relative_to(site)), time.gmtime(int(os.environ['SOURCE_DATE_EPOCH']))[:6])
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        z.writestr(info, p.read_bytes())
for src, name in [('deploy/install.sh', 'install.sh'), ('compose.yaml', 'compose.yaml'),
                  ('deploy/Caddyfile', 'Caddyfile'), ('docs/deployment.md', 'deployment.md'),
                  ('docs/deployment.zh-CN.md', 'deployment.zh-CN.md'),
                  (f'docs/releases/v{version}.md', 'RELEASE_NOTES.md')]:
    shutil.copyfile(src, out / name)
(out / 'provenance.json').write_text(json.dumps(metadata, indent=2) + '\n')
PY
tar --sort=name --mtime="@$SOURCE_DATE_EPOCH" --owner=0 --group=0 --numeric-owner \
  -C apps/web/dist -cf - . | gzip -n > "$output/keepraw-fly-$tag.tar.gz"
(cd "$output" && find . -maxdepth 1 -type f ! -name 'SHA256SUMS*' -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
