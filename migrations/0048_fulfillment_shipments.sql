-- 0048: what the fulfiller shipped, and where to follow it.
--
-- orders.tracking_url — the tracking page the fulfiller gave us. The built-in
--   carrier links (USPS, UPS, FedEx, DHL) are derived from the number; anything
--   else (Evri, Unisend, Poste Italiane, …) only has the link it came with.
-- order_shipments — every package the fulfiller reported, one row each: an order
--   can ship in several (Printful splits by facility). Keyed by the fulfiller's
--   shipment id, so a repeated webhook or poll records nothing new.

ALTER TABLE orders ADD COLUMN tracking_url TEXT;

CREATE TABLE IF NOT EXISTS order_shipments (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id             INTEGER NOT NULL REFERENCES orders(id),
  provider             TEXT    NOT NULL,
  provider_shipment_id TEXT    NOT NULL,
  carrier              TEXT,
  service              TEXT,
  tracking_number      TEXT,
  tracking_url         TEXT,
  shipped_at           TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_shipment_id)
);
CREATE INDEX IF NOT EXISTS idx_order_shipments_order ON order_shipments(order_id);
