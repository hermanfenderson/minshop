-- 0049: what each package holds.
--
-- An order can leave in several packages: the fulfiller splits it by facility
-- (a mug from one warehouse, a t-shirt from another) and the shop ships its own
-- items itself (an ukulele). order_shipments already records every package;
-- this says which order lines, and how many of each, went in it, so the order
-- is shipped only when every line that ships is in a package, and each package
-- gets its own email.
--
-- order_shipments.provider is now also 'manual': a package the shop sent and
-- recorded in the admin (its provider_shipment_id is generated here).

CREATE TABLE IF NOT EXISTS order_shipment_items (
  shipment_id   INTEGER NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (shipment_id, order_item_id)
);
CREATE INDEX IF NOT EXISTS idx_order_shipment_items_item ON order_shipment_items(order_item_id);
