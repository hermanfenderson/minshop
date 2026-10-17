/**
 * No internal URL may be written by hand: under a mount ('/shop') a literal
 * '/cart' leaves the store, and once languages land it would also drop the
 * language. Links, form actions, redirects, client fetches and absolute URLs
 * go through the URL builder (Astro.locals.urls, storeUrls(), withMount()).
 *
 * Logical paths themselves are fine — route checks compare them, and builders
 * take them as input — so this only flags the places a path becomes a URL.
 */
import { describe, expect, it } from 'vitest';

const SOURCES = import.meta.glob<string>(['/src/**/*.astro', '/src/**/*.ts', '!/src/**/*.test.ts', '!/src/i18n/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

interface Rule {
  name: string;
  pattern: RegExp;
  /** Files where the construct is already routed through the builder. */
  allowedIn?: (source: string) => boolean;
}

const RULES: Rule[] = [
  { name: 'literal root-relative attribute', pattern: /\b(?:href|action|src|formaction)="\/(?!\/)/ },
  { name: 'literal root-relative attribute expression', pattern: /\b(?:href|action|src|formaction)=\{\s*['`]\/(?!\/)/ },
  { name: 'Astro.redirect to a literal path', pattern: /Astro\.redirect\(\s*['`]\/(?!\/)/ },
  {
    name: 'redirect to a literal path',
    pattern: /(?<![.\w])redirect\(\s*['`]\/(?!\/)/,
    // Handlers that rebind `redirect` to the mount-aware wrapper.
    allowedIn: (s) => /mountedRedirect\(astroRedirect\)|astroRedirect\(urls\.href\(/.test(s),
  },
  { name: 'fetch of a literal path', pattern: /\bfetch\(\s*['`]\/(?!\/)/ },
  // /cdn-cgi/ is Cloudflare's zone-level path: always at the host root, never mounted.
  { name: 'origin + literal path', pattern: /\$\{[\w.]*origin\}\/(?!cdn-cgi\/)/ },
  { name: 'new URL from a literal path', pattern: /new URL\(\s*['`]\/(?!\/)/ },
];

describe('no hand-written internal URLs', () => {
  it('scans the app sources', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
  });

  for (const rule of RULES) {
    it(rule.name, () => {
      const offenders: string[] = [];
      for (const [file, source] of Object.entries(SOURCES)) {
        if (rule.allowedIn?.(source)) continue;
        source.split('\n').forEach((line, i) => {
          const code = line.trimStart();
          if (code.startsWith('*') || code.startsWith('//')) return; // comments
          if (rule.pattern.test(line)) offenders.push(`${file}:${i + 1}: ${code.slice(0, 120)}`);
        });
      }
      expect(offenders).toEqual([]);
    });
  }
});
