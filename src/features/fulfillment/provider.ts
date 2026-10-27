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

export interface FulfillmentProvider {
  readonly name: string;
  submitOrder(input: FulfillmentOrderInput): Promise<SubmitOutcome>;
  /** Where the merchant sees this order in the fulfiller's dashboard. */
  dashboardUrl(providerOrderId: string): string;
}
