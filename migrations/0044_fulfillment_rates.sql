-- 0044: what the fulfiller needs to price a shipment.
--
-- fulfillment_rate_ref — the fulfiller's CATALOG id for the unit (Printful:
--   variant_id), next to fulfillment_ref (its store id, used for orders).
--   Printful prices shipping by catalog variant only, so checkout needs both.

ALTER TABLE product_variants ADD COLUMN fulfillment_rate_ref TEXT;
ALTER TABLE products ADD COLUMN fulfillment_rate_ref TEXT;
