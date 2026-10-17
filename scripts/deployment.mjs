/**
 * The deployment shape fixed at build time: where the store is mounted and how
 * its cookies are named. Read once by astro.config.mjs, which hands the mount to
 * Astro as `base` and the cookie prefix to the bundle as a compile-time constant.
 *
 * Precedence: build variable (MINSHOP_MOUNT_PATH / MINSHOP_COOKIE_PREFIX), then
 * src/store.config.ts, then the defaults in src/config.ts ('/' and '').
 */
const SEGMENT = /^[A-Za-z0-9._~-]+$/;
const COOKIE_PREFIX = /^[A-Za-z0-9_-]*$/;

/** '/', '', '/shop/' → '/' or '/shop' (Astro's base form). Throws on bad input. */
export function normalizeBase(value) {
  const trimmed = String(value).trim().replace(/^\/+|\/+$/g, '');
  if (trimmed === '') return '/';
  for (const seg of trimmed.split('/')) {
    if (!SEGMENT.test(seg) || seg === '.' || seg === '..') {
      throw new Error(`minshop: "${value}" is not a valid mountPath`);
    }
  }
  return '/' + trimmed;
}

export function resolveDeployment(env = process.env, overrides = {}) {
  const mountPath = normalizeBase(env.MINSHOP_MOUNT_PATH ?? overrides.mountPath ?? '/');
  const cookiePrefix = env.MINSHOP_COOKIE_PREFIX ?? overrides.cookiePrefix ?? '';
  if (!COOKIE_PREFIX.test(cookiePrefix)) {
    throw new Error(`minshop: "${cookiePrefix}" is not a valid cookiePrefix (letters, digits, _ and -)`);
  }
  return { mountPath, cookiePrefix };
}
