import { describe, expect, it } from 'vitest';
import { responseCacheTags } from '../cache/tags';
import { translationPurgeTags } from './cache';

describe('translationPurgeTags', () => {
  it('purges a product page and every list showing it', () => {
    expect(translationPurgeTags('product', 'prod_abc')).toEqual(['catalog', 'product:prod_abc']);
  });

  it('purges shell content (pages, menus, announcement) through the shell tag', () => {
    for (const scope of ['page', 'menu', 'announcement'] as const) {
      expect(translationPurgeTags(scope, null)).toEqual(['shell']);
    }
  });

  it('reaches every language version, because every storefront document carries the shared tags', () => {
    // A purge clears both /products/x and /it/products/x only if both carry
    // what it names: the route-family tags are language-blind.
    const tags = responseCacheTags('/products/x', 200);
    expect(tags).toEqual(expect.arrayContaining(['shell', 'catalog']));
    for (const scope of ['product', 'category', 'page', 'menu', 'announcement'] as const) {
      const purged = translationPurgeTags(scope, 'prod_x').filter((t) => !t.startsWith('product:'));
      expect(purged.every((t) => tags.includes(t))).toBe(true);
    }
  });
});
