import { enI18n, type I18n } from '../../i18n/translator.ts';

/** Supported carriers for fulfillment tracking. */
export const CARRIERS = [
  { code: 'usps', name: 'USPS' },
  { code: 'ups', name: 'UPS' },
  { code: 'fedex', name: 'FedEx' },
  { code: 'dhl', name: 'DHL' },
  { code: 'other', name: 'Other' },
] as const;

/** Display name for a carrier code. Carrier brands stay as they are; only the
 *  catch-all 'other' is a word, so it goes through the translator. */
export function carrierName(code: string | null, i18n: I18n = enI18n): string {
  if (code === 'other') return i18n.t('order.carrier.other');
  return CARRIERS.find((c) => c.code === code)?.name ?? code ?? '—';
}

/** Public tracking URL for a carrier + number, or null when not linkable. */
export function trackingUrl(carrier: string | null, number: string | null): string | null {
  if (!carrier || !number) return null;
  const n = encodeURIComponent(number);
  switch (carrier) {
    case 'usps':
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case 'ups':
      return `https://www.ups.com/track?tracknum=${n}`;
    case 'fedex':
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case 'dhl':
      return `https://www.dhl.com/en/express/tracking.html?AWB=${n}`;
    default:
      return null; // 'other' / unknown — show the number without a link
  }
}
