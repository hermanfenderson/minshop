import { describe, expect, it } from 'vitest';
import { formatTimestamp } from './dates';

const DATE = { dateStyle: 'medium' } as const;
const DATE_TIME = { dateStyle: 'medium', timeStyle: 'short' } as const;

describe('formatTimestamp', () => {
  it('reads SQLite UTC timestamps as UTC, not local time', () => {
    expect(formatTimestamp('2026-10-17 22:30:00', DATE_TIME, 'UTC')).toBe('Oct 17, 2026, 10:30 PM');
    expect(formatTimestamp('2026-10-17 22:30:00', DATE, 'Europe/Rome')).toBe('Oct 18, 2026');
  });

  it('accepts ISO strings', () => {
    expect(formatTimestamp('2026-10-17T08:00:00Z', DATE_TIME, 'UTC')).toBe('Oct 17, 2026, 8:00 AM');
  });

  it('formats in the given Intl locale', () => {
    expect(formatTimestamp('2026-10-17 08:00:00', DATE, 'Europe/Rome', 'it-IT')).toBe('17 ott 2026');
    expect(formatTimestamp('2026-10-17 08:00:00', { dateStyle: 'long' }, 'UTC', 'it-IT')).toBe(
      '17 ottobre 2026',
    );
  });

  it('returns empty for missing values and the raw input when unparseable', () => {
    expect(formatTimestamp(null, DATE, 'UTC')).toBe('');
    expect(formatTimestamp('', DATE, 'UTC')).toBe('');
    expect(formatTimestamp('not a date', DATE, 'UTC')).toBe('not a date');
  });

  it('falls back to UTC on an invalid time zone instead of throwing', () => {
    expect(formatTimestamp('2026-10-17 08:00:00', DATE, 'Mars/Olympus')).toBe('Oct 17, 2026');
  });
});
