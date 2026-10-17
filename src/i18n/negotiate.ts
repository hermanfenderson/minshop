/**
 * Accept-Language negotiation against the enabled languages. Used only to
 * SUGGEST a language (the home-page redirect when `detect` is 'root'); it
 * never changes what an URL serves.
 */

export interface LanguageRange {
  tag: string; // lowercase: 'it-it', 'en'
  q: number;
}

const MAX_HEADER = 1024;
const MAX_RANGES = 20;

/** Parse a header into ranges, best first; '*', q=0 and malformed entries are dropped. */
export function parseAcceptLanguage(header: string | null | undefined): LanguageRange[] {
  if (!header) return [];
  const ranges: LanguageRange[] = [];
  for (const part of header.slice(0, MAX_HEADER).split(',').slice(0, MAX_RANGES)) {
    const [rawTag, ...attrs] = part.trim().split(';');
    const tag = rawTag.trim().toLowerCase().replace(/_/g, '-');
    if (!/^[a-z]{1,8}(-[a-z0-9]{1,8})*$/.test(tag)) continue;
    let q = 1;
    for (const attr of attrs) {
      const [k, v] = attr.trim().split('=');
      if (k === 'q') q = Number(v);
    }
    if (Number.isFinite(q) && q > 0 && q <= 1) ranges.push({ tag, q });
  }
  // Stable sort keeps header order among equal weights.
  return ranges.map((r, i) => ({ r, i })).sort((a, b) => b.r.q - a.r.q || a.i - b.i).map(({ r }) => r);
}

/**
 * The best enabled language for a header: an exact match, then the range's
 * base language ('it-ch' → 'it'), then an enabled regional variant of a bare
 * range ('pt' → 'pt-br'). Null when nothing matches.
 */
export function negotiateLocale(header: string | null | undefined, enabled: readonly string[]): string | null {
  for (const { tag } of parseAcceptLanguage(header)) {
    if (enabled.includes(tag)) return tag;
    const base = tag.split('-')[0];
    if (enabled.includes(base)) return base;
    const regional = enabled.find((code) => code.split('-')[0] === base);
    if (regional) return regional;
  }
  return null;
}
