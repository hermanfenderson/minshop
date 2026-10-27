import type { StoreSettings } from '../settings/db';
import { DEFAULT_SAFETY_CAP_MAJOR, maximumCents } from './amount';
import { minorUnitsPerMajor } from '../../money';

/**
 * Whether the store runs in Benefit Mode, and with which limits. One place
 * answers it so every route reads the mode the same way; null means standard
 * commerce, which must behave exactly as before Benefit Mode existed.
 */
export interface BenefitRules {
  /** Largest contribution per unit, minor units (store cap within the provider's). */
  capCents: number;
}

export function benefitRules(
  settings: Pick<StoreSettings, 'commerceMode' | 'contributionCapCents'> | null | undefined,
  currency: string,
): BenefitRules | null {
  if (settings?.commerceMode !== 'benefit') return null;
  const cap = settings.contributionCapCents ?? DEFAULT_SAFETY_CAP_MAJOR * minorUnitsPerMajor(currency);
  return { capCents: maximumCents(cap) };
}

/**
 * A pure contribution — nothing counted, shipped or downloaded (a "Gratitude").
 * Its amount is the only thing a supporter chooses, so it is always one unit:
 * three Gratitudes of 10 say nothing that one of 30 does not. Decided from the
 * product's configuration, never its name.
 */
export function isSingleUnitContribution(product: {
  track_inventory?: number | null;
  requires_shipping: number;
  file_key: string | null;
}): boolean {
  return product.track_inventory === 0 && product.requires_shipping === 0 && !product.file_key;
}

/**
 * The rails a Benefit Mode checkout can use: those that need no in-app address
 * step, which knows nothing of contributions or donor data. (Demo qualifies
 * only for a basket with nothing to ship; checkout enforces that.)
 */
export const BENEFIT_PAYMENT_METHODS = ['stripe', 'demo'] as const;
