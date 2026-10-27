import type { D1Database } from '@cloudflare/workers-types';
import type { CheckoutContact } from '../payments/provider';
import { parseItems, type ReservationItem } from './reservations.ts';

/**
 * Checkouts that never became orders, kept on their reservation (orders stay
 * paid-only). The provider says who the buyer was only as the checkout ends or
 * starts waiting for a delayed payment; this module records that and reads it
 * back for the failed-payment emails and the admin's read-only list.
 */

/** Record what the provider knows; a later event never blanks an earlier value. */
export async function recordCheckoutContact(db: D1Database, contact: CheckoutContact): Promise<void> {
  await db
    .prepare(
      `UPDATE checkout_reservations
          SET customer_email = COALESCE(?, customer_email),
              amount_total_cents = COALESCE(?, amount_total_cents),
              currency = COALESCE(?, currency),
              locale = COALESCE(?, locale)
        WHERE public_id = ?`,
    )
    .bind(contact.email, contact.amountCents, contact.currency, contact.locale, contact.reservationId)
    .run();
}

export type UnpaidCheckoutState = 'processing' | 'failed' | 'expired';

export interface UnpaidCheckout {
  publicId: string;
  state: UnpaidCheckoutState;
  paymentMethod: string;
  email: string | null;
  items: ReservationItem[];
  amountCents: number | null;
  currency: string | null;
  locale: string | null;
  createdAt: string;
  /** When it failed or expired; null while still processing. */
  endedAt: string | null;
  /** Delivery state of the buyer's failed-payment email, if one was queued. */
  customerNotice: string | null;
}

interface Row {
  public_id: string;
  status: string;
  payment_method: string;
  customer_email: string | null;
  items: string;
  amount_total_cents: number | null;
  currency: string | null;
  locale: string | null;
  created_at: string;
  terminal_at: string | null;
  customer_notice: string | null;
}

const STATE: Record<string, UnpaidCheckoutState> = {
  payment_pending: 'processing',
  failed: 'failed',
  expired: 'expired',
};

const COLUMNS = `public_id, status, payment_method, customer_email, items, amount_total_cents,
  currency, locale, created_at, terminal_at,
  (SELECT state FROM checkout_notifications n
    WHERE n.reservation_id = checkout_reservations.public_id
      AND n.kind = 'payment-failed-customer') AS customer_notice`;

function toUnpaid(row: Row): UnpaidCheckout | null {
  const state = STATE[row.status];
  const items = parseItems(row.items);
  if (!state || !items) return null;
  return {
    publicId: row.public_id,
    state,
    paymentMethod: row.payment_method,
    email: row.customer_email,
    items,
    amountCents: row.amount_total_cents,
    currency: row.currency,
    locale: row.locale,
    createdAt: row.created_at,
    endedAt: row.terminal_at,
    customerNotice: row.customer_notice,
  };
}

/**
 * Newest first: payments still processing, and failed or expired checkouts
 * whose buyer left an email. A checkout abandoned before the buyer typed
 * anything says nothing anyone could follow up, so it stays out.
 */
export async function listUnpaidCheckouts(db: D1Database, limit = 100): Promise<UnpaidCheckout[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNS} FROM checkout_reservations
        WHERE status = 'payment_pending'
           OR (status IN ('failed', 'expired') AND customer_email IS NOT NULL)
        ORDER BY created_at DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all<Row>();
  return (results ?? []).flatMap((row) => toUnpaid(row) ?? []);
}

/** One checkout, for the failed-payment emails. */
export async function getUnpaidCheckout(db: D1Database, publicId: string): Promise<UnpaidCheckout | null> {
  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM checkout_reservations WHERE public_id = ?`)
    .bind(publicId)
    .first<Row>();
  return row ? toUnpaid(row) : null;
}
