-- 0047_receipts — Benefit Mode documents (R11, R12, R15).
--
-- orders.donor: the donor snapshot copied from the checkout reservation in the
-- settlement batch, so an order alone says who its receipt is made out to.
-- NULL = a standard sale, which never gets a receipt.
ALTER TABLE orders ADD COLUMN donor TEXT;

-- One row per issued document: donation receipts, shipping-cost receipts and
-- refund notes, each numbered in its own gapless annual series. A number is
-- allocated in the same INSERT that writes the row (MAX + 1 under the UNIQUE
-- index), so two concurrent issuers cannot share one and an abandoned attempt
-- cannot leave a hole.
--
-- `document` is the full JSON snapshot the PDF is drawn from — issuer, donor,
-- amounts and the wording as configured at that moment — so a receipt reads the
-- same forever even after the settings change. `issue_key` makes issuing
-- idempotent: the same order and purpose can never produce two documents.
CREATE TABLE IF NOT EXISTS receipts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id     TEXT    NOT NULL UNIQUE,
  order_id      INTEGER NOT NULL REFERENCES orders(id),
  kind          TEXT    NOT NULL,              -- donation | shipping | refund_note
  series_year   INTEGER NOT NULL,
  number        INTEGER NOT NULL,
  label         TEXT    NOT NULL,              -- as printed, e.g. W12/2027
  amount_cents  INTEGER NOT NULL,
  currency      TEXT    NOT NULL,
  document      TEXT    NOT NULL,
  -- The rendered PDF in storage; NULL until it is written (the cron retries).
  pdf_key       TEXT,
  -- A refund note names the receipt it cancels; a reissued receipt names the
  -- one it replaces.
  replaces_receipt_id INTEGER REFERENCES receipts(id),
  issue_key     TEXT    NOT NULL UNIQUE,
  issued_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kind, series_year, number)
);

CREATE INDEX IF NOT EXISTS idx_receipts_order ON receipts(order_id);
