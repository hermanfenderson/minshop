/**
 * The calendar day of an instant in the store's time zone, YYYY-MM-DD. A
 * receipt's date and its annual series follow the shop's clock, not UTC: an
 * order paid at 00:30 on 1 January in Rome belongs to the new year.
 */
export function localDay(value: string, timeZone: string): string {
  // D1's datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    new Date(iso),
  );
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
