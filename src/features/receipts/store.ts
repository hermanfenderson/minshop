// Explicit .ts imports: the D1 integration suite loads this module under plain Node.
import type { D1Database } from '@cloudflare/workers-types';
import { generatePublicId } from '../ids/publicId.ts';
import type { ReceiptKind } from './document.ts';

/** Receipt rows (0047): numbering and lookups, with no bindings or rendering. */

export interface ReceiptRow {
  id: number;
  public_id: string;
  order_id: number;
  kind: ReceiptKind;
  series_year: number;
  number: number;
  label: string;
  amount_cents: number;
  currency: string;
  document: string;
  pdf_key: string | null;
  replaces_receipt_id: number | null;
  issued_at: string;
}

export async function listOrderReceipts(db: D1Database, orderId: number): Promise<ReceiptRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM receipts WHERE order_id = ? ORDER BY id')
    .bind(orderId)
    .all<ReceiptRow>();
  return results ?? [];
}

export async function getReceiptByPublicId(db: D1Database, publicId: string): Promise<ReceiptRow | null> {
  return db.prepare('SELECT * FROM receipts WHERE public_id = ?').bind(publicId).first<ReceiptRow>();
}

/**
 * Take the next number in the kind's series for `year` and write the row, or
 * do nothing when a document with this issue_key already exists. One statement:
 * SQLite runs it alone, so MAX + 1 cannot be read twice, and an attempt that
 * fails writes nothing — the series has no holes.
 */
export async function allocateReceipt(
  db: D1Database,
  args: { orderId: number; kind: ReceiptKind; year: number; prefix: string; amountCents: number; currency: string; issueKey: string },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO receipts (public_id, order_id, kind, series_year, number, label, amount_cents, currency, document, issue_key)
       SELECT ?, ?, ?, ?, n, ? || n || '/' || ?, ?, ?, '', ?
         FROM (SELECT COALESCE(MAX(number), 0) + 1 AS n FROM receipts WHERE kind = ? AND series_year = ?)
        -- The WHERE is required: without it SQLite reads ON CONFLICT as a join's ON.
        WHERE true
       ON CONFLICT(issue_key) DO NOTHING`,
    )
    .bind(
      generatePublicId('receipt'),
      args.orderId,
      args.kind,
      args.year,
      args.prefix,
      // As text: D1 binds a JS number as REAL, which would print "2027.0".
      String(args.year),
      args.amountCents,
      args.currency,
      args.issueKey,
      args.kind,
      args.year,
    )
    .run();
}
