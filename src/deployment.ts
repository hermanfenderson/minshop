/**
 * The deployment shape, as the BUILD fixed it: the mount path (Astro's `base`)
 * and the cookie prefix. Pure — no Cloudflare or config imports — so unit-tested
 * modules (the cart, auth) can name their cookies through it.
 *
 * Both come from scripts/deployment.mjs via astro.config.mjs; reading them back
 * from the build (BASE_URL, a compile-time constant) means the runtime can never
 * disagree with the asset URLs Astro emitted. Under vitest neither is set, so
 * tests see a root mount and unprefixed cookies, exactly as before.
 */
import { joinMount, normalizeMountPath, stripMount } from './i18n/mount';

declare const __MINSHOP_COOKIE_PREFIX__: string | undefined;

/** '' (root) or '/shop' — the engine's internal mount form. */
export const MOUNT: string = normalizeMountPath(import.meta.env.BASE_URL ?? '/');

export const COOKIE_PREFIX: string =
  typeof __MINSHOP_COOKIE_PREFIX__ === 'string' ? __MINSHOP_COOKIE_PREFIX__ : '';

/** The store's name for a cookie ('cart' → 'minshop_cart' with the prefix). */
export function cookieName(name: string): string {
  return COOKIE_PREFIX + name;
}

/**
 * Mount + path, for surfaces that never carry a language (images, build
 * assets, the admin API from client code). Links that may carry a language
 * go through LocaleUrls instead.
 */
export function withMount(path: string): string {
  return joinMount(MOUNT, path);
}

/**
 * The logical path of a request under the mount ('/shop/cart' → '/cart'), or
 * null when the request is outside it. Route, auth and cache decisions compare
 * logical paths, so they don't change with the mount.
 */
export function logicalPath(pathname: string, mount: string = MOUNT): string | null {
  return stripMount(pathname, mount);
}
