#!/usr/bin/env bash
set -euo pipefail

# Two-language integration gate. Boots the BUILT Worker against an isolated,
# seeded D1 with English and Italian enabled, then drives both languages over
# HTTP (test/integration/i18n-checks.mjs).
#
# Runs on whatever mount the build used: `npm run verify` builds the default
# root mount; `npm run test:i18n-mount` rebuilds with /shop and the minshop_
# cookie prefix (the Monopolele shape) and runs the same checks.

mount="${I18N_TEST_MOUNT:-}"
cookie_prefix="${I18N_TEST_COOKIE_PREFIX:-}"
state_dir="$(mktemp -d "${TMPDIR:-/tmp}/minshop-i18n.XXXXXX")"
worker_log="$state_dir/worker.log"
worker_pid=""
test_port="${I18N_TEST_PORT:-8793}"

cleanup() {
  if [[ -n "$worker_pid" ]] && kill -0 "$worker_pid" 2>/dev/null; then
    kill "$worker_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
  fi
  rm -rf "$state_dir"
}
trap cleanup EXIT INT TERM

if [[ ! -f dist/server/wrangler.json ]]; then
  echo "i18n integration: run 'npm run build' first" >&2
  exit 1
fi

npx wrangler d1 migrations apply DB --local --persist-to "$state_dir" >/dev/null
npx wrangler d1 execute DB --local --persist-to "$state_dir" --file ./seed.sql >/dev/null
npx wrangler d1 execute DB --local --persist-to "$state_dir" \
  --file ./test/fixtures/storefront-states.sql >/dev/null
npx wrangler d1 execute DB --local --persist-to "$state_dir" \
  --command "INSERT INTO settings (key, value) VALUES ('i18n_enabled_locales', 'en,it') ON CONFLICT(key) DO UPDATE SET value = excluded.value" >/dev/null

npx wrangler dev \
  --config dist/server/wrangler.json \
  --persist-to "$state_dir" \
  --var CANONICAL_ORIGIN:https://canonical.example \
  --var AUTH_SECRET:integration-auth-secret \
  --ip 127.0.0.1 \
  --port "$test_port" >"$worker_log" 2>&1 &
worker_pid="$!"

ready=""
for _ in {1..40}; do
  if curl --max-time 30 --fail --silent --show-error "http://127.0.0.1:$test_port$mount/api/products?limit=1" >/dev/null 2>&1; then
    ready="yes"
    break
  fi
  if ! kill -0 "$worker_pid" 2>/dev/null; then
    sed -n '1,160p' "$worker_log" >&2
    exit 1
  fi
  sleep 0.25
done

if [[ -z "$ready" ]]; then
  sed -n '1,160p' "$worker_log" >&2
  echo "i18n integration: Worker did not become ready" >&2
  exit 1
fi

if ! node test/integration/i18n-checks.mjs "http://127.0.0.1:$test_port" "$mount" "$cookie_prefix"; then
  echo "--- worker log (tail)" >&2
  tail -n 60 "$worker_log" >&2
  exit 1
fi
