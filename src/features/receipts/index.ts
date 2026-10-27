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
  type ReceiptKind,
} from './document';
import { localDay } from './day';
import { RECEIPT_SETTINGS_SQL, parseReceiptSettings, seriesPrefix, type ReceiptSettings } from './settings';
import { allocateReceipt, listOrderReceipts, type ReceiptRow } from './store';

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
  currency: string;
  payment_method: string | null;
  donor: string | null;
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
): Promise<void> {
  let doc = row.document ? readReceiptDocument(row.document) : null;
  if (!doc) {
    const donor = readStoredDonor(order.donor);
    if (!donor) return;
    const i18n = createI18n(orderLocale(order.locale));
    doc = buildReceiptDocument({
      kind: row.kind,
      label: row.label,
      issuedOn: localDay(row.issued_at, timeZone),
      paidOn: localDay(order.created_at, timeZone),
      amountCents: row.amount_cents,
      currency: row.currency,
      orderRef: orderReference(order.public_id, order.id, getConfig().orderNumber),
      paymentMethod: order.payment_method,
      donor,
      gifts: row.kind === 'donation' ? await orderGifts(db, order.id) : [],
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
      `SELECT id, public_id, locale, amount_total_cents, shipping_cents, currency, payment_method, donor, created_at
         FROM orders WHERE id = ? AND donor IS NOT NULL`,
    )
    .bind(orderId)
    .first<ReceiptOrder>();
  if (!order || !readStoredDonor(order.donor)) return;
  const settings = await loadReceiptSettings(db);
  if (settings.issuer.length === 0) return;
  const timeZone = await storeTimeZone(db);
  const year = Number(localDay(new Date().toISOString(), timeZone).slice(0, 4));

  const shipping = Math.max(0, order.shipping_cents);
  const owed: Array<{ kind: ReceiptKind; amountCents: number }> = [
    { kind: 'donation', amountCents: order.amount_total_cents - shipping },
    { kind: 'shipping', amountCents: shipping },
  ];
  for (const { kind, amountCents } of owed) {
    if (amountCents <= 0) continue;
    await allocateReceipt(db, {
      orderId: order.id,
      kind,
      year,
      prefix: seriesPrefix(settings, kind),
      amountCents,
      currency: order.currency.toUpperCase(),
      issueKey: `${kind}:${order.id}`,
    });
  }
  for (const row of await listOrderReceipts(db, order.id)) {
    if (row.document && row.pdf_key) continue;
    await completeReceipt(db, row, order, settings, timeZone);
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

/** Cron: orders still owed a document, and documents not yet rendered. */
export async function sweepReceipts(db: D1Database, limit = 20): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT o.id FROM orders o
        WHERE o.donor IS NOT NULL AND o.status = 'paid'
          AND (NOT EXISTS (SELECT 1 FROM receipts r WHERE r.order_id = o.id AND r.kind = 'donation')
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
