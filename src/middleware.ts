import { defineMiddleware } from 'astro:middleware';
import type { APIContext, MiddlewareNext } from 'astro';
import { env } from 'cloudflare:workers';
import { verifyAccessJwt } from './features/auth/access';
import { accessGateDecision } from './features/auth/accessGate';
import { verifySession } from './features/auth/session';
import { adminCredential } from './features/auth/admin';
import {
  getStoreSettings,
  parseStoreSettings,
  STORE_SETTINGS_SQL,
} from './features/settings/db';
import {
  MENU_ITEMS_SQL,
  EMPTY_MENUS,
  groupMenus,
  menuTranslationWants,
  namedSingletons,
  translatedMenus,
  type MenuItemRow,
} from './features/navigation/db';
import { translationLocale } from './features/translations/content';
import { loadTranslations } from './features/translations/db';
import {
  checkRateLimit,
  rateLimitBucket,
  rateLimitedResponse,
} from './features/auth/rateLimit';
import {
  responseCacheControl,
} from './features/cache/public';
import { addCacheTags, responseCacheTags } from './features/cache/tags';
import { normalizeSearchQuery } from './features/search/query';
import { isForbiddenFormOrigin } from './features/auth/formOrigin';
import { MOUNT, cookieName } from './deployment';
import { createRouting, resolveRequestLocale } from './i18n';
import { LOCALE_REGISTRY, languageSettings } from './features/i18n/settings';
import { namesLanguage, preParsePath, requestLanguage } from './features/i18n/request';

/**
 * Admin auth gate. Protects BOTH the admin UI (`/admin/*`) and the admin API
 * (`/api/admin/*`) — the API is a separate path, so gating only `/admin` would
 * leave the mutation endpoints open.
 *
 * Precedence:
 *   1. Local dev (`astro dev`) → always allowed (no Access in front of localhost).
 *   2. Admin password set in D1 (via the setup wizard) → form login at
 *      `/admin/login` (password + optional Turnstile) that issues a signed session
 *      cookie; protected requests without a valid cookie are redirected to the
 *      login form (APIs get 401).
 *   3. Cloudflare Access assertion present → ALWAYS verify the JWT signature
 *      against the team JWKS (forge-proof, even against direct *.workers.dev
 *      hits). Access mode REQUIRES CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD; without
 *      both, an assertion is rejected (403) rather than trusted — a bare header is
 *      forgeable at the public origin, so trust-on-presence is a bypass.
 *   4. BOOTSTRAP (first run): no password yet and no Access → the setup wizard
 *      (`/admin/setup`) is OPEN so the operator can create the password; the rest
 *      of /admin bounces there. The wizard auto-logs-you-in on save, which trips
 *      step 2 and closes the window. Set the password promptly, or front /admin
 *      with Access, on a public deploy.
 *
 * Cloudflare Access is the recommended production protection (edge SSO/MFA); the
 * wizard-set password is the built-in alternative. See README → Admin auth. JWT
 * verification lives in features/auth/access.ts; session signing in
 * features/auth/session.ts.
 */
function isProtected(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/')
  );
}

/**
 * HTML documents (pages, admin), as opposed to APIs, assets and fragments. They
 * load the runtime settings overlay and the menus.
 */
function isDocumentPath(path: string): boolean {
  return !path.startsWith('/api/') && !path.startsWith('/_') && !path.startsWith('/partials/');
}

/**
 * Runtime settings overlay (store name, languages, …): ONE read per request,
 * only where it is needed. HTML documents batch it with the menus; the cart
 * fragment and any request that names a language read settings alone (the
 * language must be checked against the enabled ones). Other APIs and assets
 * read nothing.
 */
async function loadSettings(context: APIContext, path: string): Promise<void> {
  const isDocument = isDocumentPath(path);
  const wantsSettings =
    isDocument ||
    path.startsWith('/partials/') ||
    namesLanguage(context.url, MOUNT, LOCALE_REGISTRY, 'lang');
  if (!wantsSettings) return;
  if (!isDocument) {
    try {
      context.locals.settings = await getStoreSettings(env.DB);
    } catch {
      // Settings table missing → build-time defaults (one language).
    }
    return;
  }
  // Storefront documents also need the header/footer menus. Both reads go in
  // ONE batch so /cart, /checkout, /account, /order, and /pay — which are never
  // edge-cached — don't pay a second D1 round trip.
  const wantsMenus = !path.startsWith('/admin');
  try {
    if (wantsMenus) {
      const [settings, menus] = await env.DB.batch<Record<string, string>>([
        env.DB.prepare(STORE_SETTINGS_SQL),
        env.DB.prepare(MENU_ITEMS_SQL),
      ]);
      context.locals.settings = parseStoreSettings(
        (settings.results ?? []) as Array<{ key: string; value: string }>,
      );
      context.locals.menus = groupMenus(
        (menus.results ?? []) as unknown as MenuItemRow[],
        context.locals.settings.homePage,
      );
    } else {
      context.locals.settings = await getStoreSettings(env.DB);
    }
  } catch {
    // A batch is all-or-nothing, so a missing `menu_items` table (pre-migration)
    // would take settings down with it — and losing settings silently
    // disables the first-run setup funnel. Retry settings alone.
    // Empty menus render a bare header and a copyright-only footer: degraded
    // but navigable. Losing settings is not.
    try {
      context.locals.settings = await getStoreSettings(env.DB);
      context.locals.menus = EMPTY_MENUS;
    } catch {
      // Settings table missing too → fall back to build-time defaults.
    }
  }
}

async function gate(context: APIContext, next: MiddlewareNext): Promise<Response> {
  // Every decision below compares the LOGICAL path (no mount, no language), set
  // by route(), which has also loaded the settings this request needs.
  const path = context.locals.path;
  const urls = context.locals.urls;
  const isDocument = isDocumentPath(path);

  // First-run funnel: until the setup wizard is finished, send the STOREFRONT to it
  // too — the admin already redirects /admin → /admin/setup the same way. Skips
  // /admin (its own gate), /api, and assets to avoid loops; only fires once settings
  // loaded and setup_complete isn't set.
  if (
    isDocument &&
    !path.startsWith('/admin') &&
    context.locals.settings &&
    !context.locals.settings.setupComplete
  ) {
    return context.redirect(urls.href('/admin/setup'), 302);
  }

  // Throttle anonymous, resource-spending mutations and cache-missing searches.
  // Webhooks are excluded: providers retry them and signatures are verified.
  const bucket = rateLimitBucket(
    context.request.method,
    path,
    normalizeSearchQuery(context.url.searchParams.get('q') ?? '') !== '',
  );
  if (bucket) {
    const limiter =
      bucket === 'auth'
        ? env.AUTH_RATE_LIMITER
        : bucket === 'checkout'
          ? env.CHECKOUT_RATE_LIMITER
          : env.SEARCH_RATE_LIMITER;
    try {
      if (!(await checkRateLimit(limiter, context.request, path))) {
        console.warn(JSON.stringify({ event: 'rate_limited', bucket, path }));
        return rateLimitedResponse(path);
      }
    } catch (error) {
      // A limiter outage must not make checkout or login unavailable. Binding
      // failures remain visible in Workers Logs for operational follow-up.
      console.error(
        JSON.stringify({
          event: 'rate_limit_error',
          bucket,
          path,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  if (!isProtected(path)) return next();

  // 1. Localhost dev has no Access edge — don't lock yourself out.
  if (import.meta.env.DEV) return next();

  // 2. Steady state: an admin password is set (via the setup wizard) → require a
  //    valid signed session. Checked before the Access header so it can't be
  //    bypassed by forging it.
  const cred = await adminCredential(env.DB);
  if (cred.enabled) {
    // The login page itself must be reachable unauthenticated (to log in).
    if (path === '/admin/login') return next();
    const session = context.cookies.get(cookieName('admin_session'))?.value ?? null;
    // Sign/verify with AUTH_SECRET (high-entropy key); the credential is the bound tag.
    const signingKey = env.AUTH_SECRET || cred.tagSource;
    if (await verifySession(session, signingKey, cred.tagSource, Date.now() / 1000)) return next();
    // Not authenticated: humans go to the login form, API callers get 401.
    if (path.startsWith('/api/')) {
      return new Response('Authentication required.', { status: 401 });
    }
    return context.redirect(urls.href('/admin/login'), 303);
  }

  // 3. Cloudflare Access. The edge injects a signed JWT into the origin request.
  //    We ALWAYS verify its signature (against the team JWKS) — the header is
  //    otherwise trivially forgeable against the public *.workers.dev origin,
  //    which bypasses the edge Access app bound to your custom hostname. So
  //    Access mode REQUIRES CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD; without both we
  //    fail closed rather than trust an unverifiable header.
  const access = accessGateDecision(
    context.request.headers.get('Cf-Access-Jwt-Assertion'),
    env.CF_ACCESS_TEAM_DOMAIN,
    env.CF_ACCESS_AUD,
  );
  if (access.action === 'deny') {
    return new Response(access.message, { status: 403 });
  }
  if (access.action === 'verify') {
    let identity = null;
    try {
      identity = await verifyAccessJwt(access.token, {
        teamDomain: access.teamDomain,
        aud: access.aud,
      });
    } catch {
      identity = null; // JWKS unreachable etc. → fail closed
    }
    if (identity) {
      context.locals.adminEmail = identity.email;
      return next();
    }
    return new Response('Invalid Access token.', { status: 403 });
  }

  // 4. Bootstrap (first run): no admin password and no Access configuration. The
  //    setup wizard is open so the operator can create the password — which trips
  //    step 2 and locks the door. Everything else under /admin bounces to setup;
  //    admin APIs get 401. (Set the password promptly, or front /admin with
  //    Cloudflare Access, to close this window. See README → Admin auth.)
  if (path === '/admin/setup') return next();
  if (path.startsWith('/api/')) {
    return new Response('Admin not set up yet — complete /admin/setup first.', { status: 401 });
  }
  return context.redirect(urls.href('/admin/setup'), 303);
}

const notFound = (): Response =>
  new Response('Not found', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });

async function route(context: APIContext, next: MiddlewareNext): Promise<Response> {
  const url = context.url;
  // A page-level Astro.rewrite (index.astro's home-page override) runs the
  // middleware again on the internal URL. The language was resolved from the
  // public URL on the first pass: keep it, and only follow the new path.
  const reentry = context.locals.locale !== undefined;

  // The logical path: no mount ('/shop'), no language prefix ('/it'). Outside
  // the mount the store doesn't answer at all — Astro would otherwise match
  // '/cart' against the routes under '/shop' and serve a second copy.
  const pre = preParsePath(url.pathname, MOUNT, LOCALE_REGISTRY);
  if (pre === null) return notFound();
  if (!reentry) await loadSettings(context, pre);
  const languages = languageSettings(context.locals.settings);

  // On re-entry Astro has normalized the internal URL with a trailing slash
  // (build.format 'directory'); logical paths never end in one but the root.
  let path = reentry && pre.length > 1 && pre.endsWith('/') ? pre.slice(0, -1) : pre;
  let locale = reentry ? context.locals.locale : languages.defaultLocale;
  let proceed: MiddlewareNext = next;
  let redirect: Response | null = null;
  if (!reentry) {
    // The language comes from the URL only. Cookie and Accept-Language are read
    // solely for the opt-in home-page suggestion (i18n_detect = root).
    const resolution = resolveRequestLocale(url, createRouting(languages, MOUNT, LOCALE_REGISTRY), languages, {
      mount: MOUNT,
      method: context.request.method,
      preferred: {
        cookie: context.cookies.get(cookieName('lang'))?.value ?? null,
        acceptLanguage: context.request.headers.get('accept-language'),
      },
    });
    if (resolution.action === 'outside') return notFound();
    if (resolution.action === 'redirect') {
      redirect = new Response(null, { status: resolution.status, headers: { location: resolution.location } });
      if (resolution.negotiated) {
        // Chosen from the visitor's preferences: never shared by a cache.
        redirect.headers.set('cache-control', 'private, no-store');
        redirect.headers.set('vary', 'cookie, accept-language');
      }
    } else {
      path = resolution.path;
      locale = resolution.locale;
      // '/it/shop/cart' renders the '/shop/cart' route. next(url) rewrites in
      // the same request; the body stream travels with it, so nothing before
      // this point may read the body (nothing does: route and gate only read
      // headers and the URL).
      if (resolution.rewrite) {
        const internal = new URL(resolution.internalPath + url.search, url);
        proceed = () => next(internal);
      }
    }
  }

  const language = requestLanguage(languages, LOCALE_REGISTRY, MOUNT, locale, url.origin, {
    path,
    search: url.search,
  });
  context.locals.path = path;
  context.locals.locale = language.locale;
  context.locals.i18n = language.i18n;
  context.locals.urls = language.urls;
  if (!reentry) {
    // Admin edits the main tables, so it always sees the source content.
    const admin = path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');
    context.locals.contentLocale = admin ? null : translationLocale(languages, language.locale);
    const menus = context.locals.menus;
    if (context.locals.contentLocale && menus && menus.header.length + menus.footer.length > 0) {
      // Only a translated language pays this read; it is one query per entity.
      const set = await loadTranslations(env.DB, context.locals.contentLocale, menuTranslationWants(menus));
      context.locals.menus = translatedMenus(menus, set);
    }
    if (context.locals.menus) {
      context.locals.menus = namedSingletons(context.locals.menus, {
        home: language.i18n.t('storefront.nav.home'),
        catalog: language.i18n.t('storefront.nav.shop'),
      });
    }
  }
  const productError = path.startsWith('/products/') && url.searchParams.has('error');

  let response =
    redirect ??
    (isForbiddenFormOrigin(context.request, url, path)
      ? new Response(`Cross-site ${context.request.method} form submissions are forbidden`, {
          status: 403,
        })
      : await gate(context, proceed));

  // Workers Caching heuristically stores headerless responses, so make every
  // response explicit: only allowlisted public successes/301s are shared.
  const cacheControl = responseCacheControl(
    path,
    response.status,
    response.headers.get('cache-control'),
    productError,
  );
  if (response.headers.get('cache-control') !== cacheControl) {
    try {
      response.headers.set('cache-control', cacheControl);
    } catch {
      // Redirect responses can have immutable headers.
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });
      response.headers.set('cache-control', cacheControl);
    }
  }

  const cacheTags = responseCacheTags(path, response.status);
  if (cacheTags.length > 0) {
    try {
      addCacheTags(response.headers, cacheTags);
    } catch {
      // A route-specific response can have immutable headers even when its
      // Cache-Control already matched. Rebuild before adding purge metadata.
      response = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });
      addCacheTags(response.headers, cacheTags);
    }
  }

  return response;
}

// Response hardening for a store on a real domain. Applied to EVERY response.
const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff', // don't MIME-sniff responses
  'x-frame-options': 'DENY', // block framing (clickjacking) — nothing here is meant to be embedded
  'strict-transport-security': 'max-age=31536000; includeSubDomains', // force HTTPS for a year
};

/** Add the security headers, rebuilding when the response's headers are immutable
 *  (e.g. a Response.redirect to a payment provider, or a Cache API hit). */
function withSecurityHeaders(res: Response): Response {
  try {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
    return res;
  } catch {
    const rebuilt = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: new Headers(res.headers),
    });
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) rebuilt.headers.set(k, v);
    return rebuilt;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  return withSecurityHeaders(await route(context, next));
});
