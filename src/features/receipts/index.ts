import type { D1Database } from '@cloudflare/workers-types';
import { getConfig } from '../../config';
import { createI18n } from '../../i18n/index.ts';
import { readStoredDonor } from '../benefit/donor';
import { orderLocale } from '../i18n/order';
import { orderReference } from '../orders/number';
import { getSetting } from '../settings/db';
import { normalizeTimeZone } from '../settings/timeZone';
import { countryName } from '../shipping/countries';
import { getFileStorage, getStorage } from '../storage/index.ts';
import {
  buildReceiptDocument,
  readReceiptDocument,
  renderReceiptPdf,
  type ReceiptGift,
} from './document';
import { localDay } from './day';
import { RECEIPT_SETTINGS_SQL, parseReceiptSettings, seriesPrefix, type ReceiptSettings } from './settings';
import { allocateReceipt, listOrderReceipts, liveReceipts, type ReceiptRow } from './store';
import { planReceipts, type ContributionKind, type ReceiptSeriesKind } from './reconcile';
import { isContributionKind } from './document';
import { readManualPayment } from '../orders/manualPaymentMethod';

export { getReceiptByPublicId, listOrderReceipts, type ReceiptRow } from './store';

/**
 * Receipt issuing (R11/R12/R15). An order paid in Benefit Mode carries its
 * donor (orders.donor); from it the shop issues a contribution receipt and,
 * when shipping was charged, a separate shipping receipt.
 *
 * Like fulfillment, issuing is safe to call from every settlement path and on
 * every redelivery: each document has a fixed issue_key, so it exists at most
 * once, and its number is taken in the same INSERT that writes it. It never
 * throws into settlement — the order is paid either way, and what it leaves
 * unfinished (no issuer configured yet, storage down) the cron completes.
 */

interface ReceiptOrder {
  id: number;
  public_id: string | null;
  locale: string | null;
  amount_total_cents: number;
  shipping_cents: number;
  refunded_cents: number;
  currency: string;
  payment_method: string | null;
  donor: string | null;
  manual_payment: string | null;
  created_at: string;
}

export async function loadReceiptSettings(db: D1Database): Promise<ReceiptSettings> {
  const { results } = await db.prepare(RECEIPT_SETTINGS_SQL).all<{ key: string; value: string }>();
  return parseReceiptSettings(results ?? []);
}

async function storeTimeZone(db: D1Database): Promise<string> {
  return normalizeTimeZone(await getSetting(db, 'time_zone')) ?? getConfig().timeZone;
}

/** Gifts: every line that is not itself a contribution with nothing to deliver. */
async function orderGifts(db: D1Database, orderId: number): Promise<ReceiptGift[]> {
  const { results } = await db
    .prepare(
      `SELECT oi.name, oi.quantity
         FROM order_items oi
         LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
          AND NOT (COALESCE(p.track_inventory, 1) = 0 AND COALESCE(p.requires_shipping, 1) = 0 AND p.file_key IS NULL)
        ORDER BY oi.id`,
    )
    .bind(orderId)
    .all<{ name: string; quantity: number }>();
  return (results ?? []).map((r) => ({ name: r.name, quantity: r.quantity }));
}

async function readImage(key: string | null): Promise<Uint8Array | null> {
  if (!key) return null;
  try {
    const stored = await getStorage().get(key);
    return stored ? new Uint8Array(await new Response(stored.body).arrayBuffer()) : null;
  } catch (err) {
    console.error(`Receipt image ${key} unreadable:`, err);
    return null;
  }
}

/** The image bytes a document names, when they can be read. */
export async function receiptImages(doc: { stampKey: string | null; logoKey: string | null }) {
  return { stamp: await readImage(doc.stampKey), logo: await readImage(doc.logoKey) };
}

/** Snapshot (once) and render (until stored) one allocated receipt. */
async function completeReceipt(
  db: D1Database,
  row: ReceiptRow,
  order: ReceiptOrder,
  settings: ReceiptSettings,
  timeZone: string,
  related: ReceiptRow | undefined,
): Promise<void> {
  let doc = row.document ? readReceiptDocument(row.document) : null;
  if (!doc) {
    const donor = readStoredDonor(order.donor);
    if (!donor) return;
    const i18n = createI18n(orderLocale(order.locale));
    const manual = readManualPayment(order.manual_payment);
    doc = buildReceiptDocument({
      kind: row.kind,
      label: row.label,
      issuedOn: localDay(row.issued_at, timeZone),
      // A refund note speaks of the day the money went back, not the payment day.
      // A payment recorded by hand happened on the day the money arrived.
      paidOn:
        row.kind === 'refund_note'
          ? localDay(row.issued_at, timeZone)
          : (manual?.receivedOn ?? localDay(order.created_at, timeZone)),
      amountCents: row.amount_cents,
      currency: row.currency,
      orderRef: orderReference(order.public_id, order.id, getConfig().orderNumber),
      paymentMethod: manual ? `manual:${manual.method}` : order.payment_method,
      donor,
      gifts: isContributionKind(row.kind) ? await orderGifts(db, order.id) : [],
      relatedLabel: related?.label ?? null,
      settings,
      i18n,
      countryName: (code) => countryName(code, i18n.locale),
    });
    // Guarded on the empty document so a concurrent issuer's snapshot is never overwritten.
    await db
      .prepare("UPDATE receipts SET document = ? WHERE id = ? AND document = ''")
      .bind(JSON.stringify(doc), row.id)
      .run();
    const stored = await db.prepare('SELECT document FROM receipts WHERE id = ?').bind(row.id).first<{ document: string }>();
    doc = stored ? readReceiptDocument(stored.document) : null;
    if (!doc) return;
  }
  if (row.pdf_key) return;
  const pdf = renderReceiptPdf(doc, await receiptImages(doc));
  const key = `receipts/${row.series_year}/${row.public_id}.pdf`;
  await getFileStorage().put(key, pdf.buffer as ArrayBuffer, 'application/pdf');
  await db.prepare('UPDATE receipts SET pdf_key = ? WHERE id = ?').bind(key, row.id).run();
}

/**
 * Issue whatever this order is owed and has not got yet. Returns quietly for a
 * standard order, and leaves a Benefit Mode order for the cron while the
 * issuer details are missing — a receipt without its issuer is no receipt.
 */
export async function issueOrderReceipts(db: D1Database, orderId: number): Promise<void> {
  const order = await db
    .prepare(
      `SELECT id, public_id, locale, amount_total_cents, shipping_cents, refunded_cents, currency, payment_method, donor, manual_payment, created_at
         FROM orders WHERE id = ? AND donor IS NOT NULL`,
    )
    .bind(orderId)
    .first<ReceiptOrder>();
  if (!order || !readStoredDonor(order.donor)) return;
  // Cash never gets a receipt (it gives the donor no tax benefit).
  if (readManualPayment(order.manual_payment)?.method === 'cash') return;
  // Contributions recorded by hand are numbered in their own series.
  const contributionKind: ContributionKind = order.payment_method === 'manual' ? 'manual_donation' : 'donation';
  const settings = await loadReceiptSettings(db);
  if (settings.issuer.length === 0) return;
  const timeZone = await storeTimeZone(db);
  const year = Number(localDay(new Date().toISOString(), timeZone).slice(0, 4));

  // What the order keeps after refunds decides what must be in force; the plan
  // is deterministic, so concurrent passes produce the same issue keys.
  const rows = await listOrderReceipts(db, order.id);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const lastNote: Partial<Record<ReceiptSeriesKind, number>> = {};
  for (const r of rows) {
    const cancelled = r.kind === 'refund_note' && r.replaces_receipt_id != null ? byId.get(r.replaces_receipt_id) : undefined;
    if (cancelled && (isContributionKind(cancelled.kind) || cancelled.kind === 'shipping')) lastNote[cancelled.kind] = r.id;
  }
  const live = liveReceipts(rows).map((r) => ({ id: r.id, kind: r.kind as ReceiptSeriesKind, amountCents: r.amount_cents }));
  const plan = planReceipts(
    order.id,
    { totalCents: order.amount_total_cents, shippingCents: order.shipping_cents, refundedCents: order.refunded_cents },
    live,
    lastNote,
    contributionKind,
  );
  // In plan order: a note is always taken before the receipt that replaces
  // the one it cancels, so an interrupted pass never skips the note.
  for (const action of plan) {
    const kind = action.type === 'note' ? 'refund_note' : action.kind;
    await allocateReceipt(db, {
      orderId: order.id,
      kind,
      year,
      prefix: seriesPrefix(settings, kind),
      amountCents: action.amountCents,
      currency: order.currency.toUpperCase(),
      issueKey: action.issueKey,
      replaces: action.type === 'note' ? action.cancels : action.replaces,
    });
  }
  const all = await listOrderReceipts(db, order.id);
  for (const row of all) {
    if (row.document && row.pdf_key) continue;
    const related = row.replaces_receipt_id == null ? undefined : all.find((r) => r.id === row.replaces_receipt_id);
    await completeReceipt(db, row, order, settings, timeZone, related);
  }
}

/** Settlement hook: like dispatchFulfillment, it never throws into the caller. */
export async function dispatchReceipts(db: D1Database, orderId: number): Promise<void> {
  try {
    await issueOrderReceipts(db, orderId);
  } catch (err) {
    console.error(`Receipt issuing failed for order ${orderId}:`, err);
  }
}

/**
 * Cron: orders whose receipts in force do not add up to what they keep (none
 * issued yet, or a refund not yet answered), and documents not yet rendered.
 */
export async function sweepReceipts(db: D1Database, limit = 20): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT o.id FROM orders o
        WHERE o.donor IS NOT NULL
          AND NOT (json_valid(o.manual_payment) AND json_extract(o.manual_payment, '$.method') = 'cash')
          AND ((SELECT COALESCE(SUM(r.amount_cents), 0) FROM receipts r
                 WHERE r.order_id = o.id AND r.kind IN ('donation', 'manual_donation', 'shipping')
                   AND NOT EXISTS (SELECT 1 FROM receipts x WHERE x.replaces_receipt_id = r.id))
                 <> o.amount_total_cents - o.refunded_cents
               OR EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = o.id AND (r.pdf_key IS NULL OR r.document = '')))
        ORDER BY o.id LIMIT ?`,
    )
    .bind(limit)
    .all<{ id: number }>();
  for (const { id } of results ?? []) await dispatchReceipts(db, id);
}

/** The stored PDF, re-rendered from its snapshot if the file went missing. */
export async function receiptPdf(db: D1Database, row: ReceiptRow): Promise<Uint8Array<ArrayBuffer> | null> {
  if (row.pdf_key) {
    const stored = await getFileStorage().get(row.pdf_key);
    if (stored) return new Uint8Array(await new Response(stored.body).arrayBuffer());
  }
  const doc = row.document ? readReceiptDocument(row.document) : null;
  return doc ? renderReceiptPdf(doc, await receiptImages(doc)) : null;
}
