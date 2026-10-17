import { describe, expect, it, vi } from 'vitest';
import {
  purgeCacheTags,
  purgeEntireCache,
  purgeProductCache,
  purgeStockProductCache,
  resetPurgeAvailabilityReport,
  type CachePurger,
} from './purge';

const result = (success: boolean): CachePurgeResult => ({
  success,
  errors: success ? [] : [{ code: 429, message: 'rate limited' }],
});

describe('Workers cache purge', () => {
  it('purges normalized tags once on success', async () => {
    const purge = vi.fn(async () => result(true));
    await purgeCacheTags(['shell', 'catalog', 'shell'], { purge });
    expect(purge).toHaveBeenCalledOnce();
    expect(purge).toHaveBeenCalledWith({ tags: ['catalog', 'shell'] });
  });

  it('falls back to purge-everything after a rejected tag purge', async () => {
    const purge = vi
      .fn<CachePurger['purge']>()
      .mockResolvedValueOnce(result(false))
      .mockResolvedValueOnce(result(true));
    await purgeCacheTags(['catalog'], { purge });
    expect(purge.mock.calls).toEqual([
      [{ tags: ['catalog'] }],
      [{ purgeEverything: true }],
    ]);
  });

  it('throws when both purge attempts fail', async () => {
    const purge = vi.fn(async () => result(false));
    await expect(purgeCacheTags(['catalog'], { purge })).rejects.toThrow(
      'could not be invalidated',
    );
    expect(purge).toHaveBeenCalledTimes(2);
  });

  it('purges only the affected product tags', async () => {
    const purge = vi.fn(async () => result(true));
    await purgeProductCache(['prod_z', 'prod_a', 'prod_z'], { purge });
    expect(purge).toHaveBeenCalledWith({ tags: ['product:prod_a', 'product:prod_z'] });
  });

  it('purges the complete entrypoint cache for a deployment', async () => {
    const purge = vi.fn(async () => result(true));
    await purgeEntireCache({ purge });
    expect(purge).toHaveBeenCalledOnce();
    expect(purge).toHaveBeenCalledWith({ purgeEverything: true });
  });

  it('fails a deployment purge when Cloudflare rejects it', async () => {
    const purge = vi.fn(async () => result(false));
    await expect(purgeEntireCache({ purge })).rejects.toThrow('could not be purged');
    expect(purge).toHaveBeenCalledOnce();
  });

  it('does not turn a rate-limited stock transition into purge-everything', async () => {
    const purge = vi.fn(async () => result(false));
    await expect(purgeStockProductCache(['prod_a'], { purge })).resolves.toBeUndefined();
    expect(purge).toHaveBeenCalledOnce();
    expect(purge).toHaveBeenCalledWith({ tags: ['product:prod_a'] });
  });
});

describe('runtimes without the Workers Caching purge API (astro dev, wrangler dev)', () => {
  // Measured: locally `cache` from cloudflare:workers is an empty object.
  const localCache = {} as Partial<CachePurger>;

  it('treats a missing API as nothing to invalidate, not as a failed save', async () => {
    resetPurgeAvailabilityReport();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(purgeCacheTags(['shell', 'catalog'], localCache)).resolves.toBeUndefined();
    await expect(purgeProductCache(['prod_abcdefghij'], localCache)).resolves.toBeUndefined();
    await expect(purgeStockProductCache(['prod_abcdefghij'], localCache)).resolves.toBeUndefined();
    // Said once per isolate, as a warning; never logged as a purge failure.
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toContain('workers_cache_purge_unavailable');
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });

  it('still fails loudly when the API exists and the purge fails', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const throwing = { purge: vi.fn(async () => { throw new Error('boom'); }) };
    await expect(purgeCacheTags(['catalog'], throwing)).rejects.toThrow('could not be invalidated');
    expect(throwing.purge).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('refuses an explicit post-deploy purge without the API', async () => {
    await expect(purgeEntireCache(localCache)).rejects.toThrow('not available in this runtime');
  });
});
