-- 0043: hand paid orders to a print-on-demand fulfiller (Printful first).
--
-- fulfillment_ref — the fulfiller's id for one sellable unit (for Printful, the
--   store's sync_variant_id). On the variant, or on the product when it has no
--   variants. NULL = the shop ships it itself (or nothing ships at all), so a
--   mixed cart sends only the linked lines.
-- order_fulfillments — one row per order handed over: a small state machine
--   (pending → processing → submitted | failed) with a lease and attempts, like
--   the email outbox, so a webhook redelivery, the cron and the admin's Retry can
--   all drive it without ever creating the order twice. The fulfiller's own
--   order is also keyed by our order's public id (its external id).

ALTER TABLE product_variants ADD COLUMN fulfillment_ref TEXT;
ALTER TABLE products ADD COLUMN fulfillment_ref TEXT;

CREATE TABLE IF NOT EXISTS order_fulfillments (
  order_id          INTEGER PRIMARY KEY REFERENCES orders(id),
  provider          TEXT    NOT NULL,              -- 'printful'
  state             TEXT    NOT NULL DEFAULT 'pending',
  attempts          INTEGER NOT NULL DEFAULT 0,
  lease_expires_at  TEXT,
  provider_order_id TEXT,                          -- the fulfiller's order id
  provider_status   TEXT,                          -- its status as last seen ('draft', 'pending', …)
  last_error        TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_order_fulfillments_state ON order_fulfillments(state);
