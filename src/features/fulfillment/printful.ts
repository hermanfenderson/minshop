import { toMajorUnits } from '../../money.ts';
import type { FulfillmentOrderInput, FulfillmentProvider, SubmitOutcome } from './provider';

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
    private readonly fetchImpl: Fetch = fetch,
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

  dashboardUrl(): string {
    return PRINTFUL_DASHBOARD_URL;
  }
}

function accepted(result: { id?: number | string; status?: string }): SubmitOutcome {
  if (result.id == null) return { ok: false, retryable: true, error: 'Printful answered without an order id' };
  return { ok: true, providerOrderId: String(result.id), status: result.status ?? 'unknown' };
}
