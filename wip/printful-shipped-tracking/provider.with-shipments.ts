/**
 * Fulfillment port: hand a paid order's linked lines to a fulfiller that makes
 * and ships them (print on demand). The core — settlement, the cron, the admin —
 * talks only to this; vendor code stays in its adapter (./printful.ts).
 *
 * Only lines whose product or variant carries a `fulfillment_ref` go out, so a
 * cart that mixes fulfiller items with the shop's own (or with donations that
 * ship nothing) sends just the fulfiller's part.
 */

export interface FulfillmentRecipient {
  name: string;
  address1: string;
  address2: string | null;
  city: string;
  /** Region code as the payment provider reported it (e.g. "CA" for California). */
  stateCode: string | null;
  countryCode: string;
  zip: string;
  email: string | null;
}

export interface FulfillmentLine {
  /** The fulfiller's id for this unit (Printful: sync_variant_id). */
  ref: string;
  quantity: number;
  /** What the buyer paid per unit, for the packing slip and customs. */
  unitPriceCents: number;
  name: string;
}

export interface FulfillmentOrderInput {
  /** Our order's public id: the fulfiller dedupes on it, so a retry never orders twice. */
  externalId: string;
  recipient: FulfillmentRecipient;
  lines: FulfillmentLine[];
  currency: string;
  /** false = leave a draft for a person to confirm; true = submit for production. */
  confirm: boolean;
}

export type SubmitOutcome =
  | { ok: true; providerOrderId: string; status: string }
  /** `retryable`: the fulfiller was unreachable or busy; anything else needs a person. */
  | { ok: false; retryable: boolean; error: string };

export interface FulfillmentShipment {
  /** The fulfiller's id for this package: a repeated report is recognised by it. */
  id: string;
  carrier: string | null;
  service: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
}

export interface ProviderOrderState {
  /** The fulfiller's own word for it: 'draft', 'pending', 'fulfilled', 'canceled', … */
  status: string;
  shipments: FulfillmentShipment[];
}

export type ReadOutcome = { ok: true; order: ProviderOrderState } | { ok: false; retryable: boolean; error: string };

/** What a webhook says happened, before anything in it is believed. */
export interface FulfillmentEvent {
  type: string;
  /** The fulfiller's order id, to be read back from its API. */
  providerOrderId: string | null;
}

export interface RateQuoteInput {
  countryCode: string;
  /** Catalog ids (fulfillment_rate_ref) with quantities. */
  lines: { rateRef: string; quantity: number }[];
  currency: string;
  signal?: AbortSignal;
}

export type RateOutcome = { ok: true; amountCents: number } | { ok: false; error: string };

export interface FulfillmentProvider {
  readonly name: string;
  /** The fulfiller's own cheapest standard delivery for these units, before tax. */
  quoteShipping(input: RateQuoteInput): Promise<RateOutcome>;
  submitOrder(input: FulfillmentOrderInput): Promise<SubmitOutcome>;
  /**
   * The order as the fulfiller has it now. Webhooks are only a nudge (Printful's
   * are not signed): every change is taken from here, never from the payload.
   */
  getOrder(providerOrderId: string): Promise<ReadOutcome>;
  /** Point the fulfiller's notifications at `url` (replacing any earlier one). */
  registerWebhook(url: string): Promise<{ ok: true } | { ok: false; error: string }>;
  parseEvent(body: unknown): FulfillmentEvent | null;
  /** Where the merchant sees this order in the fulfiller's dashboard. */
  dashboardUrl(providerOrderId: string): string;
}
