-- 0050: payments received outside the shop (features/orders/manualPayment.ts).
--
-- orders.manual_payment — for an order an admin recorded by hand
--   (payment_method 'manual'): how and when the money arrived, as JSON
--   {method, receivedOn, reference, note}. NULL for every order paid in the shop.
ALTER TABLE orders ADD COLUMN manual_payment TEXT;
