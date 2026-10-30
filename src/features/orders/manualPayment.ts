import type { D1Database } from '@cloudflare/workers-types';
import { claimOrderIdentity } from './guestAccess.ts';
import { recordPaidOrder } from './db.ts';
import type { ManualPayment } from './manualPaymentMethod.ts';

export * from './manualPaymentMethod.ts';

/** Record a payment received outside the shop (see manualPaymentMethod.ts). */
export interface ManualOrderInput {
  product: { id: number; name: string; track_inventory?: number | null };
  variant?: { id: number; name: string } | null;
  amountCents: number;
  currency: string;
  email: string | null;
  locale: string | null;
  payment: ManualPayment;
  /** Benefit Mode: the donor snapshot (features/benefit/donor.ts), so a receipt follows. */
  donor?: string | null;
  /** Benefit Mode: the minimum per unit, which marks the line as a contribution. */
  minPriceCents?: number;
  /** Email the order confirmation to `email`. The owner is never notified: they recorded it. */
  notifyCustomer: boolean;
}

/** Record the payment as a paid order. Returns the new order's id and public id. */
export async function recordManualOrder(
  db: D1Database,
  input: ManualOrderInput,
): Promise<{ orderId: number; publicId: string }> {
  const { publicId } = await claimOrderIdentity(db);
  const orderId = await recordPaidOrder(db, {
    providerSessionId: `manual:${publicId}`,
    publicId,
    email: input.email,
    amountTotalCents: input.amountCents,
    currency: input.currency,
    locale: input.locale,
    paymentMethod: 'manual',
    manualPayment: JSON.stringify(input.payment),
    donor: input.donor ?? null,
    notify: { customer: input.notifyCustomer && Boolean(input.email), owner: false },
    items: [
      {
        productId: input.product.id,
        variantId: input.variant?.id ?? null,
        name: input.variant ? `${input.product.name} — ${input.variant.name}` : input.product.name,
        priceCents: input.amountCents,
        quantity: 1,
        untracked: input.product.track_inventory === 0,
        ...(input.minPriceCents != null ? { minPriceCents: input.minPriceCents } : {}),
      },
    ],
  });
  if (!orderId) throw new Error(`Manual order ${publicId} was not recorded.`);
  return { orderId, publicId };
}
