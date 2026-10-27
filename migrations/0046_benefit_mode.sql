-- 0046: Benefit Mode's order data (docs/ROADMAP_BENEFIT_MODE.md).
--
-- order_items.min_price_cents — the minimum contribution per unit when the line
--   was bought in Benefit Mode; price_cents is then the contribution the
--   supporter chose. NULL = a standard line, where price_cents is the price.
-- checkout_reservations.donor — the donor data the shop collected before
--   payment (JSON, features/benefit/donor.ts), kept with the checkout so the
--   receipt can be issued once it settles, whatever rail took the money.

ALTER TABLE order_items ADD COLUMN min_price_cents INTEGER;
ALTER TABLE checkout_reservations ADD COLUMN donor TEXT;
