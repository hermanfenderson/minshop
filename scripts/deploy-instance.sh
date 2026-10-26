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
echo "▸ Deploying '$SLUG' (mount=$MINSHOP_MOUNT_PATH cookiePrefix=$MINSHOP_COOKIE_PREFIX)…"
npm run deploy
