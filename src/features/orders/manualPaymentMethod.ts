/**
 * Payments received outside the shop (migration 0050): a bank transfer, a
 * cheque, a card terminal, cash. An admin records one and it becomes an
 * ordinary paid order — payment_method 'manual', its own order page and emails,
 * counted with the others — with how and when the money came kept in
 * orders.manual_payment.
 *
 * Only products that ship nothing can be recorded this way: there is no address
 * and no shipping step, so nothing may be handed to a fulfiller.
 *
 * This half is pure (the receipts read it); the recording is in manualPayment.ts.
 */

export const MANUAL_PAYMENT_METHODS = ['bank_transfer', 'cheque', 'pos', 'paypal', 'cash'] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

/** The methods a receipt can name: cash never gets one. */
export const RECEIPT_MANUAL_METHODS: readonly ManualPaymentMethod[] = MANUAL_PAYMENT_METHODS.filter((m) => m !== 'cash');

export const MANUAL_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  pos: 'Card terminal (POS)',
  paypal: 'PayPal (outside the shop)',
  cash: 'Cash',
};

export interface ManualPayment {
  method: ManualPaymentMethod;
  /** The day the money arrived, YYYY-MM-DD. */
  receivedOn: string;
  /** The bank's reference (CRO/TRN), cheque number…; empty when none. */
  reference: string;
  note: string;
}

export const isManualPaymentMethod = (v: unknown): v is ManualPaymentMethod =>
  typeof v === 'string' && (MANUAL_PAYMENT_METHODS as readonly string[]).includes(v);

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar day, not after `today`. */
export function isReceivedOn(value: string, today: string): boolean {
  if (!DAY.test(value) || value > today) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function readManualPayment(json: string | null | undefined): ManualPayment | null {
  if (!json) return null;
  try {
    const p = JSON.parse(json) as Partial<ManualPayment>;
    if (!isManualPaymentMethod(p.method) || typeof p.receivedOn !== 'string' || !DAY.test(p.receivedOn)) return null;
    return { method: p.method, receivedOn: p.receivedOn, reference: String(p.reference ?? ''), note: String(p.note ?? '') };
  } catch {
    return null;
  }
}
