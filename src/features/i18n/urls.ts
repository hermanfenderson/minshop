/**
 * Runtime glue between the pure i18n engine and the app: one LocaleUrls for
 * the store's deployment (its mount; one language until the i18n middleware
 * step lands). Every internal link, form action, redirect and absolute URL in
 * the app is built here, so none can leave the mount.
 */
import {
  createLocaleUrls,
  createRouting,
  resolveI18nSettings,
  type LocaleUrls,
} from '../../i18n';
import { MOUNT, withMount } from '../../deployment';

// No language settings are read yet: the default (one language, no prefix)
// makes every URL just mount + logical path.
const SETTINGS = resolveI18nSettings();
const ROUTING = createRouting(SETTINGS, MOUNT);

/**
 * The store's URL builder for an origin ('https://shop.example'). `current`
 * is the logical path and query of the page being rendered, if any.
 */
export function storeUrls(origin: string, current?: { path: string; search?: string }): LocaleUrls {
  return createLocaleUrls({
    routing: ROUTING,
    settings: SETTINGS,
    locale: SETTINGS.defaultLocale,
    origin,
    currentPath: current?.path,
    currentSearch: current?.search,
  });
}

type RedirectStatus = 300 | 301 | 302 | 303 | 304 | 307 | 308;

/**
 * Wraps Astro's `redirect` for handlers whose targets are admin paths (never a
 * language): every logical path they name gains the mount.
 */
export function mountedRedirect(
  redirect: (path: string, status?: RedirectStatus) => Response,
): (path: string, status?: RedirectStatus) => Response {
  return (path, status) => redirect(withMount(path), status);
}
