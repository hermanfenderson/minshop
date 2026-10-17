import type { DeepPartial, SiteConfig } from './config';

/**
 * Copy this file to `store.config.ts` and edit it — that's the only config file
 * you touch. Its values are deep-merged on top of the defaults in `config.ts`,
 * so list ONLY what you change; anything omitted keeps its default. Arrays
 * (shipping rates, allowed countries) replace wholesale.
 *
 * Store identity, feature switches, integrations, and provider credentials are
 * configured at runtime in Admin → Settings and do not belong in this file.
 */
export const storeOverrides: DeepPartial<SiteConfig> = {
  // currency: 'usd',                // ISO 4217, lowercase
  //
  // Mounting under another site (build-time; also MINSHOP_MOUNT_PATH /
  // MINSHOP_COOKIE_PREFIX at build). Monopolele, for example, serves its own
  // site at / and /it/, and the store at /shop/:
  // mountPath: '/shop',              // Worker routes must match: <host>/shop*
  // cookiePrefix: 'minshop_',        // avoid colliding with the host site's cookies
  //   Changing cookiePrefix on a live store renames its cookies: open carts and
  //   sessions are dropped once. With a mount, robots.txt belongs to the host
  //   site, which should list <host>/shop/sitemap.xml.
  //
  // features: { accounts: false },  // magic-link customer login
  //
  // images: { maxWidth: 1000 },      // optimization on/off lives in Admin
  //
  // orderNumber: { offset: 1000, step: 1, randomStep: 0 },
  //
  // Shipping (zones, rates, weight bands, free-over thresholds) is managed in
  // Admin → Shipping. The block that used to live here is only the default for a
  // brand-new store; editing it after the first Admin save has no effect.
};
