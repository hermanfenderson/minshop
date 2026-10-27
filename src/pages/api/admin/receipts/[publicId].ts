import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { parsePublicId } from '../../../../features/ids/publicId.ts';
import { getReceiptByPublicId, receiptPdf } from '../../../../features/receipts';

export const prerender = false;

// GET /api/admin/receipts/:publicId — an issued receipt as the donor got it.
// Behind the admin gate like every /api/admin route; never cached (donor data).
export const GET: APIRoute = async ({ params }) => {
  const id = parsePublicId(params.publicId, 'receipt');
  const receipt = id ? await getReceiptByPublicId(env.DB, id) : null;
  const pdf = receipt ? await receiptPdf(env.DB, receipt) : null;
  if (!receipt || !pdf) return new Response('Receipt not found', { status: 404 });
  return new Response(pdf, {
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-disposition': `inline; filename="${receipt.label.replace(/[^A-Za-z0-9-]/g, '-')}.pdf"`,
    },
  });
};
