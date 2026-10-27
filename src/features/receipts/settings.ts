/**
 * Receipt settings (R11/R12): who issues the documents, how they are numbered,
 * what they say and which images they carry. All of it lives in D1 and is
 * edited in Admin → Receipts, so a shop sets its own legal wording
 * without touching code — the code ships placeholders only.
 *
 * Keys:
 *   receipt_prefix                     printed before contribution receipt numbers ("W" → W12/2027)
 *   receipt_prefix:<series>            the same for 'shipping' and 'refund_note'; absent = the
 *                                      contribution prefix plus S or R, so no two series print
 *                                      the same label (W1/2027, WS1/2027, WR1/2027)
 *   receipt_issuer                     the issuer block, one line per line; the
 *                                      first line is the issuer's name
 *   receipt_stamp_key / receipt_logo_key   media image keys (JPEG)
 *   receipt_text:<slot>:<locale>       wording per document and language
 */

export const RECEIPT_TEXT_SLOTS = ['donation:person', 'donation:company', 'shipping', 'refund_note', 'footer'] as const;
export type ReceiptTextSlot = (typeof RECEIPT_TEXT_SLOTS)[number];

/** Each series is numbered on its own. */
export type ReceiptSeries = 'donation' | 'shipping' | 'refund_note';

const SERIES_SUFFIX: Record<Exclude<ReceiptSeries, 'donation'>, string> = { shipping: 'S', refund_note: 'R' };

export interface ReceiptSettings {
  /** The contribution receipts' prefix, and the base of the others' defaults. */
  prefix: string;
  /** Explicit prefixes for the other series. */
  seriesPrefixes: Partial<Record<Exclude<ReceiptSeries, 'donation'>, string>>;
  /** Issuer block lines; empty = not configured, and nothing is issued. */
  issuer: string[];
  stampKey: string | null;
  logoKey: string | null;
  /** `${slot}:${locale}` → text with {placeholders}. */
  texts: Record<string, string>;
}

export const RECEIPT_SETTINGS_SQL = "SELECT key, value FROM settings WHERE key LIKE 'receipt\\_%' ESCAPE '\\'";

const TEXT_KEY = new RegExp(`^receipt_text:(${RECEIPT_TEXT_SLOTS.join('|')}):([a-z]{2,3}(?:-[a-z0-9]+)*)$`, 'i');

export const receiptTextKey = (slot: ReceiptTextSlot, locale: string) =>
  `receipt_text:${slot}:${locale.toLowerCase()}` as const;

/** The prefix keeps to letters, digits and a few separators, so labels stay printable. */
export function normalizePrefix(raw: string | null | undefined): string {
  return (raw ?? '').trim().replace(/[^A-Za-z0-9\-_.]/g, '').slice(0, 12);
}

export function parseReceiptSettings(rows: Iterable<{ key: string; value: string }>): ReceiptSettings {
  const settings: ReceiptSettings = { prefix: '', seriesPrefixes: {}, issuer: [], stampKey: null, logoKey: null, texts: {} };
  for (const { key, value } of rows) {
    if (key === 'receipt_prefix') settings.prefix = normalizePrefix(value);
    else if (key === 'receipt_prefix:shipping' || key === 'receipt_prefix:refund_note') {
      const prefix = normalizePrefix(value);
      if (prefix) settings.seriesPrefixes[key.slice('receipt_prefix:'.length) as 'shipping' | 'refund_note'] = prefix;
    } else if (key === 'receipt_issuer') {
      settings.issuer = value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    } else if (key === 'receipt_stamp_key') settings.stampKey = value || null;
    else if (key === 'receipt_logo_key') settings.logoKey = value || null;
    else {
      const m = TEXT_KEY.exec(key);
      if (m && value.trim()) settings.texts[`${m[1]}:${m[2].toLowerCase()}`] = value.replace(/\r\n/g, '\n').trim();
    }
  }
  return settings;
}

/** The configured text for a slot in a language, or null (the caller uses the placeholder). */
export function receiptText(settings: ReceiptSettings, slot: ReceiptTextSlot, locale: string): string | null {
  return settings.texts[`${slot}:${locale.toLowerCase()}`] ?? null;
}

/** The prefix a series prints. */
export function seriesPrefix(settings: ReceiptSettings, series: ReceiptSeries): string {
  if (series === 'donation') return settings.prefix;
  return settings.seriesPrefixes[series] ?? `${settings.prefix}${SERIES_SUFFIX[series]}`;
}

/** "W12/2027"; with no prefix "12/2027". */
export function receiptLabel(prefix: string, number: number, year: number): string {
  return `${prefix}${number}/${year}`;
}
