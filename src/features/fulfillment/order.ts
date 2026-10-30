import type { ShippingAddress } from '../orders/db';
import type { FulfillmentLine, FulfillmentOrderInput } from './provider';

/**
 * Turn a recorded order into what the fulfiller needs. Pure: the store module
 * reads the rows, this decides whether there is anything to send and whether
 * it can be sent at all.
 */

export interface OrderLineRow {
  /** order_items.id: the fulfiller hands it back on each package. */
  id: number;
  name: string;
  quantity: number;
  price_cents: number;
  /** The linked product's or variant's fulfillment_ref; null = not the fulfiller's. */
  ref: string | null;
}

export interface FulfillableOrder {
  public_id: string;
  email: string | null;
  currency: string;
  ship_address: string | null;
}

export type BuildResult =
  | { kind: 'send'; input: Omit<FulfillmentOrderInput, 'confirm'> }
  | { kind: 'nothing' }
  /** Something only a person can fix (no address, say); never retried by itself. */
  | { kind: 'blocked'; reason: string };

export function fulfillmentLines(rows: OrderLineRow[]): FulfillmentLine[] {
  return rows
    .filter((row) => row.ref && row.quantity > 0)
    .map((row) => ({
      ref: row.ref!,
      quantity: row.quantity,
      unitPriceCents: row.price_cents,
      name: row.name,
      externalId: String(row.id),
    }));
}

function parseAddress(raw: string | null): ShippingAddress | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ShippingAddress;
  } catch {
    return null;
  }
}

export function buildFulfillmentInput(order: FulfillableOrder, rows: OrderLineRow[]): BuildResult {
  const lines = fulfillmentLines(rows);
  if (lines.length === 0) return { kind: 'nothing' };
  const a = parseAddress(order.ship_address);
  const missing = !a
    ? ['address']
    : (['name', 'line1', 'city', 'postal', 'country'] as const).filter((field) => !a[field]?.trim());
  if (missing.length > 0) return { kind: 'blocked', reason: `Shipping address incomplete: missing ${missing.join(', ')}` };
  return {
    kind: 'send',
    input: {
      externalId: order.public_id,
      currency: order.currency.toUpperCase(),
      lines,
      recipient: {
        name: a!.name!.trim(),
        address1: a!.line1!.trim(),
        address2: a!.line2?.trim() || null,
        city: a!.city!.trim(),
        stateCode: a!.state?.trim() || null,
        countryCode: a!.country!.trim().toUpperCase(),
        zip: a!.postal!.trim(),
        email: order.email,
      },
    },
  };
}
