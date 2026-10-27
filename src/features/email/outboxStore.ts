import type { D1Database } from '@cloudflare/workers-types';

/**
 * The outbox state machine — every statement that moves a row between states,
 * and nothing else. Two tables share it: order_notifications (keyed by the
 * order) and checkout_notifications (keyed by the reservation of a checkout
 * that never became an order, see migration 0042). Split from outbox.ts (which owns message
 * building and sending) so this half has NO `cloudflare:workers` dependency:
 * test/integration/reservations.mjs runs these exact statements against a real
 * miniflare D1, where a unit-test fake would let malformed SQL or bind
 * ordering pass unnoticed.
 */

export const NOTIFICATION_KINDS = ['customer-receipt', 'owner-notification', 'order-shipped'] as const;

/** Emails about a checkout whose delayed payment failed (no order exists). */
export const CHECKOUT_NOTIFICATION_KINDS = ['payment-failed-customer', 'payment-failed-owner'] as const;
export type CheckoutNotificationKind = (typeof CHECKOUT_NOTIFICATION_KINDS)[number];

/** Which outbox a statement runs against. Constants only: never user input. */
interface Outbox {
  table: 'order_notifications' | 'checkout_notifications';
  key: 'order_id' | 'reservation_id';
}
const ORDERS: Outbox = { table: 'order_notifications', key: 'order_id' };
const CHECKOUTS: Outbox = { table: 'checkout_notifications', key: 'reservation_id' };

/**
 * Versioned-kind family for guest-link reissue (see the public-ID plan): each
 * reissue queues `guest-link-reissue:<generation>` so a repeat reissue gets its
 * own row and idempotency key instead of colliding with the first. The
 * deliverer recognises the prefix rather than a fixed string, and skips any
 * event whose generation no longer matches order_guest_access.generation.
 */
export const GUEST_LINK_REISSUE_PREFIX = 'guest-link-reissue:';
export type GuestLinkReissueKind = `${typeof GUEST_LINK_REISSUE_PREFIX}${number}`;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number] | GuestLinkReissueKind;

export function isGuestLinkReissueKind(kind: string): kind is GuestLinkReissueKind {
  return kind.startsWith(GUEST_LINK_REISSUE_PREFIX) && reissueGeneration(kind) !== null;
}

/** The <generation> a reissue kind carries, or null for a malformed kind. */
export function reissueGeneration(kind: string): number | null {
  if (!kind.startsWith(GUEST_LINK_REISSUE_PREFIX)) return null;
  const raw = kind.slice(GUEST_LINK_REISSUE_PREFIX.length);
  const n = Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(n) && n > 0 ? n : null;
}

export function guestLinkReissueKind(generation: number): GuestLinkReissueKind {
  return `${GUEST_LINK_REISSUE_PREFIX}${generation}`;
}

/**
 * Queue one notification row outside the settlement batch (reissue). INSERT OR
 * IGNORE: the (order_id, kind) PK makes a repeat of the SAME versioned kind a
 * no-op, which is exactly the idempotency the versioned kind exists to scope.
 */
export async function queueNotification(
  db: D1Database,
  orderId: number,
  kind: NotificationKind,
): Promise<void> {
  await db
    .prepare('INSERT OR IGNORE INTO order_notifications (order_id, kind) VALUES (?, ?)')
    .bind(orderId, kind)
    .run();
}

/**
 * Every kind an order could still deliver: pending, or processing with an
 * expired lease. The deliverer iterates THIS rather than the fixed kind list so
 * versioned reissue rows are picked up by the same claim/send/mark machinery.
 */
export async function listUndeliveredKinds(
  db: D1Database,
  orderId: number,
): Promise<string[]> {
  return listUndelivered(ORDERS, db, orderId);
}

async function listUndelivered(o: Outbox, db: D1Database, id: number | string): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT kind FROM ${o.table}
        WHERE ${o.key} = ?
          AND (state = 'pending'
               OR (state = 'processing' AND lease_expires_at < datetime('now')))
        ORDER BY created_at, kind`,
    )
    .bind(id)
    .all<{ kind: string }>();
  return (results ?? []).map((r) => r.kind);
}

/** Attempts after which a row is abandoned as 'dead' (last_error says why). */
export const MAX_ATTEMPTS = 5;
/** Claim lease. A deliverer that dies mid-send frees its row this much later. */
export const LEASE_SECONDS = 120;

/**
 * Claim one row: pending, or processing with an expired lease (a dead
 * deliverer's abandoned claim). Exactly one concurrent caller wins. Returns
 * the attempt number, or null when there is nothing to claim (row absent,
 * already sent/skipped/dead, or validly leased by someone else).
 */
export async function claimNotification(
  db: D1Database,
  orderId: number,
  kind: NotificationKind,
): Promise<number | null> {
  return claim(ORDERS, db, orderId, kind);
}

async function claim(o: Outbox, db: D1Database, id: number | string, kind: string): Promise<number | null> {
  // An abandoned claim (deliverer cancelled mid-send — waitUntil is bounded to
  // ~30s after the response) consumed its attempt at claim time. Once the
  // attempts are spent, park the row instead of reclaiming it forever: HTTP
  // cancellation is exactly the failure mode this table exists to bound.
  await db
    .prepare(
      `UPDATE ${o.table}
          SET state = 'dead', lease_expires_at = NULL,
              last_error = COALESCE(last_error, 'delivery repeatedly interrupted (lease expired)')
        WHERE ${o.key} = ? AND kind = ? AND state = 'processing'
          AND lease_expires_at < datetime('now') AND attempts >= ${MAX_ATTEMPTS}`,
    )
    .bind(id, kind)
    .run();
  const row = await db
    .prepare(
      `UPDATE ${o.table}
          SET state = 'processing',
              attempts = attempts + 1,
              lease_expires_at = datetime('now', '+${LEASE_SECONDS} seconds')
        WHERE ${o.key} = ? AND kind = ? AND attempts < ${MAX_ATTEMPTS}
          AND (state = 'pending'
               OR (state = 'processing' AND lease_expires_at < datetime('now')))
        RETURNING attempts`,
    )
    .bind(id, kind)
    .first<{ attempts: number }>();
  return row?.attempts ?? null;
}

// Every completion update carries the claim's attempt number as a FENCING
// token (`AND attempts = ?`): if worker A's lease expired and worker B
// reclaimed the row (incrementing attempts), a late-resuming A no longer
// matches and cannot clear B's live lease or mark B's work terminal.

export async function markNotificationSent(
  db: D1Database,
  orderId: number,
  kind: NotificationKind,
  attempts: number,
): Promise<void> {
  return markSent(ORDERS, db, orderId, kind, attempts);
}

async function markSent(
  o: Outbox,
  db: D1Database,
  id: number | string,
  kind: string,
  attempts: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE ${o.table}
          SET state = 'sent', sent_at = datetime('now'), lease_expires_at = NULL, last_error = NULL
        WHERE ${o.key} = ? AND kind = ? AND state = 'processing' AND attempts = ?`,
    )
    .bind(id, kind, attempts)
    .run();
}

export async function markNotificationSkipped(
  db: D1Database,
  orderId: number,
  kind: NotificationKind,
  attempts: number,
): Promise<void> {
  return markSkipped(ORDERS, db, orderId, kind, attempts);
}

async function markSkipped(
  o: Outbox,
  db: D1Database,
  id: number | string,
  kind: string,
  attempts: number,
): Promise<void> {
  await db
    .prepare(
      `UPDATE ${o.table}
          SET state = 'skipped', lease_expires_at = NULL
        WHERE ${o.key} = ? AND kind = ? AND state = 'processing' AND attempts = ?`,
    )
    .bind(id, kind, attempts)
    .run();
}

/**
 * Failure: release for retry, or park as 'dead' once attempts are exhausted
 * (or immediately, for conditions no retry can cure — `terminal`). `attempts`
 * is always the claim's own number: it is the fencing token, never a way to
 * force a state.
 */
export async function markNotificationFailed(
  db: D1Database,
  orderId: number,
  kind: NotificationKind,
  attempts: number,
  error: unknown,
  terminal = false,
): Promise<void> {
  return markFailed(ORDERS, db, orderId, kind, attempts, error, terminal);
}

async function markFailed(
  o: Outbox,
  db: D1Database,
  id: number | string,
  kind: string,
  attempts: number,
  error: unknown,
  terminal = false,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await db
    .prepare(
      `UPDATE ${o.table}
          SET state = ?, lease_expires_at = NULL, last_error = ?
        WHERE ${o.key} = ? AND kind = ? AND state = 'processing' AND attempts = ?`,
    )
    .bind(
      terminal || attempts >= MAX_ATTEMPTS ? 'dead' : 'pending',
      message.slice(0, 500),
      id,
      kind,
      attempts,
    )
    .run();
}

// ── Checkout outbox (migration 0042) ─────────────────────────────────────────

/**
 * Queue the failed-payment notices for a reservation, only while it is in the
 * 'failed' state. INSERT OR IGNORE on the (reservation_id, kind) key makes a
 * redelivered provider event a no-op.
 */
export function queueCheckoutFailureNotices(db: D1Database, reservationId: string) {
  return db.batch(
    CHECKOUT_NOTIFICATION_KINDS.map((kind) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO checkout_notifications (reservation_id, kind)
           SELECT ?, ? WHERE EXISTS (
             SELECT 1 FROM checkout_reservations WHERE public_id = ? AND status = 'failed')`,
        )
        .bind(reservationId, kind, reservationId),
    ),
  );
}

export const listUndeliveredCheckoutKinds = (db: D1Database, reservationId: string) =>
  listUndelivered(CHECKOUTS, db, reservationId);
export const claimCheckoutNotification = (db: D1Database, reservationId: string, kind: CheckoutNotificationKind) =>
  claim(CHECKOUTS, db, reservationId, kind);
export const markCheckoutNotificationSent = (
  db: D1Database, reservationId: string, kind: CheckoutNotificationKind, attempts: number,
) => markSent(CHECKOUTS, db, reservationId, kind, attempts);
export const markCheckoutNotificationSkipped = (
  db: D1Database, reservationId: string, kind: CheckoutNotificationKind, attempts: number,
) => markSkipped(CHECKOUTS, db, reservationId, kind, attempts);
export const markCheckoutNotificationFailed = (
  db: D1Database, reservationId: string, kind: CheckoutNotificationKind, attempts: number,
  error: unknown, terminal = false,
) => markFailed(CHECKOUTS, db, reservationId, kind, attempts, error, terminal);
