import { describe, expect, it } from 'vitest';
import { emailLanguage } from './email';

const multi = {
  i18n: { defaultLocale: 'en', enabledLocales: ['en', 'it'], routing: 'prefix' },
} as never;

describe('emailLanguage', () => {
  it('links in the given language, under the mount', () => {
    expect(emailLanguage(multi, 'it', 'https://x').urls.absolute('/order/t')).toBe('https://x/it/order/t');
    expect(emailLanguage(multi, 'it', 'https://x', '/shop').urls.absolute('/order/t')).toBe(
      'https://x/it/shop/order/t',
    );
    expect(emailLanguage(multi, 'en', 'https://x', '/shop').urls.absolute('/order/t')).toBe(
      'https://x/shop/order/t',
    );
  });

  it('leaves a single-language store exactly as before', () => {
    const { i18n, urls } = emailLanguage(undefined, 'en', 'https://x');
    expect(i18n.locale).toBe('en');
    expect(urls.absolute('/order/t')).toBe('https://x/order/t');
  });

  it('keeps the text language when the store no longer serves it, but links to the default', () => {
    const { i18n, urls } = emailLanguage(undefined, 'it', 'https://x', '/shop');
    expect(i18n.locale).toBe('it');
    expect(urls.absolute('/order/t')).toBe('https://x/shop/order/t');
  });
});
