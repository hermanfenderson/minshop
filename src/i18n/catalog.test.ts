import { describe, expect, it } from 'vitest';
import { BUNDLED_CATALOGS, SOURCE_CATALOG } from './catalog.ts';
import { checkCatalog, checkSourceCatalog, placeholders } from './check.ts';
import { BUILTIN_LOCALES } from './locales.ts';

describe('bundled catalogs', () => {
  it('the English source follows the key and plural rules', () => {
    expect(checkSourceCatalog(SOURCE_CATALOG)).toEqual([]);
  });

  for (const [code, catalog] of Object.entries(BUNDLED_CATALOGS)) {
    if (code === 'en') continue;
    it(`${code}: no placeholder, plural or unknown-key errors`, () => {
      const report = checkCatalog(catalog, BUILTIN_LOCALES[code].intl, SOURCE_CATALOG);
      expect(report.errors).toEqual([]);
      // Missing keys only fall back to English: report them, never fail on them.
      if (report.missing.length) {
        console.warn(`i18n: ${code} translates ${Math.round(report.coverage * 100)}% (${report.missing.length} missing)`);
      }
    });
  }

  it('every bundled catalog belongs to a registered language', () => {
    for (const code of Object.keys(BUNDLED_CATALOGS)) expect(BUILTIN_LOCALES).toHaveProperty(code);
  });
});

describe('checkCatalog', () => {
  const source = {
    'a.hello': 'Hello {name}',
    'a.items': { one: '{count} item', other: '{count} items' },
    'a.bye': 'Bye',
  };

  it('reports placeholder mismatches, plural gaps and unknown keys as errors', () => {
    const report = checkCatalog(
      {
        'a.hello': 'Ciao {nome}',
        'a.items': { one: '{count} articolo', other: '{count} articoli' }, // Italian also needs `many`
        'a.extra': 'x',
      },
      'it-IT',
      source,
    );
    expect(report.errors).toEqual([
      'a.hello: placeholders {nome} differ from English {name}',
      'a.items: missing plural form "many"',
      'a.extra: not a key of the English catalog',
    ]);
  });

  it('reports a plain string where English has plural forms', () => {
    expect(checkCatalog({ 'a.items': '{count} articoli' }, 'it-IT', source).errors).toEqual([
      'a.items: English is a plural message, the translation is not',
    ]);
  });

  it('reports missing keys as coverage, not errors', () => {
    const report = checkCatalog({ 'a.bye': 'Ciao' }, 'it-IT', source);
    expect(report.errors).toEqual([]);
    expect(report.missing).toEqual(['a.hello', 'a.items']);
    expect(report.coverage).toBeCloseTo(1 / 3);
  });

  it('collects placeholders across plural forms', () => {
    expect(placeholders({ one: '{count} {unit}', other: '{count} {unit}s' })).toEqual(['count', 'unit']);
  });

  it('flags malformed source keys and plurals without `other`', () => {
    expect(checkSourceCatalog({ Bad: 'x', 'a.p': { one: 'x' } as never })).toEqual([
      'Bad: keys are "area.name"',
      'a.p: plural message without an "other" form',
    ]);
  });
});
