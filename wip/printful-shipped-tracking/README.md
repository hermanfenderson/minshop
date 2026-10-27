# Parked: Printful "shipped" webhooks and tracking

Draft only, not wired and not compiled. Parked on 2026-10-27 when Benefit Mode
took priority; resume after Benefit Mode, testing with one real confirmed order.

- `provider.with-shipments.ts` — `FulfillmentProvider` extended with
  `getOrder`, `registerWebhook`, `parseEvent` and the shipment types. It replaces
  `src/features/fulfillment/provider.ts` when resumed.
- `0045_fulfillment_shipments.sql` — `orders.tracking_url` and `order_shipments`.
  Renumber to the next free migration when resumed.

Design: the webhook is only a nudge (Printful's are unsigned); every change is
read back from `GET /orders/{id}`, and shipments are keyed by the fulfiller's id
so a repeated webhook records nothing new.
