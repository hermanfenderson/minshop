import { describe, expect, it } from 'vitest';
import { instanceNoindex } from './robots';

describe('instanceNoindex', () => {
  it('is off when the var is unset or falsy', () => {
    expect(instanceNoindex(undefined)).toBe(false);
    expect(instanceNoindex('')).toBe(false);
    expect(instanceNoindex('0')).toBe(false);
    expect(instanceNoindex('false')).toBe(false);
  });

  it('accepts the usual truthy spellings', () => {
    for (const value of ['1', 'true', 'TRUE', ' yes ', 'on']) {
      expect(instanceNoindex(value)).toBe(true);
    }
  });
});
