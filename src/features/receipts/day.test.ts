import { describe, expect, it } from 'vitest';
import { localDay } from './day';

describe('localDay', () => {
  it('reads D1 timestamps as UTC and dates them in the store zone', () => {
    expect(localDay('2026-12-31 23:30:00', 'Europe/Rome')).toBe('2027-01-01');
    expect(localDay('2026-12-31 23:30:00', 'UTC')).toBe('2026-12-31');
  });

  it('accepts ISO instants', () => {
    expect(localDay('2027-03-17T10:00:00.000Z', 'America/New_York')).toBe('2027-03-17');
  });
});
