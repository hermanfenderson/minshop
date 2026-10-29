import { toMajorUnits, toMinorUnits } from '../../money.ts';
import type {
  FulfillmentEvent,
  FulfillmentOrderInput,
  FulfillmentProvider,
  FulfillmentShipment,
  RateOutcome,
  RateQuoteInput,
  ReadOutcome,
  SubmitOutcome,
} from './provider';

/**
 * Printful adapter (API v1, plain fetch, no SDK). The token is a private one
 * scoped to a single API store, so no store header is needed: every call lands
 * in the store the token was made for.
 *
 * Idempotency is Printful's external id. Before creating, the adapter looks the
 * order up by it, so a retry after an unanswered request (or a redelivered
 * payment webhook) finds the order instead of making a second one.
 */

const PRINTFUL_BASE = 'https://api.printful.com';
/** Printful's order list; its per-order URLs are not part of the API contract. */
export const PRINTFUL_DASHBOARD_URL = 'https://www.printful.com/dashboard/default/orders';

/** Printful requires a region only for these countries, and refuses unknown ones. */
const STATE_REQUIRED = new Set(['US', 'CA', 'AU']);

/** Printful's external id allows 32 characters; legacy UUID public ids are 36. */
export function printfulExternalId(publicId: string): string {
  return publicId.length > 32 ? publicId.replaceAll('-', '').slice(0, 32) : publicId;
}

export function printfulOrderPayload(input: FulfillmentOrderInput) {
  const r = input.recipient;
  const country = r.countryCode.toUpperCase();
  return {
    external_id: printfulExternalId(input.externalId),
    shipping: 'STANDARD',
    recipient: {
      name: r.name,
      address1: r.address1,
      ...(r.address2 ? { address2: r.address2 } : {}),
      city: r.city,
      ...(STATE_REQUIRED.has(country) && r.stateCode ? { state_code: r.stateCode } : {}),
      country_code: country,
      zip: r.zip,
      ...(r.email ? { email: r.email } : {}),
    },
    items: input.lines.map((line) => ({
      sync_variant_id: Number(line.ref),
      quantity: line.quantity,
      retail_price: toMajorUnits(line.unitPriceCents, input.currency).toFixed(2),
      name: line.name,
    })),
  };
}

/**
 * Where these countries need a region the cart does not know yet (the address
 * is typed on Stripe's page, after the quote), a populous one stands in: rates
 * barely differ between regions, and the order itself carries the real one.
 */
const QUOTE_STATE: Record<string, string> = { US: 'NY', CA: 'ON', AU: 'NSW' };

export function printfulRatePayload(input: RateQuoteInput) {
  const country = input.countryCode.toUpperCase();
  return {
    recipient: { country_code: country, ...(QUOTE_STATE[country] ? { state_code: QUOTE_STATE[country] } : {}) },
    items: input.lines.map((line) => ({ variant_id: Number(line.rateRef), quantity: line.quantity })),
    currency: input.currency.toUpperCase(),
  };
}

/** The STANDARD rate in minor units, or the cheapest one if Printful renames it. */
export function pickStandardRate(result: unknown, currency: string): number | null {
  if (!Array.isArray(result) || result.length === 0) return null;
  const rates = result
    .filter((r) => r && typeof r.rate === 'string' && String(r.currency ?? '').toUpperCase() === currency.toUpperCase())
    .map((r) => ({ id: String(r.id), cents: toMinorUnits(Number(r.rate), currency) }))
    .filter((r) => Number.isFinite(r.cents) && r.cents >= 0);
  if (rates.length === 0) return null;
  return (rates.find((r) => r.id === 'STANDARD') ?? rates.sort((a, b) => a.cents - b.cents)[0]).cents;
}

/** What Printful notifies: packages leaving or coming back, and the order's own changes. */
export const PRINTFUL_WEBHOOK_TYPES = [
  'package_shipped',
  'package_returned',
  'order_updated',
  'order_failed',
  'order_canceled',
  'order_put_hold',
  'order_remove_hold',
] as const;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * The packages of a Printful order (GET /orders/{id} → result.shipments) that
 * actually left: canceled ones and those not yet handed to a carrier are skipped.
 */
export function printfulShipments(result: unknown): FulfillmentShipment[] {
  const list = (result as { shipments?: unknown } | null)?.shipments;
  if (!Array.isArray(list)) return [];
  return list.flatMap((raw) => {
    const s = raw as Record<string, unknown>;
    if (s?.id == null || s.status === 'canceled') return [];
    const trackingNumber = text(s.tracking_number);
    if (s.status !== 'shipped' && !trackingNumber) return [];
    const seconds = typeof s.shipped_at === 'number' && s.shipped_at > 0 ? s.shipped_at : null;
    return [
      {
        id: String(s.id),
        carrier: text(s.carrier),
        service: text(s.service),
        trackingNumber,
        trackingUrl: /^https:\/\//.test(String(s.tracking_url ?? '')) ? String(s.tracking_url) : null,
        shippedAt: seconds ? new Date(seconds * 1000).toISOString() : text(s.ship_date),
      },
    ];
  });
}

/** Type and order id of a Printful webhook body ({ type, data: { order, shipment } }). */
export function parsePrintfulEvent(body: unknown): FulfillmentEvent | null {
  const b = body as { type?: unknown; data?: { order?: { id?: unknown } } } | null;
  if (!b || typeof b.type !== 'string') return null;
  const id = b.data?.order?.id;
  return { type: b.type, providerOrderId: typeof id === 'number' || (typeof id === 'string' && id) ? String(id) : null };
}

type Fetch = typeof fetch;

interface PrintfulBody {
  code?: number;
  result?: { id?: number | string; status?: string } | string;
  error?: { message?: string };
}

function errorText(status: number, body: PrintfulBody | null): string {
  const message =
    body?.error?.message ?? (typeof body?.result === 'string' ? body.result : null) ?? 'no details';
  return `Printful ${status}: ${message}`;
}

/** 429 and 5xx are Printful being busy or down; any other refusal needs a person. */
const retryableStatus = (status: number) => status === 429 || status >= 500;

export class PrintfulProvider implements FulfillmentProvider {
  readonly name = 'printful';

  constructor(
    private readonly token: string,
    // Wrapped, not stored bare: Workers throws "Illegal invocation" when fetch
    // is called as a method of another object (this.fetchImpl(...)).
    private readonly fetchImpl: Fetch = (input, init) => fetch(input, init),
  ) {}

  private async call(path: string, init: RequestInit = {}) {
    const res = await this.fetchImpl(`${PRINTFUL_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
    });
    const body = (await res.json().catch(() => null)) as PrintfulBody | null;
    return { status: res.status, body };
  }

  async quoteShipping(input: RateQuoteInput): Promise<RateOutcome> {
    try {
      const { status, body } = await this.call('/shipping/rates', {
        method: 'POST',
        body: JSON.stringify(printfulRatePayload(input)),
        signal: input.signal,
      });
      if (status !== 200) return { ok: false, error: errorText(status, body) };
      const cents = pickStandardRate(body?.result, input.currency);
      return cents == null ? { ok: false, error: 'Printful returned no usable rate' } : { ok: true, amountCents: cents };
    } catch (err) {
      return { ok: false, error: `Printful unreachable: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  async submitOrder(input: FulfillmentOrderInput): Promise<SubmitOutcome> {
    try {
      const externalId = printfulExternalId(input.externalId);
      const found = await this.call(`/orders/@${encodeURIComponent(externalId)}`);
      if (found.status === 200 && typeof found.body?.result === 'object') {
        return accepted(found.body.result);
      }
      if (found.status !== 404) {
        return { ok: false, retryable: retryableStatus(found.status), error: errorText(found.status, found.body) };
      }
      const created = await this.call(`/orders?confirm=${input.confirm ? 'true' : 'false'}`, {
        method: 'POST',
        body: JSON.stringify(printfulOrderPayload(input)),
      });
      if (created.status === 200 && typeof created.body?.result === 'object') {
        return accepted(created.body.result);
      }
      return { ok: false, retryable: retryableStatus(created.status), error: errorText(created.status, created.body) };
    } catch (err) {
      // No answer at all: the order may or may not exist, and the lookup above
      // makes the next attempt safe either way.
      return { ok: false, retryable: true, error: `Printful unreachable: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  async getOrder(providerOrderId: string): Promise<ReadOutcome> {
    try {
      const { status, body } = await this.call(`/orders/${encodeURIComponent(providerOrderId)}`);
      if (status === 200 && body?.result && typeof body.result === 'object') {
        return {
          ok: true,
          order: { status: body.result.status ?? 'unknown', shipments: printfulShipments(body.result) },
        };
      }
      return { ok: false, retryable: retryableStatus(status), error: errorText(status, body) };
    } catch (err) {
      return { ok: false, retryable: true, error: `Printful unreachable: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  /** One URL per store on Printful's side: this replaces whatever was there. */
  async registerWebhook(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const { status, body } = await this.call('/webhooks', {
        method: 'POST',
        body: JSON.stringify({ url, types: PRINTFUL_WEBHOOK_TYPES }),
      });
      return status === 200 ? { ok: true } : { ok: false, error: errorText(status, body) };
    } catch (err) {
      return { ok: false, error: `Printful unreachable: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  parseEvent(body: unknown): FulfillmentEvent | null {
    return parsePrintfulEvent(body);
  }

  dashboardUrl(): string {
    return PRINTFUL_DASHBOARD_URL;
  }
}

function accepted(result: { id?: number | string; status?: string }): SubmitOutcome {
  if (result.id == null) return { ok: false, retryable: true, error: 'Printful answered without an order id' };
  return { ok: true, providerOrderId: String(result.id), status: result.status ?? 'unknown' };
}
