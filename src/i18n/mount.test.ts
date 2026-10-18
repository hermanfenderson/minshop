import { describe, expect, it } from 'vitest';
import { joinMount, mountToBase, normalizeMountPath, stripMount } from './mount.ts';

describe('normalizeMountPath', () => {
  it('reduces every spelling of the root to ""', () => {
    for (const root of ['/', '', '//', ' / ']) expect(normalizeMountPath(root)).toBe('');
  });

  it('drops leading and trailing slashes', () => {
    expect(normalizeMountPath('/shop/')).toBe('/shop');
    expect(normalizeMountPath('shop')).toBe('/shop');
    expect(normalizeMountPath('/store/eu')).toBe('/store/eu');
  });

  it('rejects what cannot be a path', () => {
    for (const bad of ['/shop?x=1', '/sh op', '/../x', '/./x', '/a//b', '/shop#top']) {
      expect(() => normalizeMountPath(bad), bad).toThrow(/mount path/);
    }
  });

  it('gives Astro its base', () => {
    expect(mountToBase('')).toBe('/');
    expect(mountToBase('/shop')).toBe('/shop');
  });
});

describe('stripMount / joinMount', () => {
  it('maps public paths under the mount to logical paths', () => {
    expect(stripMount('/shop', '/shop')).toBe('/');
    expect(stripMount('/shop/', '/shop')).toBe('/');
    expect(stripMount('/shop/products/mug', '/shop')).toBe('/products/mug');
  });

  it('returns null outside the mount, including look-alike prefixes', () => {
    expect(stripMount('/', '/shop')).toBeNull();
    expect(stripMount('/shopping', '/shop')).toBeNull();
    expect(stripMount('/blog/post', '/shop')).toBeNull();
  });

  it('is the identity at the root mount', () => {
    expect(stripMount('/products/mug', '')).toBe('/products/mug');
    expect(stripMount('/', '')).toBe('/');
  });

  it('joins and round-trips', () => {
    expect(joinMount('/shop', '/')).toBe('/shop/');
    expect(joinMount('/shop', '/cart')).toBe('/shop/cart');
    expect(joinMount('', '/cart')).toBe('/cart');
    expect(joinMount('', '/')).toBe('/');
    for (const path of ['/', '/cart', '/products/a-b']) {
      expect(stripMount(joinMount('/shop', path), '/shop')).toBe(path);
    }
  });
});
