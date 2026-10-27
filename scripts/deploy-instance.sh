#!/usr/bin/env bash
#
# Redeploy an instance created by scripts/provision-cf.sh with the SAME shape it
# was provisioned with: its rendered config (.instances/<slug>.wrangler.jsonc)
# and its build-time mount + cookie prefix (.instances/<slug>.env). Runs the
# normal `npm run deploy` (remote migrations, build, deploy) with that config
# swapped in, and restores the committed wrangler.jsonc on exit.
#
#   Usage:  scripts/deploy-instance.sh <slug>
#
# ⚠  Applies migrations to and deploys the REAL instance.
set -euo pipefail

SLUG="${1:-}"
[[ "$SLUG" =~ ^[a-z][a-z0-9-]{1,40}$ ]] || { echo "usage: scripts/deploy-instance.sh <slug>" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CONFIG=".instances/${SLUG}.wrangler.jsonc"
META=".instances/${SLUG}.env"
[[ -f "$CONFIG" && -f "$META" ]] || { echo "✗ $CONFIG or $META missing — was '$SLUG' provisioned from this checkout?" >&2; exit 1; }

restore() { [ -f wrangler.jsonc.bak ] && mv -f wrangler.jsonc.bak wrangler.jsonc || true; }
trap restore EXIT
cp wrangler.jsonc wrangler.jsonc.bak
cp "$CONFIG" wrangler.jsonc

MINSHOP_MOUNT_PATH="$(sed -n 's/^MINSHOP_MOUNT_PATH=//p' "$META" | head -1)"
MINSHOP_COOKIE_PREFIX="$(sed -n 's/^MINSHOP_COOKIE_PREFIX=//p' "$META" | head -1)"
export MINSHOP_MOUNT_PATH="${MINSHOP_MOUNT_PATH:-/}" MINSHOP_COOKIE_PREFIX
# Optional per instance: the theme and, for the site-shell theme, the website's
# shell (docs/SITE_SHELL.md). The environment wins over the file.
FILE_THEME="$(sed -n 's/^THEME=//p' "$META" | head -1)"
FILE_SHELL="$(sed -n 's/^SITE_SHELL=//p' "$META" | head -1)"
[[ -n "${THEME:-$FILE_THEME}" ]] && export THEME="${THEME:-$FILE_THEME}"
[[ -n "${SITE_SHELL:-$FILE_SHELL}" ]] && export SITE_SHELL="${SITE_SHELL:-$FILE_SHELL}"
if [[ "${THEME:-}" == "site-shell" && -z "${SITE_SHELL:-}" ]]; then
  echo "✗ THEME=site-shell needs SITE_SHELL (path or URL of the website's shell.json)" >&2; exit 1
fi
echo "▸ Deploying '$SLUG' (mount=$MINSHOP_MOUNT_PATH cookiePrefix=$MINSHOP_COOKIE_PREFIX theme=${THEME:-config})…"
npm run deploy
