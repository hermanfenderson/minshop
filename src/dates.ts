/**
 * Pure date formatting — imports only the pure ./money module, so unit-tested
 * code can use it without the Cloudflare runtime. `config.formatDate` adds the
 * store time-zone default on top, which is the only part that reads settings.
 */
import { DEFAULT_INTL } from './money';

/**
 * Format a stored UTC timestamp in a time zone and an Intl locale tag. Accepts
 * SQLite's `datetime('now')` format ("YYYY-MM-DD HH:MM:SS", UTC) or any ISO
 * string; returns '' for null/empty and the raw input if it can't be parsed.
 */
export function formatTimestamp(
  value: string | null | undefined,
  opts: Intl.DateTimeFormatOptions,
  timeZone: string,
  intl: string = DEFAULT_INTL,
): string {
  if (!value) return '';
  // SQLite stores UTC without a zone marker; make it explicit so it isn't parsed
  // as local time. (Our timestamps never contain 'T' or 'Z'.)
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(intl, { timeZone, ...opts }).format(d);
  } catch {
    // A bad deployment override should never break an order/admin page.
    return new Intl.DateTimeFormat(intl, { timeZone: 'UTC', ...opts }).format(d);
  }
}
