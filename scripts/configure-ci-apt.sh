#!/usr/bin/env bash
# GitHub Ubuntu runners use a mirror list that prefers Azure's HTTP mirror.
# Stalled index/package transfers can consume the entire browser job budget.
# Run as root in CI; an alternate APT directory supports isolated validation.
set -euo pipefail
apt_directory=${1:-/etc/apt}

if [[ -f "$apt_directory/apt-mirrors.txt" ]]; then
  printf '%s\n' 'https://archive.ubuntu.com/ubuntu/' > "$apt_directory/apt-mirrors.txt"
fi
if [[ -f "$apt_directory/apt-mirrors-security.txt" ]]; then
  printf '%s\n' 'https://security.ubuntu.com/ubuntu/' > "$apt_directory/apt-mirrors-security.txt"
fi

mkdir -p "$apt_directory/apt.conf.d"
cat > "$apt_directory/apt.conf.d/80keepraw-ci-network" <<'APT'
Acquire::Retries "2";
Acquire::http::Timeout "20";
Acquire::https::Timeout "20";
Acquire::Languages "none";
APT::Update::Error-Mode "any";
APT
printf '%s\n' 'Configured HTTPS Ubuntu mirrors and bounded APT downloads for browser setup.'
