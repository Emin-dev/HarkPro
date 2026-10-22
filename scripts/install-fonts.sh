#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="${HOME}/.fonts/harkpro-portfolio"
mkdir -p "$dest"
cp "$root"/assets/fonts/pdf/*.ttf "$dest"/
if command -v fc-cache >/dev/null 2>&1; then
  fc-cache -f "$dest" >/dev/null
fi
