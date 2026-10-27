import type { AmountProblem } from './amount';

type Translate = (key: 'benefit.error.invalid' | 'benefit.error.precision' | 'benefit.error.belowMinimum' | 'benefit.error.aboveMaximum', params?: Record<string, string | number>) => string;

/** The supporter-facing refusal for an amount, in their language. */
export function contributionError(
  i18n: { t: Translate; money(minor: number, currency: string): string },
  problem: AmountProblem,
  line: { name: string; minimumCents: number; capCents: number; currency: string },
): string {
  switch (problem) {
    case 'below_minimum':
      return i18n.t('benefit.error.belowMinimum', { name: line.name, price: i18n.money(line.minimumCents, line.currency) });
    case 'above_maximum':
      return i18n.t('benefit.error.aboveMaximum', { name: line.name, price: i18n.money(line.capCents, line.currency) });
    case 'precision':
      return i18n.t('benefit.error.precision');
    default:
      return i18n.t('benefit.error.invalid');
  }
}
