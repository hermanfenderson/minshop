import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { fulfillmentWebhookKey, getFulfillmentProvider, handleFulfillmentEvent } from '../../../features/fulfillment';

export const prerender = false;

// POST /api/webhook/printful?k=<key> — Printful's notifications (registered from
// Admin → Settings → Print on demand). Printful does not sign them, so the URL
// carries a key derived from AUTH_SECRET, and the body is only a nudge: the
// order is read back from Printful's API before anything is recorded.
// 2xx = done or nothing to do; 503 = Printful busy, retry later (Printful does).
export const POST: APIRoute = async ({ request, url }) => {
  if (!env.AUTH_SECRET) return new Response('Not configured', { status: 404 });
  const expected = await fulfillmentWebhookKey(env.AUTH_SECRET);
  if (url.searchParams.get('k') !== expected) return new Response('Not found', { status: 404 });

  const provider = await getFulfillmentProvider(env.DB);
  if (!provider || provider.name !== 'printful') return new Response('Not configured', { status: 404 });

  const event = provider.parseEvent(await request.json().catch(() => null));
  if (!event) return new Response('Unreadable event', { status: 400 });
  if (!event.providerOrderId) return new Response('ignored', { status: 200 });

  const outcome = await handleFulfillmentEvent(env.DB, provider, event.providerOrderId, new URL(request.url).origin);
  if (typeof outcome === 'object') {
    console.error(`Printful ${event.type} for order ${event.providerOrderId}: ${outcome.error}`);
    return new Response('read-back failed', { status: outcome.retryable ? 503 : 200 });
  }
  return new Response(outcome, { status: 200 });
};
