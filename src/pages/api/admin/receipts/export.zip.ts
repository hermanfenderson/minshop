import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getConfig, toMajorUnits, currencyDecimals } from '../../../../config';
import { readStoredDonor } from '../../../../features/benefit/donor';
import { receiptPdf, type ReceiptRow } from '../../../../features/receipts';
import { localDay } from '../../../../features/receipts/day';
import { zipStream, type ZipEntry } from '../../../../features/receipts/zip';
import { orderReference } from '../../../../features/orders/number';
import { readManualPayment } from '../../../../features/orders/manualPaymentMethod';

export const prerender = false;

const KINDS = ['donation', 'manual_donation', 'shipping', 'refund_note'] as const;
const KIND_LABELS: Record<string, string> = {
  donation: 'Contribution',
  manual_donation: 'Contribution recorded by hand',
  shipping: 'Shipping',
  refund_note: 'Refund note',
};

const esc = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

type Row = ReceiptRow & {
  order_public_id: string | null;
  donor: string | null;
  payment_method: string | null;
  manual_payment: string | null;
  related_label: string | null;
};

// GET /api/admin/receipts/export.zip?year=2027[&kind=manual_donation] — every
// receipt of a year (or of one series) as PDFs, with a register (registro.csv)
// listing them in number order. Behind the admin gate; never cached.
export const GET: APIRoute = async ({ url, locals }) => {
  const year = Number(url.searchParams.get('year'));
  if (!Number.isInteger(year) || year < 2000 || year > 9999) return new Response('Choose a year', { status: 400 });
  const kindParam = url.searchParams.get('kind');
  const kind = (KINDS as readonly string[]).includes(kindParam ?? '') ? kindParam : null;
  const { results } = await env.DB
    .prepare(
      `SELECT r.*, o.public_id AS order_public_id, o.donor, o.payment_method, o.manual_payment, x.label AS related_label
         FROM receipts r
         JOIN orders o ON o.id = r.order_id
         LEFT JOIN receipts x ON x.id = r.replaces_receipt_id
        WHERE r.series_year = ? ${kind ? 'AND r.kind = ?' : ''}
        ORDER BY r.kind, r.number`,
    )
    .bind(...(kind ? [year, kind] : [year]))
    .all<Row>();
  const rows = results ?? [];
  const cfg = getConfig();
  const timeZone = locals.settings?.timeZone ?? cfg.timeZone;
  const fileName = (r: Row) => `${r.label.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`;

  const register = [
    ['Number', 'Kind', 'Issued', 'Amount', 'Currency', 'Donor', 'Tax code / VAT', 'Order', 'Paid with', 'Replaces / cancels', 'File'],
    ...rows.map((r) => {
      const donor = readStoredDonor(r.donor);
      const manual = readManualPayment(r.manual_payment);
      return [
        r.label,
        KIND_LABELS[r.kind] ?? r.kind,
        localDay(r.issued_at, timeZone),
        toMajorUnits(r.amount_cents, r.currency).toFixed(currencyDecimals(r.currency)),
        r.currency,
        donor?.name ?? '',
        donor ? (donor.kind === 'company' ? (donor.vatNumber ?? donor.taxCode ?? '') : (donor.taxCode ?? '')) : '',
        orderReference(r.order_public_id, r.order_id, cfg.orderNumber),
        manual ? `${manual.method} ${manual.receivedOn}${manual.reference ? ` ${manual.reference}` : ''}` : (r.payment_method ?? ''),
        r.related_label ?? '',
        fileName(r),
      ];
    }),
  ]
    .map((line) => line.map(esc).join(','))
    .join('\r\n');

  // The register first, then one PDF at a time: only one is in memory at once.
  let index = -1;
  const next = async (): Promise<ZipEntry | null> => {
    while (true) {
      index++;
      if (index === 0) return { name: 'registro.csv', data: new TextEncoder().encode(`﻿${register}\r\n`) };
      const r = rows[index - 1];
      if (!r) return null;
      const pdf = await receiptPdf(env.DB, r);
      if (pdf) return { name: fileName(r), data: pdf, modified: new Date(`${r.issued_at.replace(' ', 'T')}Z`) };
      console.error(`Receipt ${r.label} has no PDF to export.`);
    }
  };
  const name = `receipts-${year}${kind ? `-${kind}` : ''}.zip`;
  return new Response(zipStream(next), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${name}"`,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
};
