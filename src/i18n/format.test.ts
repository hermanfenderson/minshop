// Formatter cases adapted from ddyy/minshop#60 (Luca G.).
import { describe, expect, it } from 'vitest';
import { createTranslator, escapeHtml, formatMessage } from './format';

describe('formatMessage', () => {
  it('fills placeholders and leaves unknown ones visible', () => {
    expect(formatMessage('Hi {name}, {name}!', 'en-US', { name: 'Ada' })).toBe('Hi Ada, Ada!');
    expect(formatMessage('Hi {name}', 'en-US', {})).toBe('Hi {name}');
    expect(formatMessage('Hi {name}', 'en-US')).toBe('Hi {name}');
    expect(formatMessage('{n} left', 'en-US', { n: 0 })).toBe('0 left');
  });

  it('does not treat inherited object properties as params', () => {
    expect(formatMessage('{toString}', 'en-US', {})).toBe('{toString}');
  });

  it('picks CLDR plural forms per locale, falling back to `other`', () => {
    const pl = { one: '{count} produkt', few: '{count} produkty', many: '{count} produktów', other: '{count} produktu' };
    expect([1, 2, 5, 22, 25].map((count) => formatMessage(pl, 'pl-PL', { count }))).toEqual([
      '1 produkt',
      '2 produkty',
      '5 produktów',
      '22 produkty',
      '25 produktów',
    ]);
    expect(formatMessage(pl, 'pl-PL', { count: 1.5 })).toBe('1.5 produktu');
    expect(formatMessage({ one: '{count} item', other: '{count} items' }, 'en-US', { count: 1 })).toBe('1 item');
    expect(formatMessage({ other: '{count} articoli' }, 'it-IT', { count: 1 })).toBe('1 articoli');
    expect(formatMessage({ one: '{count} item', other: '{count} items' }, 'en-US')).toBe('{count} items');
  });

  it('escapes params, never the trusted message, for markup', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    expect(formatMessage('<b>{name}</b>', 'en-US', { name: '<i>' }, true)).toBe('<b>&lt;i&gt;</b>');
    expect(formatMessage('<b>{name}</b>', 'en-US', { name: '<i>' })).toBe('<b><i></b>');
  });
});

describe('createTranslator', () => {
  const t = createTranslator<'a.hello' | 'a.missing'>('it', 'it-IT', (key) =>
    key === 'a.hello' ? 'Ciao {name}' : undefined,
  );

  it('translates known keys and renders unknown ones as the key', () => {
    expect(t.t('a.hello', { name: 'Ada' })).toBe('Ciao Ada');
    expect(t.t('a.missing')).toBe('a.missing');
    expect(t.th('a.hello', { name: '<b>' })).toBe('Ciao &lt;b&gt;');
  });

  it('formats money, numbers and dates in its Intl locale', () => {
    expect(t.money(14900, 'eur')).toBe('149,00 €');
    expect(t.number(12345.5)).toBe('12.345,5');
    expect(t.date('2026-10-17 08:00:00', { dateStyle: 'medium' }, 'Europe/Rome')).toBe('17 ott 2026');
  });
});
