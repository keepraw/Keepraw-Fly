#!/usr/bin/env bash
set -euo pipefail

# The 2026-10-22 runner logs show multi-minute stalls at the Azure HTTP
# Ubuntu archive, before browser downloads. Use Ubuntu's official HTTPS
# archive with the existing suites, components and signed-by key unchanged.
# Do not cache installed system libraries or substitute third-party mirrors.
for source in /etc/apt/sources.list /etc/apt/sources.list.d/*.sources /etc/apt/sources.list.d/*.list; do
  [ -f "$source" ] || continue
  if grep -q 'http://azure.archive.ubuntu.com/ubuntu' "$source"; then
    sudo sed -i 's|http://azure.archive.ubuntu.com/ubuntu|https://archive.ubuntu.com/ubuntu|g' "$source"
  fi
done
