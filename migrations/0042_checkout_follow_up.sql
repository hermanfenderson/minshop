-- Follow-up on checkouts that never became orders (failed or expired delayed
-- payments). Orders stay paid-only: these rows describe a reservation, never
-- an order. The provider reports who the buyer was and what they were charged
-- only when the checkout ends, so the columns start NULL and are filled from
-- the webhook; abandoned checkouts with no email simply stay NULL.
ALTER TABLE checkout_reservations ADD COLUMN customer_email TEXT;
ALTER TABLE checkout_reservations ADD COLUMN amount_total_cents INTEGER;
ALTER TABLE checkout_reservations ADD COLUMN currency TEXT;
ALTER TABLE checkout_reservations ADD COLUMN locale TEXT;

-- Admin's list of unpaid checkouts, newest first, by state.
CREATE INDEX IF NOT EXISTS idx_checkout_reservations_status_created
  ON checkout_reservations(status, created_at);

-- Email outbox for checkouts, the same state machine as order_notifications
-- (0032) keyed by the reservation: a failed delayed payment tells the buyer
-- and the merchant once, retried by the sweep if a send fails.
CREATE TABLE IF NOT EXISTS checkout_notifications (
  reservation_id TEXT NOT NULL REFERENCES checkout_reservations(public_id),
  kind TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_expires_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  PRIMARY KEY (reservation_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_checkout_notifications_unsent
  ON checkout_notifications (state, lease_expires_at, created_at);
