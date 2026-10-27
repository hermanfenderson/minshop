import { formatMoney } from '../../money.ts';
import type { I18n } from '../../i18n/index.ts';
import type { EmailMessage } from './provider';
import { emailButton, emailItemsTable, emailShell, escapeHtml, PALETTE, type TotalRow } from './layout';

/**
 * The two emails for a delayed payment (a SEPA debit, say) that failed after
 * the buyer left the checkout: no order exists, the held stock is back, and
 * neither side would otherwise ever hear of it. Pure — the outbox passes in
 * everything, the reservation's snapshot included.
 */

export interface FailedCheckout {
  items: { name: string; quantity: number; priceCents: number }[];
  /** What the provider was asked to collect (items, shipping, tax); null if unknown. */
  amountCents: number | null;
  currency: string;
}

function itemsBlock(checkout: FailedCheckout, i18n: I18n): string {
  const money = (cents: number) => formatMoney(cents, checkout.currency, i18n.intl);
  const totals: TotalRow[] =
    checkout.amountCents == null
      ? []
      : [{ label: i18n.t('email.totals.total'), amount: money(checkout.amountCents), strong: true }];
  return emailItemsTable(
    checkout.items.map((item) => ({
      thumb: '',
      name: item.name,
      quantity: item.quantity,
      amount: money(item.priceCents * item.quantity),
    })),
    totals,
  );
}

function itemsText(checkout: FailedCheckout, i18n: I18n): string[] {
  const money = (cents: number) => formatMoney(cents, checkout.currency, i18n.intl);
  return [
    ...checkout.items.map((item) => `- ${item.name} × ${item.quantity}: ${money(item.priceCents * item.quantity)}`),
    ...(checkout.amountCents == null ? [] : [i18n.t('email.text.total', { amount: money(checkout.amountCents) })]),
  ];
}

/** To the buyer: nothing was charged, no order was placed, how to try again. */
export function paymentFailedCustomerEmail(
  to: string,
  checkout: FailedCheckout,
  storeName: string,
  /** Where to start again — the shop's home in the buyer's language. */
  shopUrl: string,
  i18n: I18n,
): EmailMessage {
  const { t } = i18n;
  const html = emailShell({
    storeName,
    heading: t('email.paymentFailed.heading'),
    subheading: escapeHtml(t('email.paymentFailed.subheading')),
    body: itemsBlock(checkout, i18n) + emailButton(shopUrl, t('email.paymentFailed.retry')),
    footer: escapeHtml(t('email.paymentFailed.footer')),
  });
  const text = [
    t('email.paymentFailed.heading'),
    '',
    t('email.paymentFailed.subheading'),
    '',
    ...itemsText(checkout, i18n),
    '',
    t('email.paymentFailed.textRetry', { url: shopUrl }),
  ].join('\n');
  return { to, subject: t('email.paymentFailed.subject', { store: storeName }), html, text };
}

/** To the merchant: who it was, what they wanted, where to follow up. */
export function paymentFailedOwnerEmail(
  to: string,
  buyerEmail: string | null,
  checkout: FailedCheckout,
  storeName: string,
  adminUrl: string,
  i18n: I18n,
): EmailMessage {
  const { t } = i18n;
  const amount =
    checkout.amountCents == null ? '—' : formatMoney(checkout.amountCents, checkout.currency, i18n.intl);
  const who = buyerEmail ?? t('email.notification.unknownAddress');
  const html = emailShell({
    storeName,
    heading: t('email.paymentFailedOwner.heading'),
    subheading: escapeHtml(t('email.paymentFailedOwner.subheading', { amount, email: who })),
    body:
      itemsBlock(checkout, i18n) +
      `<p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:${PALETTE.muted};">${escapeHtml(
        t('email.paymentFailedOwner.explain'),
      )}</p>` +
      emailButton(adminUrl, t('email.paymentFailedOwner.view')),
  });
  const text = [
    t('email.paymentFailedOwner.subheading', { amount, email: who }),
    '',
    ...itemsText(checkout, i18n),
    '',
    t('email.paymentFailedOwner.explain'),
    adminUrl,
  ].join('\n');
  return {
    to,
    subject: t('email.paymentFailedOwner.subject', { store: storeName, amount, email: who }),
    html,
    text,
  };
}
