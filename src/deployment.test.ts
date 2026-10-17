import { describe, expect, it } from 'vitest';
import { normalizeBase, resolveDeployment } from '../scripts/deployment.mjs';
import { COOKIE_PREFIX, MOUNT, cookieName, logicalPath } from './deployment';

describe('build-time deployment settings', () => {
  it('defaults to a root mount and unprefixed cookies (existing installs)', () => {
    expect(resolveDeployment({}, {})).toEqual({ mountPath: '/', cookiePrefix: '' });
  });

  it('reads store.config, and lets the build variables override it', () => {
    expect(resolveDeployment({}, { mountPath: '/shop/', cookiePrefix: 'minshop_' })).toEqual({
      mountPath: '/shop',
      cookiePrefix: 'minshop_',
    });
    expect(
      resolveDeployment({ MINSHOP_MOUNT_PATH: 'store', MINSHOP_COOKIE_PREFIX: 'x_' }, { mountPath: '/shop' }),
    ).toEqual({ mountPath: '/store', cookiePrefix: 'x_' });
  });

  it('rejects mounts and prefixes that would break URLs or cookies', () => {
    expect(() => normalizeBase('/sh op')).toThrow(/mountPath/);
    expect(() => normalizeBase('/../x')).toThrow(/mountPath/);
    expect(() => resolveDeployment({ MINSHOP_COOKIE_PREFIX: 'a;b' }, {})).toThrow(/cookiePrefix/);
  });
});

describe('runtime view of the deployment (unit tests: root mount, no prefix)', () => {
  it('sees the build as the defaults', () => {
    expect(MOUNT).toBe('');
    expect(COOKIE_PREFIX).toBe('');
    expect(cookieName('cart')).toBe('cart');
  });

  it('maps request paths to logical paths under a mount', () => {
    expect(logicalPath('/cart')).toBe('/cart');
    expect(logicalPath('/shop/admin/login', '/shop')).toBe('/admin/login');
    expect(logicalPath('/shop', '/shop')).toBe('/');
    expect(logicalPath('/blog', '/shop')).toBeNull();
  });
});
