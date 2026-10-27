import type { D1Database } from '@cloudflare/workers-types';
import type { I18nSettings } from '../../i18n/settings';
import { normalizeTimeZone } from './timeZone';
import {
  parseRuntimeShippingConfig,
  type ParsedRuntimeShippingConfig,
} from '../shipping/settings';
import { defaultWeightUnit, isWeightUnit, type WeightUnit } from '../shipping/weight';

/**
 * Runtime settings — the small set of values the setup wizard persists to D1 so
 * they can change without a redeploy. Everything else stays build-time config.
 * Reads here OVERLAY env/config defaults; absence means "use the default".
 */

/** Keys we store. Kept narrow on purpose — most config remains build-time. */
export type SettingKey =
  | 'setup_complete' // '1' once the wizard has been finished
  | 'store_name' // overrides config.storeName
  | 'time_zone' // IANA zone for store/admin date display; absent = config/env default
  | 'stripe_webhook_secret' // captured by webhook auto-registration (env wins if set)
  | 'payment_methods_disabled' // CSV of payment methods the admin switched off
  | 'cart_enabled' // '0' = cart/checkout off (browse-only catalog); absent = on
  | 'buy_now_enabled' // '0' = hide "Buy now" (cart-only purchase); absent = on
  | 'search_provider' // 'fts' | 'vector' — overrides config/SEARCH_PROVIDER; absent = default
  // Runtime overrides of build-time config toggles ('1'/'0'; absent = inherit config).
  | 'discounts_enabled' // overrides config.discounts.enabled
  | 'tax_enabled' // overrides config.tax.enabled
  | 'accounts_enabled' // overrides config.features.accounts
  | 'image_optimize' // overrides config.images.optimizeOnUpload
  | 'image_delivery' // 'cloudflare' = responsive on-demand transforms; absent = originals
  // Languages (Admin → Settings → Languages). Absent = one language, today's URLs.
  | 'i18n_default_locale' // language of the interface and of unprefixed URLs
  | 'i18n_content_source_locale' // language the main tables are written in
  | 'i18n_enabled_locales' // CSV of language codes
  | 'i18n_routing' // 'prefix' | 'query' ('domain' is engine-only for now)
  | 'i18n_prefix_default' // '1' = prefix the default language too
  | 'i18n_query_param' // query strategy's parameter name
  | 'i18n_detect' // 'root' = suggest a language on the home page
  | 'i18n_admin_locale' // the admin's default language
  | 'shipping_enabled' // LEGACY: overrides config.shipping.enabled. Only consulted while no shipping_config document exists.
  | 'shipping_config' // the merchant-managed shipping document (JSON; see features/shipping/settings.ts)
  | 'weight_unit' // 'g' | 'kg' | 'oz' | 'lb' — Admin input/display unit; storage is always grams
  | 'ship_from' // JSON ShipFrom — the store's return address for label purchase (read at label time, not in locals)
  | 'printful_shipping_surcharge_pct' // % added to Printful's shipping rate (its rates are before tax); absent = 22
  | 'printful_confirm_orders' // '1' = Printful orders go straight to production; absent = drafts a person confirms
  | 'parcel_default' // JSON {length,width,height} — remembered box dimensions for label purchase
  | 'admin_password_hash' // PBKDF2 hash of the admin password (set at setup). NOT in StoreSettings — read only by the auth layer, never loaded into locals.
  // Integrations configured in the admin dashboard (non-secret halves; the keys
  // live encrypted in the vault — see features/secrets/store.ts).
  | 'email_enabled' // '0' = order/login email off; absent = on
  | 'email_provider' // 'resend' | 'cloudflare'; absent = resend
  | 'logo_image_key' // media image_key shown instead of the text store name; absent = text
  | 'home_page' // what / renders: 'page:<id>' | 'product:<id>'; absent = the catalog list
  | 'announcement' // storefront announcement bar text; absent/empty = bar hidden
  | 'announcement_href' // optional link for the announcement bar
  | `announcement:${string}` // the announcement in another language ('announcement:it')
  | `announcement_href:${string}` // its link in that language
  | 'email_from' // sender address; absent = build-time default
  | 'store_url' // origin last seen serving a settlement, so the cron can build order links
  | 'email_from_name' // sender display name; absent = store name
  | 'email_notify_to' // owner "new order" alert recipient; absent = store.config.ts notifyTo
  | 'turnstile_enabled' // '1' = bot challenge on (admin login + customer sign-in); absent = off
  | 'turnstile_site_key' // Turnstile public sitekey
  | 'payment_provider' // 'stripe' | 'lightning' | 'opennode' | 'demo'; absent = stripe
  | 'lightning_backend' // 'phoenixd' | 'lnbits'; absent = phoenixd
  | 'lnbits_url' // LNbits node URL (the invoice/read key is in the vault)
  | 'phoenixd_url' // phoenixd node URL (the password is in the vault)
  | 'opennode_api_url' // OpenNode API base override (testnet); absent = live default
  | `enc:${string}`; // AES-GCM-encrypted secret (see features/secrets/store.ts), e.g. 'enc:stripe_secret_key'. Never loaded as plaintext into locals.

/** The storefront features that can be flipped at runtime (default on). */
export type FeatureKey = 'cart_enabled' | 'buy_now_enabled';

export interface StoreSettings {
  setupComplete: boolean;
  /** Stored language settings, unvalidated; the i18n engine resolves them. */
  i18n: Partial<I18nSettings>;
  storeName: string | null;
  /** Runtime IANA time zone, or null to use TIME_ZONE / UTC. */
  timeZone: string | null;
  stripeWebhookSecret: string | null;
  /** Methods the admin disabled at runtime. A method is offered iff it's both
   *  configured (keys present) AND not in this list. Empty = nothing disabled. */
  disabledPaymentMethods: string[];
  /** Add-to-cart + checkout available (default true). Off → browse-only catalog. */
  cartEnabled: boolean;
  /** "Buy now" instant-checkout button shown (default true). Requires cartEnabled. */
  buyNowEnabled: boolean;
  /** Search backend chosen at runtime, or null to use the build-time default
   *  (config.search.provider / SEARCH_PROVIDER). */
  searchProvider: 'fts' | 'vector' | null;
  /** Payment-secret names (e.g. 'stripe_secret_key') the admin has stored encrypted
   *  in D1 — i.e. names with a non-empty `enc:` row. Lets the storefront know a key
   *  is configured WITHOUT decrypting it. Env-var fallbacks are checked separately
   *  (see features/secrets/store.ts → hasSecret). */
  configuredSecrets: string[];
  /** Order/login email on (default true; a no-op until a provider key is set). */
  emailEnabled: boolean;
  /** Email backend: 'resend' (free) or 'cloudflare' (paid send_email binding). */
  emailProvider: 'resend' | 'cloudflare';
  /** Sender address / display name, or null to use the build-time defaults. */
  /** Header logo object key, or null to render the store name as text. Stores the
   *  immutable key rather than a media id so the layout renders it without a
   *  second D1 lookup. */
  logoImageKey: string | null;
  /** What `/` renders: 'page:<id>', 'product:<id>', or null for the catalog
   *  list. Stored as an id so renaming the target cannot break it. */
  homePage: string | null;
  /** Announcement bar message, or null to hide the bar entirely. The message IS
   *  the on/off switch — an empty value deletes the row, so there is no separate
   *  enabled flag to fall out of sync with it. */
  announcement: string | null;
  /** Optional destination making the whole announcement bar clickable. */
  announcementHref: string | null;
  /**
   * The announcement in other languages, by locale ('announcement:it' rows).
   * A missing text or link falls back to the source one, field by field.
   */
  announcementTranslations: Record<string, { text: string | null; href: string | null }>;
  emailFrom: string | null;
  emailFromName: string | null;
  emailNotifyTo: string | null;
  // Nullable = inherit the build-time config default (resolve at the consumer).
  discountsEnabled: boolean | null;
  taxEnabled: boolean | null;
  accountsEnabled: boolean | null;
  imageOptimize: boolean | null;
  /** Product-image delivery. Original is the safe, zero-configuration default. */
  imageDelivery: 'original' | 'cloudflare';
  /** LEGACY on/off switch. Consulted only when `shippingConfig` is absent — a
   *  saved document owns `enabled` itself. */
  shippingEnabled: boolean | null;
  /** The complete parse state, not a nullable config: absent (inherit build-time)
   *  and invalid (fail closed) must stay distinguishable, and the invalid case
   *  carries the raw value the Admin replacement flow needs. */
  shippingConfig: ParsedRuntimeShippingConfig;
  /** Unit the Admin forms read and write. Storage is always integer grams. */
  weightUnit: WeightUnit;
  /** Turnstile bot challenge on (admin login + customer sign-in). Default off. */
  turnstileEnabled: boolean;
  /** Turnstile public sitekey, or null. (The secret lives in the vault.) */
  turnstileSiteKey: string | null;
  /** Default payment rail (Settings → Payments). Default 'stripe'. */
  paymentProvider: 'stripe' | 'lightning' | 'opennode' | 'demo';
  /** Self-hosted Lightning node (when provider/rail is lightning). Default 'phoenixd'. */
  lightningBackend: 'phoenixd' | 'lnbits';
  /** Lightning node URLs, or null. (The key/password live in the vault.) */
  lnbitsUrl: string | null;
  phoenixdUrl: string | null;
  /** OpenNode API base override (testnet), or null for the live default. */
  opennodeApiUrl: string | null;
}

/** One setting value, or null if unset. */
export async function getSetting(db: D1Database, key: SettingKey): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

/** Upsert a setting (empty/undefined value deletes it → falls back to the default). */
export async function setSetting(
  db: D1Database,
  key: SettingKey,
  value: string | null | undefined,
): Promise<void> {
  if (value == null || value === '') {
    await db.prepare('DELETE FROM settings WHERE key = ?').bind(key).run();
    return;
  }
  await db
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
    .bind(key, value)
    .run();
}

/** The single settings read. Exported so middleware can put it in a batch
 *  alongside the footer's page links without duplicating the SQL. */
export const STORE_SETTINGS_SQL = 'SELECT key, value FROM settings';

function announcementTranslations(
  map: Map<string, string>,
): Record<string, { text: string | null; href: string | null }> {
  const out: Record<string, { text: string | null; href: string | null }> = {};
  for (const [key, value] of map) {
    const m = /^announcement(_href)?:([a-z]{2,3}(?:-[a-z0-9]+)*)$/i.exec(key);
    if (!m) continue;
    const entry = (out[m[2].toLowerCase()] ??= { text: null, href: null });
    if (m[1]) entry.href = value;
    else entry.text = value;
  }
  return out;
}

/** The announcement bar's text and link in `locale` (null = the source ones). */
export function announcementFor(
  settings: StoreSettings | undefined,
  locale: string | null,
): { text: string; href: string } {
  // The original message stays the bar's one switch: no message, no bar in
  // any language.
  if (!settings?.announcement) return { text: '', href: '' };
  const t = locale ? settings.announcementTranslations?.[locale] : undefined;
  return {
    text: t?.text ?? settings?.announcement ?? '',
    href: t?.href ?? settings?.announcementHref ?? '',
  };
}

/** All overlay settings in one read (used by middleware to populate locals). */
export async function getStoreSettings(db: D1Database): Promise<StoreSettings> {
  const { results } = await db.prepare(STORE_SETTINGS_SQL).all<{
    key: string;
    value: string;
  }>();
  return parseStoreSettings(results ?? []);
}

/** Rows → settings. Split from the query so a batched read parses identically. */
export function parseStoreSettings(
  results: Array<{ key: string; value: string }>,
): StoreSettings {
  const map = new Map((results ?? []).map((r) => [r.key, r.value]));
  return {
    setupComplete: map.get('setup_complete') === '1',
    i18n: parseI18nRows(map),
    storeName: map.get('store_name') ?? null,
    timeZone: normalizeTimeZone(map.get('time_zone')),
    stripeWebhookSecret: map.get('stripe_webhook_secret') ?? null,
    disabledPaymentMethods: (map.get('payment_methods_disabled') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    cartEnabled: map.get('cart_enabled') !== '0',
    buyNowEnabled: map.get('buy_now_enabled') !== '0',
    searchProvider: map.get('search_provider') === 'vector' ? 'vector'
      : map.get('search_provider') === 'fts' ? 'fts'
      : null,
    configuredSecrets: (results ?? [])
      .filter((r) => r.key.startsWith('enc:') && r.value)
      .map((r) => r.key.slice(4)),
    emailEnabled: map.get('email_enabled') !== '0',
    emailProvider: map.get('email_provider') === 'cloudflare' ? 'cloudflare' : 'resend',
    logoImageKey: map.get('logo_image_key') ?? null,
    homePage: map.get('home_page') ?? null,
    announcement: map.get('announcement') ?? null,
    announcementHref: map.get('announcement_href') ?? null,
    announcementTranslations: announcementTranslations(map),
    emailFrom: map.get('email_from') ?? null,
    emailFromName: map.get('email_from_name') ?? null,
    emailNotifyTo: map.get('email_notify_to') ?? null,
    discountsEnabled: map.get('discounts_enabled') == null ? null : map.get('discounts_enabled') === '1',
    taxEnabled: map.get('tax_enabled') == null ? null : map.get('tax_enabled') === '1',
    accountsEnabled: map.get('accounts_enabled') == null ? null : map.get('accounts_enabled') === '1',
    imageOptimize: map.get('image_optimize') == null ? null : map.get('image_optimize') === '1',
    imageDelivery: map.get('image_delivery') === 'cloudflare' ? 'cloudflare' : 'original',
    shippingEnabled: map.get('shipping_enabled') == null ? null : map.get('shipping_enabled') === '1',
    // Parsed from the rows we already have — no extra query, and the storefront
    // never has to decide what a malformed document means on its own.
    shippingConfig: parseRuntimeShippingConfig(map.get('shipping_config')),
    weightUnit: isWeightUnit(map.get('weight_unit'))
      ? (map.get('weight_unit') as WeightUnit)
      : defaultWeightUnit(normalizeTimeZone(map.get('time_zone'))),
    turnstileEnabled: map.get('turnstile_enabled') === '1',
    turnstileSiteKey: map.get('turnstile_site_key') ?? null,
    paymentProvider:
      map.get('payment_provider') === 'lightning' ? 'lightning'
      : map.get('payment_provider') === 'opennode' ? 'opennode'
      : map.get('payment_provider') === 'demo' ? 'demo'
      : 'stripe',
    lightningBackend: map.get('lightning_backend') === 'lnbits' ? 'lnbits' : 'phoenixd',
    lnbitsUrl: map.get('lnbits_url') ?? null,
    phoenixdUrl: map.get('phoenixd_url') ?? null,
    opennodeApiUrl: map.get('opennode_api_url') ?? null,
  };
}

/** Stored language rows → partial settings; only what is present (absent = default). */
function parseI18nRows(map: Map<string, string>): Partial<I18nSettings> {
  const out: Partial<I18nSettings> = {};
  const def = map.get('i18n_default_locale');
  if (def) out.defaultLocale = def;
  const source = map.get('i18n_content_source_locale');
  if (source) out.contentSourceLocale = source;
  const enabled = map.get('i18n_enabled_locales');
  if (enabled) out.enabledLocales = enabled.split(',').map((s) => s.trim()).filter(Boolean);
  const routing = map.get('i18n_routing');
  if (routing === 'prefix' || routing === 'query' || routing === 'domain') out.routing = routing;
  if (map.has('i18n_prefix_default')) out.prefixDefault = map.get('i18n_prefix_default') === '1';
  const param = map.get('i18n_query_param');
  if (param) out.queryParam = param;
  if (map.get('i18n_detect') === 'root') out.detect = 'root';
  const admin = map.get('i18n_admin_locale');
  if (admin) out.adminLocale = admin;
  return out;
}

/**
 * Flip a storefront feature on/off. Stored only when OFF ('0') — enabling deletes
 * the row so the default (absent = on) takes over and the table stays tidy.
 */
export async function setFeatureEnabled(
  db: D1Database,
  key: FeatureKey,
  enabled: boolean,
): Promise<void> {
  await setSetting(db, key, enabled ? null : '0');
}

/**
 * Flip one payment method on/off at runtime. Stored as the set of DISABLED
 * methods (so the default — empty — means "offer everything that's configured").
 */
export async function setPaymentMethodDisabled(
  db: D1Database,
  method: string,
  disabled: boolean,
): Promise<void> {
  const current = (await getSetting(db, 'payment_methods_disabled')) ?? '';
  const set = new Set(
    current
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  if (disabled) set.add(method);
  else set.delete(method);
  // Empty string → setSetting deletes the row → back to the "nothing disabled" default.
  await setSetting(db, 'payment_methods_disabled', [...set].join(','));
}
