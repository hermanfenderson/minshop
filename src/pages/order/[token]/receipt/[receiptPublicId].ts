import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { isAccessToken } from '../../../../features/ids/token.ts';
import { parsePublicId } from '../../../../features/ids/publicId.ts';
import { resolveAccessToken } from '../../../../features/orders/guestAccess.ts';
import { getOrderByPublicId } from '../../../../features/orders/db.ts';
import { getReceiptByPublicId, receiptPdf } from '../../../../features/receipts';

export const prerender = false;

// The receipt carries the donor's tax code and address: like the order page it
// is reached only through the order's access token, never cached, never leaked
// in a referrer.
const PRIVATE_HEADERS = { 'cache-control': 'private, no-store', 'referrer-policy': 'no-referrer' };

export const GET: APIRoute = async ({ params, locals }) => {
  const { t } = locals.i18n;
  const notFound = () => new Response(t('order.download.notFound'), { status: 404, headers: PRIVATE_HEADERS });
  const token = params.token;
  const receiptId = parsePublicId(params.receiptPublicId, 'receipt');
  if (!token || !isAccessToken(token) || !receiptId) return notFound();
  const access = await resolveAccessToken(env.DB, token);
  const order = access ? await getOrderByPublicId(env.DB, access.order_public_id) : null;
  const receipt = order ? await getReceiptByPublicId(env.DB, receiptId) : null;
  if (!order || !receipt || receipt.order_id !== order.id) return notFound();
  const pdf = await receiptPdf(env.DB, receipt);
  if (!pdf) return new Response(t('order.download.fileUnavailable'), { status: 404, headers: PRIVATE_HEADERS });
  const name = `${receipt.label.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`;
  return new Response(pdf, {
    headers: {
      ...PRIVATE_HEADERS,
      'content-type': 'application/pdf',
      'x-content-type-options': 'nosniff',
      'content-disposition': `inline; filename="${name}"`,
    },
  });
};
