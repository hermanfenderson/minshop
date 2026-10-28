import { describe, expect, it } from 'vitest';
import { BUNDLED_CATALOGS, BUNDLED_VOCABULARIES, SOURCE_CATALOG } from './catalog.ts';
import { placeholders } from './check.ts';
import type { Message } from './format.ts';
import { createI18n } from './translator.ts';

const benefit = BUNDLED_VOCABULARIES.benefit;

// The areas supporters read: pages, cart, checkout, order page, account, emails, llms.txt.
const SUPPORTER_AREAS = ['storefront', 'catalog', 'cart', 'checkout', 'order', 'email', 'llms', 'account', 'common', 'benefit'];

// Shop words that Benefit Mode must never say, per language, and «contribution»:
// supporters make a donation (owner's choice, 2026-10-28). Placeholders are
// stripped first ({price} is a value, not a word).
const SHOP_WORDS: Record<string, RegExp> = {
  en: /\bprices?\b|\bshop|\bstore\b|purchas|\bbuy|\borders?\b|\bcarts?\b|checkout|discount|\bproducts?\b|contribut/i,
  it: /prezz|negozi|acquist|carrell|\bordin[ei]\b|\bcassa\b|sconto|prodott|contribu/i,
};

// Messages a supporter never reads in Benefit Mode, so they keep the shop's words.
const NOT_FOR_SUPPORTERS = [
  'checkout.setup.', // the owner's setup page for an unconfigured rail
  'checkout.demo.',
  'checkout.method.demo.',
  'checkout.pay.demo',
  'checkout.rail.demo',
  'checkout.lightning.expired', // Lightning is not offered in Benefit Mode
  'checkout.pay.lightningDescription',
  'checkout.error.invalidProductId', // an API error for developers
];
const exempt = (key: string) => NOT_FOR_SUPPORTERS.some((p) => key.startsWith(p)) && key !== 'checkout.setup.back';

const texts = (message: Message | undefined): string[] =>
  message === undefined ? [] : typeof message === 'string' ? [message] : Object.values(message);
const words = (text: string) => text.replace(/\{[a-zA-Z_]+\}/g, '').replace(/JSON checkout endpoint|endpoint JSON di checkout/g, '');

describe('benefit vocabulary', () => {
  it('replaces only real messages, with the same placeholders', () => {
    for (const [locale, vocabulary] of Object.entries(benefit)) {
      for (const [key, message] of Object.entries(vocabulary)) {
        expect(SOURCE_CATALOG[key], `${locale} ${key}`).toBeDefined();
        const source = new Set(texts(SOURCE_CATALOG[key]).flatMap(placeholders));
        for (const text of texts(message)) {
          for (const name of placeholders(text)) expect(source.has(name), `${locale} ${key} {${name}}`).toBe(true);
        }
      }
    }
  });

  it('has the same words in every language', () => {
    expect(Object.keys(benefit.it).sort()).toEqual(Object.keys(benefit.en).sort());
  });

  it('speaks of donations, never of prices, purchases or orders', () => {
    for (const [locale, vocabulary] of Object.entries(benefit)) {
      for (const [key, message] of Object.entries(vocabulary)) {
        for (const text of texts(message)) expect(words(text), `${locale} ${key}`).not.toMatch(SHOP_WORDS[locale]);
      }
    }
  });

  it('leaves no shop word where supporters read', () => {
    const missed: string[] = [];
    for (const [locale, catalog] of Object.entries(BUNDLED_CATALOGS)) {
      const i18n = createI18n(locale, { vocabulary: 'benefit' });
      for (const key of Object.keys(SOURCE_CATALOG)) {
        if (!SUPPORTER_AREAS.includes(key.split('.')[0]) || exempt(key)) continue;
        if (catalog[key as keyof typeof catalog] === undefined && locale !== 'en') continue;
        const shown = i18n.t(key as never, { count: 2 });
        if (SHOP_WORDS[locale].test(words(shown))) missed.push(`${locale} ${key}: ${shown}`);
      }
    }
    expect(missed).toEqual([]);
  });

  it('wins over the catalog in the same language, and only when asked for', () => {
    expect(createI18n('it', { vocabulary: 'benefit' }).t('catalog.sort.price')).toBe('Donazione minima');
    expect(createI18n('it').t('catalog.sort.price')).toBe('Prezzo');
    expect(createI18n('en', { vocabulary: 'benefit' }).t('storefront.nav.shop')).toBe('Support');
  });
});
