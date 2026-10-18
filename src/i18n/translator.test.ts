import { describe, expect, it } from 'vitest';
import { createLocaleRegistry } from './locales.ts';
import { createI18n, enI18n } from './translator.ts';

describe('createI18n', () => {
  it('translates bundled languages', () => {
    expect(enI18n.t('common.pagination.next')).toBe('Next');
    expect(createI18n('it').t('common.pagination.next')).toBe('Successiva');
    expect(createI18n('it').t('common.language.switchTo', { language: 'English' })).toBe(
      'Visualizza questa pagina in English',
    );
  });

  it('uses each language its own plural rules', () => {
    expect(enI18n.t('common.items', { count: 1 })).toBe('1 item');
    expect(enI18n.t('common.items', { count: 3 })).toBe('3 items');
    expect(createI18n('it').t('common.items', { count: 1 })).toBe('1 articolo');
    expect(createI18n('it').t('common.items', { count: 3 })).toBe('3 articoli');
  });

  it('falls back key by key along the chain', () => {
    const registry = createLocaleRegistry({ fr: { label: 'Français', intl: 'fr-FR', dir: 'ltr' } });
    const fr = createI18n('fr', {
      registry,
      catalogs: { en: { 'common.pagination.next': 'Next', 'common.pagination.prev': 'Prev' }, fr: { 'common.pagination.next': 'Suivant' } },
    });
    expect(fr.t('common.pagination.next')).toBe('Suivant');
    expect(fr.t('common.pagination.prev')).toBe('Prev');
    expect(fr.chain).toEqual(['fr', 'en']);
    expect(fr.money(1999, 'eur')).toBe('19,99 €');
  });

  it('prefers the tail (e.g. the store default) over English', () => {
    const registry = createLocaleRegistry({ fr: { label: 'Français', intl: 'fr-FR', dir: 'ltr' } });
    const fr = createI18n('fr', { registry, tail: ['it'] });
    expect(fr.chain).toEqual(['fr', 'it', 'en']);
    expect(fr.t('common.pagination.next')).toBe('Successiva');
  });

  it('degrades an unsupported language to English instead of failing', () => {
    const xx = createI18n('xx');
    expect(xx.locale).toBe('en');
    expect(xx.t('common.pagination.next')).toBe('Next');
  });

  it('keeps en-US formatting for English', () => {
    expect(enI18n.money(1999, 'usd')).toBe('$19.99');
    expect(enI18n.intl).toBe('en-US');
    expect(enI18n.dir).toBe('ltr');
  });

  it('caches built-in translators', () => {
    expect(createI18n('it')).toBe(createI18n('it'));
    expect(createI18n('it', { tail: ['en'] })).not.toBe(createI18n('it'));
  });
});
