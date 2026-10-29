#!/usr/bin/env bash
#
# Provision + deploy a FRESH, fully-independent minshop instance:
#   its own D1 database, public-image and private-file R2 buckets, Worker, and
#   secrets (AUTH_SECRET + SECRETS_KEK).
#   FREE-PLAN default — optional integrations (Vectorize/AI, Images, send_email) are
#   opt-in via wrangler.template.jsonc (see the comments there).
#
#   Usage:  scripts/provision-cf.sh <slug>
#   <slug>: lowercase letters/digits/hyphens, e.g. "acme-store".
#
#   Optional instance settings, read from the environment and recorded in
#   .instances/<slug>.env so scripts/deploy-instance.sh redeploys the same shape:
#     MINSHOP_MOUNT_PATH, MINSHOP_COOKIE_PREFIX  build-time mount and cookie prefix
#     MINSHOP_NOINDEX=1                          test/staging instance: NOINDEX var
#     THEME, SITE_SHELL                          theme and, for the site-shell themes, the shell
#   Other options:
#     MINSHOP_R2_LOCATION=eeur                   location hint for the two buckets
#     MINSHOP_DEFER_DEPLOY=1                     stop after the migrations: no build, no Worker,
#                                                no secrets. Populate D1 first (for example with
#                                                scripts/copy-content.mjs), then the first deploy:
#                                                MINSHOP_SECRETS_FILE=<file> scripts/deploy-instance.sh <slug>
#                                                The setup wizard is never reachable that way.
#
# Deploys via the SAME path as `npm run deploy` (the Astro adapter integrates with
# ./wrangler.jsonc), so we temporarily swap in the instance config and restore the
# original on exit — even if the script fails partway.
#
# ⚠  Creates REAL Cloudflare resources on your account and may incur usage. Review
#    before running. Requires: wrangler (logged in: `npx wrangler login`), openssl.
set -euo pipefail

SLUG="${1:-}"
if [[ ! "$SLUG" =~ ^[a-z][a-z0-9-]{1,40}$ ]]; then
  echo "usage: scripts/provision-cf.sh <slug>   (lowercase a-z, 0-9, '-')" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
W="npx --yes wrangler"
DB_NAME="${SLUG}-db"
BUCKET="${SLUG}-images"
FILES_BUCKET="${SLUG}-files"
META=".instances/${SLUG}.env"
mkdir -p .instances

# Restore the canonical wrangler.jsonc no matter how we exit.
restore() { [ -f wrangler.jsonc.bak ] && mv -f wrangler.jsonc.bak wrangler.jsonc || true; }
trap restore EXIT

# Before creating ANY remote resource: the theme selection must resolve.
# Read-only — a broken theme.config.json used to surface only after the
# database and bucket already existed on the account.
echo "▸ [0/5] Validating theme selection…"
node --input-type=module -e "
  import { resolveTheme } from './scripts/themes.mjs';
  const s = resolveTheme();
  console.log('    theme: ' + s.id + ' (from ' + s.source + ')');
"

echo "▸ [1/5] Creating D1 database '$DB_NAME'…"
DB_OUT="$($W d1 create "$DB_NAME")"
DB_ID="$(printf '%s' "$DB_OUT" | grep -oiE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)"
[ -n "$DB_ID" ] || { echo "✗ could not parse database_id from output:"; echo "$DB_OUT"; exit 1; }
echo "    database_id=$DB_ID"

echo "▸ [2/5] Creating R2 bucket '$BUCKET'…"
LOCATION=(); [ -n "${MINSHOP_R2_LOCATION:-}" ] && LOCATION=(--location "$MINSHOP_R2_LOCATION")
$W r2 bucket create "$BUCKET" ${LOCATION[@]+"${LOCATION[@]}"}
echo "    Creating private digital-file bucket '$FILES_BUCKET'…"
$W r2 bucket create "$FILES_BUCKET" ${LOCATION[@]+"${LOCATION[@]}"}
echo "    Keep this bucket private: do not enable r2.dev or attach a custom domain."

# FREE-PLAN DEFAULT: D1 + R2 only. Semantic search (Workers AI + Vectorize) is
# opt-in: create the index and add its bindings to wrangler.template.jsonc (see
# the comments there), then re-run/redeploy.

echo "▸ [3/5] Rendering instance config → wrangler.jsonc (original backed up)…"
# wrangler.jsonc is committed (placeholder config), so it normally exists; guard the
# backup anyway so a fresh clone that deleted it doesn't abort under `set -e`.
[ -f wrangler.jsonc ] && cp wrangler.jsonc wrangler.jsonc.bak
sed -e "s/__NAME__/$SLUG/g" \
    -e "s/__DB_NAME__/$DB_NAME/g" \
    -e "s/__DB_ID__/$DB_ID/g" \
    -e "s/__BUCKET__/$BUCKET/g" \
    -e "s/__FILES_BUCKET__/$FILES_BUCKET/g" \
    wrangler.template.jsonc > wrangler.jsonc
if [[ "${MINSHOP_NOINDEX:-}" =~ ^(1|true|yes|on)$ ]]; then
  perl -0pi -e 's/("STORE_NAME": "My Shop",\n)/$1    "NOINDEX": "true",\n/' wrangler.jsonc
  grep -q '"NOINDEX": "true"' wrangler.jsonc || { echo "✗ could not add NOINDEX to wrangler.jsonc"; exit 1; }
  echo "    NOINDEX=true (kept out of search engines)"
fi
# Keep the rendered config for later deploys (scripts/deploy-instance.sh).
cp wrangler.jsonc ".instances/${SLUG}.wrangler.jsonc"
echo "    mount=${MINSHOP_MOUNT_PATH:-/} cookiePrefix=${MINSHOP_COOKIE_PREFIX:-}"

record_meta() {
  { echo "SLUG=$SLUG"; echo "DB_NAME=$DB_NAME"; echo "DB_ID=$DB_ID"; echo "BUCKET=$BUCKET"; echo "FILES_BUCKET=$FILES_BUCKET"
    echo "MINSHOP_MOUNT_PATH=${MINSHOP_MOUNT_PATH:-}"; echo "MINSHOP_COOKIE_PREFIX=${MINSHOP_COOKIE_PREFIX:-}"
    [ -n "${THEME:-}" ] && echo "THEME=$THEME"
    [ -n "${SITE_SHELL:-}" ] && echo "SITE_SHELL=$SITE_SHELL"
    true; } > "$META"
}

echo "▸ [4/5] Applying migrations + building…"
$W d1 migrations apply DB --remote
if [[ "${MINSHOP_DEFER_DEPLOY:-}" =~ ^(1|true|yes|on)$ ]]; then
  record_meta
  cat <<EOF

✓ Resources for '$SLUG' created, migrations applied. No Worker deployed yet. (metadata: $META)

  1. Populate D1 (admin password + setup_complete close the setup wizard), e.g.
       node scripts/copy-content.mjs <source-slug> $SLUG --apply
  2. First deploy, with fresh random AUTH_SECRET and SECRETS_KEK in a private file:
       MINSHOP_SECRETS_FILE=<file> scripts/deploy-instance.sh $SLUG
EOF
  exit 0
fi
npx --yes astro build

echo "▸ [5/5] Deploying + setting AUTH_SECRET + SECRETS_KEK…"
$W deploy
openssl rand -base64 32 | $W secret put AUTH_SECRET
# Key-encryption key for the in-dashboard payment-key vault (features/secrets).
# With this set, the store owner can paste Stripe/OpenNode keys in Settings and
# they're stored AES-GCM-encrypted in D1 — no further `wrangler secret put` needed.
openssl rand -base64 32 | $W secret put SECRETS_KEK

# Record what was created so destroy-cf.sh can find it.
record_meta

cat <<EOF

✓ Instance '$SLUG' deployed.  (metadata: $META)

  Payment keys: paste them in the dashboard (Settings → Payment keys) — they're
  stored encrypted in D1 under the SECRETS_KEK just set. Or set them as Worker
  secrets instead (they take a back seat to D1 values):
    npx wrangler secret put STRIPE_SECRET_KEY      --name $SLUG
    npx wrangler secret put STRIPE_WEBHOOK_SECRET  --name $SLUG

  Admin auth: open /admin/setup and set the admin password there (stored hashed in
  D1). The wizard is reachable until you do — so set it promptly, or front /admin
  with Cloudflare Access on a public deploy.

  Then open the store and finish onboarding at /admin/setup.
  Redeploy later with:    scripts/deploy-instance.sh $SLUG
  Tear it all down with:  scripts/destroy-cf.sh $SLUG
EOF
