import { enI18n, type I18n } from '../../i18n/translator.ts';
import type { MessageKey } from '../../i18n/catalog.ts';

// Display labels for stored order states. The stored values stay codes: filters,
// sort links, the CSV export, and the database all keep using them. Only what a
// merchant reads goes through the translator, and an unknown value is shown as-is
// rather than hidden.

const STATUS_LABELS: Record<string, MessageKey> = {
  paid: 'adminOrders.status.paid',
  refunded: 'adminOrders.status.refunded',
  pending: 'adminOrders.status.pending',
};

/** Payment status ('paid' | 'refunded' | 'pending') as the merchant reads it. */
export function orderStatusLabel(status: string, i18n: I18n = enI18n): string {
  const key = Object.hasOwn(STATUS_LABELS, status) ? STATUS_LABELS[status] : undefined;
  return key ? i18n.t(key) : status;
}

/** 'fulfilled' or anything else (= unfulfilled), matching how the list reads it. */
export function fulfillmentLabel(status: string, i18n: I18n = enI18n): string {
  return i18n.t(
    status === 'fulfilled' ? 'adminOrders.fulfillment.fulfilled' : 'adminOrders.fulfillment.unfulfilled',
  );
}
