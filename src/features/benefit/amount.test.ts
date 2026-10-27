import { describe, expect, it } from 'vitest';
import {
  PROVIDER_MAX_MINOR,
  amountInputStep,
  amountInputValue,
  checkContribution,
  maximumCents,
  parseAmountInput,
  readContribution,
} from './amount';

describe('parseAmountInput', () => {
  it('reads major units into minor units, with a dot or a decimal comma', () => {
    expect(parseAmountInput('25', 'EUR')).toEqual({ ok: true, cents: 2500 });
    expect(parseAmountInput(' 25.5 ', 'EUR')).toEqual({ ok: true, cents: 2550 });
    expect(parseAmountInput('25,50', 'eur')).toEqual({ ok: true, cents: 2550 });
    expect(parseAmountInput('0.07', 'EUR')).toEqual({ ok: true, cents: 7 });
    expect(parseAmountInput('25.500', 'EUR')).toEqual({ ok: true, cents: 2550 });
  });

  it('follows the currency precision (JPY, BHD)', () => {
    expect(parseAmountInput('1000', 'JPY')).toEqual({ ok: true, cents: 1000 });
    expect(parseAmountInput('1000.5', 'JPY')).toEqual({ ok: false, problem: 'precision' });
    expect(parseAmountInput('1.234', 'BHD')).toEqual({ ok: true, cents: 1234 });
    expect(parseAmountInput('25.505', 'EUR')).toEqual({ ok: false, problem: 'precision' });
  });

  it('refuses anything it would have to guess at', () => {
    for (const raw of ['', ' ', '-5', '+5', '1e3', '1.000,50', '1,000.50', 'abc', '5 €', '.5', null, undefined]) {
      expect(parseAmountInput(raw, 'EUR')).toEqual({ ok: false, problem: 'invalid' });
    }
  });
});

describe('checkContribution', () => {
  it('accepts the minimum itself and anything above it, up to the ceiling', () => {
    expect(checkContribution(2000, 2000, 1_000_000)).toEqual({ ok: true, cents: 2000 });
    expect(checkContribution(1_000_000, 2000, 1_000_000)).toEqual({ ok: true, cents: 1_000_000 });
    expect(checkContribution(1999, 2000, 1_000_000)).toEqual({ ok: false, problem: 'below_minimum' });
    expect(checkContribution(1_000_001, 2000, 1_000_000)).toEqual({ ok: false, problem: 'above_maximum' });
  });

  it('never lets the store cap exceed what the provider can charge', () => {
    expect(maximumCents(null)).toBe(PROVIDER_MAX_MINOR);
    expect(maximumCents(0)).toBe(PROVIDER_MAX_MINOR);
    expect(maximumCents(10 ** 12)).toBe(PROVIDER_MAX_MINOR);
    expect(checkContribution(-1, 0, null)).toEqual({ ok: false, problem: 'invalid' });
    expect(checkContribution(1.5, 0, null)).toEqual({ ok: false, problem: 'invalid' });
  });

  it('parses and checks in one step', () => {
    expect(readContribution('19,99', 'EUR', 2000, null)).toEqual({ ok: false, problem: 'below_minimum' });
    expect(readContribution('x', 'EUR', 2000, null)).toEqual({ ok: false, problem: 'invalid' });
    expect(readContribution('35', 'EUR', 2000, null)).toEqual({ ok: true, cents: 3500 });
  });
});

describe('input helpers', () => {
  it('shows minor units the way a number input reads them back', () => {
    expect(amountInputValue(2500, 'EUR')).toBe('25.00');
    expect(amountInputValue(1000, 'JPY')).toBe('1000');
    expect(amountInputStep('EUR')).toBe('0.01');
    expect(amountInputStep('JPY')).toBe('1');
    expect(amountInputStep('BHD')).toBe('0.001');
    expect(parseAmountInput(amountInputValue(1234, 'BHD'), 'BHD')).toEqual({ ok: true, cents: 1234 });
  });
});
