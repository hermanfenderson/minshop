import { cache } from 'cloudflare:workers';
import { normalizeCacheTags, productCacheTags } from './tags';

export interface CachePurger {
  purge(options: CachePurgeOptions): Promise<CachePurgeResult>;
}

/**
 * The runtime's purge API, or null where the runtime has none.
 *
 * Local runtimes (`astro dev`, and `wrangler dev` behind `npm run preview`)
 * expose `cache` from cloudflare:workers as an empty object — no `purge`, no
 * `invalidate` — whether or not Workers Caching is enabled in the config
 * (measured). Without that API there is no Workers cache in front of the
 * isolate, so there is nothing that could serve stale content: skipping the
 * purge is correct, not a masked failure. Where the API exists, a rejected or
 * throwing purge is still an error, exactly as before.
 */
function availablePurger(purger: Partial<CachePurger> | null | undefined): CachePurger | null {
  return purger && typeof purger.purge === 'function' ? (purger as CachePurger) : null;
}

let unavailableReported = false;

/** One structured warning per isolate, so local logs say why nothing was purged. */
function reportUnavailable(mode: 'tags' | 'stock-tags'): void {
  if (unavailableReported) return;
  unavailableReported = true;
  console.warn(
    JSON.stringify({
      event: 'workers_cache_purge_unavailable',
      mode,
      reason:
        'this runtime has no Workers Caching purge API (local development); nothing is cached to invalidate',
    }),
  );
}

/** For tests: report the missing API again. */
export function resetPurgeAvailabilityReport(): void {
  unavailableReported = false;
}

function purgeFailure(
  mode: 'tags' | 'stock-tags' | 'everything',
  errors: CachePurgeError[] | unknown,
): void {
  console.error(
    JSON.stringify({
      event: 'workers_cache_purge_failed',
      mode,
      errors,
    }),
  );
}

/**
 * Invalidate low-frequency content mutations synchronously after their D1
 * write. A failed tag purge falls back to the whole entrypoint cache; if that
 * also fails, the handler fails rather than silently accepting stale content.
 */
export async function purgeCacheTags(
  tags: Iterable<string>,
  runtimePurger: Partial<CachePurger> | null = cache,
): Promise<void> {
  const normalized = normalizeCacheTags(tags);
  if (normalized.length === 0) return;
  const purger = availablePurger(runtimePurger);
  if (!purger) {
    reportUnavailable('tags');
    return;
  }

  try {
    const result = await purger.purge({ tags: normalized });
    if (result.success) return;
    purgeFailure('tags', result.errors);
  } catch (error) {
    purgeFailure('tags', error instanceof Error ? error.message : String(error));
  }

  try {
    const fallback = await purger.purge({ purgeEverything: true });
    if (fallback.success) return;
    purgeFailure('everything', fallback.errors);
  } catch (error) {
    purgeFailure('everything', error instanceof Error ? error.message : String(error));
  }

  throw new Error('The data was saved, but the Workers cache could not be invalidated.');
}

export function purgeProductCache(
  productPublicIds: Iterable<string | null | undefined>,
  purger?: Partial<CachePurger> | null,
): Promise<void> {
  return purgeCacheTags(productCacheTags(productPublicIds), purger);
}

/** Purge the owning Worker entrypoint's complete cache after a deployment. */
export async function purgeEntireCache(
  runtimePurger: Partial<CachePurger> | null = cache,
): Promise<void> {
  // An explicit post-deploy purge only runs on an instance with Workers Caching
  // on: a runtime without the API there is a real misconfiguration, not local dev.
  const purger = availablePurger(runtimePurger);
  if (!purger) throw new Error('The Workers cache purge API is not available in this runtime.');
  try {
    const result = await purger.purge({ purgeEverything: true });
    if (result.success) return;
    purgeFailure('everything', result.errors);
  } catch (error) {
    purgeFailure('everything', error instanceof Error ? error.message : String(error));
  }
  throw new Error('The Workers cache could not be purged.');
}

/**
 * Inventory transitions are checkout-frequency events. Purge only the narrow
 * product tags and never fall back to purge-everything: if Cloudflare rate
 * limits this best-effort request, the bounded shared TTL is the safety net.
 */
export async function purgeStockProductCache(
  productPublicIds: Iterable<string | null | undefined>,
  runtimePurger: Partial<CachePurger> | null = cache,
): Promise<void> {
  const tags = productCacheTags(productPublicIds);
  if (tags.length === 0) return;
  const purger = availablePurger(runtimePurger);
  if (!purger) {
    reportUnavailable('stock-tags');
    return;
  }

  try {
    const result = await purger.purge({ tags });
    if (result.success) return;
    purgeFailure('stock-tags', result.errors);
  } catch (error) {
    purgeFailure('stock-tags', error instanceof Error ? error.message : String(error));
  }
}
