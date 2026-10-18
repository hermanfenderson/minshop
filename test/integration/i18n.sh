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
# An order from before languages: no stored locale, addressed by its legacy id.
legacy_order="ab$(printf 'cd%.0s' {1..15})"
npx wrangler d1 execute DB --local --persist-to "$state_dir" \
  --command "INSERT INTO orders (public_id, email, amount_total_cents, currency, status) VALUES ('$legacy_order', 'legacy@example.com', 1500, 'eur', 'paid')" >/dev/null

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

# Translated content, created and translated from the admin. The admin password
# is generated for this throwaway store and never leaves it.
admin_password="$(node -e 'console.log(require("node:crypto").randomBytes(16).toString("hex"))')"
if ! node test/integration/i18n-content-checks.mjs "http://127.0.0.1:$test_port" "$mount" "$cookie_prefix" "$admin_password"; then
  echo "--- worker log (tail)" >&2
  tail -n 60 "$worker_log" >&2
  exit 1
fi

# The language each purchase was made in is stored on the order (0040) — what
# the outbox, the webhooks and the cron later read — while the fixture orders,
# which predate it, keep a NULL that reads as English.
d1() {
  npx wrangler d1 execute DB --local --persist-to "$state_dir" --json --command "$1" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s)[0].results.map(r=>Object.values(r).join("|")).join(",")))'
}
order_locales="$(d1 "SELECT email, locale FROM orders WHERE email LIKE 'buyer-%@example.com' ORDER BY email")"
if [[ "$order_locales" != "buyer-en@example.com|en,buyer-it@example.com|it" ]]; then
  echo "i18n integration: unexpected order languages: $order_locales" >&2
  exit 1
fi
# Agent checkouts still awaiting payment: the body's language when enabled,
# else the request's (English) — never an unvalidated value.
pending_locales="$(d1 "SELECT email, locale FROM pending_payments WHERE email LIKE 'agent-%@example.com' ORDER BY email")"
if [[ "$pending_locales" != "agent-de@example.com|en,agent-it@example.com|it,agent-xx@example.com|en" ]]; then
  echo "i18n integration: unexpected pending payment languages: $pending_locales" >&2
  exit 1
fi
legacy_locales="$(d1 "SELECT COUNT(*) FROM orders WHERE email = 'legacy@example.com' AND locale IS NOT NULL")"
if [[ "$legacy_locales" != "0" ]]; then
  echo "i18n integration: earlier orders gained a language: $legacy_locales" >&2
  exit 1
fi
legacy_status="$(curl --silent --output /dev/null --write-out '%{http_code}' "http://127.0.0.1:$test_port$mount/order/$legacy_order")"
if [[ "$legacy_status" != "200" ]]; then
  echo "i18n integration: the earlier order page answered $legacy_status" >&2
  exit 1
fi
echo "  ✓ each order stores the language it was bought in; earlier orders untouched"

# The Italian purchase kept the Italian name; the source row and its price are
# untouched by every translation save; no translation outlives its entity.
content_order="$(d1 "SELECT oi.name FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.email = 'content-it@example.com'")"
if [[ "$content_order" != "Tracolla Monopolele" ]]; then
  echo "i18n integration: the Italian order kept the wrong name: $content_order" >&2
  exit 1
fi
source_row="$(d1 "SELECT name, price_cents, slug FROM products WHERE slug = 'festival-strap'")"
if [[ "$source_row" != "Festival strap|2400|festival-strap" ]]; then
  echo "i18n integration: a translation changed the product row: $source_row" >&2
  exit 1
fi
orphans="$(d1 "SELECT (SELECT COUNT(*) FROM product_translations WHERE product_id NOT IN (SELECT id FROM products)) + (SELECT COUNT(*) FROM category_translations WHERE category_id NOT IN (SELECT id FROM categories)) + (SELECT COUNT(*) FROM page_translations WHERE page_id NOT IN (SELECT id FROM pages)) + (SELECT COUNT(*) FROM menu_item_translations WHERE menu_item_id NOT IN (SELECT id FROM menu_items))")"
if [[ "$orphans" != "0" ]]; then
  echo "i18n integration: translations outlived their entity: $orphans" >&2
  exit 1
fi
echo "  ✓ the order keeps the name bought in; translations never touch the product row; none are orphaned"
