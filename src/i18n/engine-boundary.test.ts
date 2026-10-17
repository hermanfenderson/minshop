/**
 * The i18n engine must stay pure: no Cloudflare runtime, no Astro, no config
 * or feature modules. It may import only its own files and the pure
 * formatting modules ../money and ../dates; tests may also use vitest.
 *
 * Sources are read through Vite's import.meta.glob, so the check needs no
 * Node typings and sees exactly the files the bundler would.
 */
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>('./**/*.ts', { query: '?raw', import: 'default', eager: true });
const ALLOWED_OUTSIDE = new Set(['money', 'dates']);

function specifiers(source: string): string[] {
  const found = [
    ...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...source.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm),
  ];
  return found.map((m) => m[1]);
}

describe('i18n engine boundary', () => {
  it('finds the engine sources', () => {
    expect(Object.keys(SOURCES)).toContain('./translator.ts');
  });

  for (const [file, source] of Object.entries(SOURCES)) {
    const isTest = file.endsWith('.test.ts');
    it(`${file} imports only allowed modules`, () => {
      for (const spec of specifiers(source)) {
        if (isTest && spec === 'vitest') continue;
        expect(spec.startsWith('.'), `${file}: "${spec}" is not a relative import`).toBe(true);
        const depth = file.split('/').length - 2; // folders below src/i18n
        const ups = spec.split('/').filter((s) => s === '..').length;
        if (ups <= depth) continue; // stays inside src/i18n
        // One level above the engine is src/: only the pure formatting modules.
        const target = spec.split('/').filter((s) => s !== '..').join('/').replace(/\.ts$/, '');
        expect(ups === depth + 1 && ALLOWED_OUTSIDE.has(target), `${file}: "${spec}" leaves the engine`).toBe(true);
      }
    });
  }
});
