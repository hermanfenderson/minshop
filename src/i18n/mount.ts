/**
 * The mount path: where the whole store lives on its host. '/' for a
 * standalone store, '/shop' when another site owns the rest of the host
 * (Monopolele: '/shop/' in English, '/it/shop/' in Italian). It is
 * independent of the language strategy: a public URL is
 * `[language prefix] + mount + logical path`.
 *
 * Internally a mount is '' (root) or '/seg[/seg…]' with no trailing slash,
 * so joins never double a slash.
 */

const SEGMENT = /^[A-Za-z0-9._~-]+$/;

/**
 * Canonical internal form of a configured mount path ('/', '', '/shop/',
 * 'shop' → '' or '/shop'). Throws on segments that can't be a URL path
 * segment, '.'/'..', or a query/fragment: a build-time mistake.
 */
export function normalizeMountPath(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  if (trimmed === '') return '';
  const segments = trimmed.split('/');
  for (const seg of segments) {
    if (!SEGMENT.test(seg) || seg === '.' || seg === '..') {
      throw new Error(`i18n: "${value}" is not a valid mount path`);
    }
  }
  return '/' + segments.join('/');
}

/** The mount as Astro's `base` wants it ('/' or '/shop'). */
export function mountToBase(mount: string): string {
  return mount === '' ? '/' : mount;
}

/**
 * The logical path under the mount ('/shop/cart' → '/cart', '/shop' → '/'),
 * or null when `pathname` is outside the mount ('/shopping', '/blog').
 */
export function stripMount(pathname: string, mount: string): string | null {
  if (mount === '') return pathname.startsWith('/') ? pathname : null;
  if (pathname === mount || pathname === mount + '/') return '/';
  return pathname.startsWith(mount + '/') ? pathname.slice(mount.length) : null;
}

/** Mount + logical path ('/shop' + '/cart'; the root keeps its slash: '/shop/'). */
export function joinMount(mount: string, path: string): string {
  const logical = path.startsWith('/') ? path : '/' + path;
  return mount + logical;
}
