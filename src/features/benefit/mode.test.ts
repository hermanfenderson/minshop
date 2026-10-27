import { describe, expect, it } from 'vitest';
import { benefitRules, isSingleUnitContribution } from './mode';
import { PROVIDER_MAX_MINOR } from './amount';

describe('benefitRules', () => {
  it('is null in standard mode, so nothing changes there', () => {
    expect(benefitRules(undefined, 'EUR')).toBeNull();
    expect(benefitRules({ commerceMode: 'standard', contributionCapCents: 500 }, 'EUR')).toBeNull();
  });

  it('defaults the cap to 10,000 in major units, and keeps a configured one', () => {
    expect(benefitRules({ commerceMode: 'benefit', contributionCapCents: null }, 'EUR')).toEqual({ capCents: 1_000_000 });
    expect(benefitRules({ commerceMode: 'benefit', contributionCapCents: null }, 'JPY')).toEqual({ capCents: 10_000 });
    expect(benefitRules({ commerceMode: 'benefit', contributionCapCents: 50_000 }, 'EUR')).toEqual({ capCents: 50_000 });
    expect(benefitRules({ commerceMode: 'benefit', contributionCapCents: 10 ** 12 }, 'EUR')).toEqual({ capCents: PROVIDER_MAX_MINOR });
  });
});

describe('isSingleUnitContribution', () => {
  it('is a product with no stock, no shipping and no file', () => {
    expect(isSingleUnitContribution({ track_inventory: 0, requires_shipping: 0, file_key: null })).toBe(true);
    expect(isSingleUnitContribution({ track_inventory: 1, requires_shipping: 0, file_key: null })).toBe(false);
    expect(isSingleUnitContribution({ track_inventory: 0, requires_shipping: 1, file_key: null })).toBe(false);
    expect(isSingleUnitContribution({ track_inventory: 0, requires_shipping: 0, file_key: 'f/x.pdf' })).toBe(false);
  });
});
