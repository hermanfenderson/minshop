-- 0045: products that are not counted in stock.
--
-- track_inventory = 0 — the product (and every variant of it) is always
--   available: checkout neither checks nor reserves stock for it, and settlement
--   never decrements it. For contributions with nothing to hand over (a Benefit
--   Mode "Gratitude"), services, or anything made to order without a limit.
--   Default 1 keeps every existing product exactly as it was.

ALTER TABLE products ADD COLUMN track_inventory INTEGER NOT NULL DEFAULT 1;
