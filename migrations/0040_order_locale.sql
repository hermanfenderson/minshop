-- 0040: the shopper's language, captured at checkout and kept with the order.
-- Additive only. Existing rows stay NULL: they were transacted before the store
-- had languages, and read as the stable legacy language (English) — never as
-- the current default or the admin's language, which can change later.

ALTER TABLE pending_payments ADD COLUMN locale TEXT;
ALTER TABLE orders ADD COLUMN locale TEXT;
