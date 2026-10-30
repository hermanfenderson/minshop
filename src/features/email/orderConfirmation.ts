import { formatPrice, getConfig } from '../../config';
import { enI18n, type I18n } from '../../i18n/index.ts';
import { withMount } from '../../deployment';
import type { Order, OrderItemWithImage, ShippingAddress } from '../orders/db';
import { orderReference } from '../orders/number';
import {
  productEmailImageUrl,
  type ImageDelivery,
} from '../products/image';
import { carrierName, trackingUrl } from '../orders/tracking';
import type { EmailMessage } from './provider';
import {
  PALETTE,
  emailShell,
  emailButton,
  emailLabel,
  emailItemsTable,
  escapeHtml,
  type TotalRow,
} from './layout';

// Every builder takes a trailing `i18n`. Emails go out after the request that
// caused them (webhooks, the outbox sweep, the cron), so callers pass the
// order's stored language (features/i18n/email.ts); English is the default.

/** A 48px product thumbnail cell (absolute URL so email clients can fetch it).
 *  `new URL` resolves both an absolute image base (R2 domain) and the relative
 *  /images route against the site origin. */
const thumbCell = (
  imageKey: string | null,
  baseUrl: string,
  imageDelivery: ImageDelivery,
): string => {
  const src = productEmailImageUrl(
    imageKey,
    baseUrl,
    getConfig().images.baseUrl,
    imageDelivery,
  );
  return `<td style="width:60px;padding:10px 0;border-bottom:1px solid ${PALETTE.line};"><img src="${escapeHtml(src)}" width="48" height="48" alt="" style="display:block;border-radius:4px;object-fit:cover;background:${PALETTE.paper};" /></td>`;
};

/** Shipping / discount / tax / total, in the order they appear on a receipt. */
function totalRows(order: Order, money: (cents: number) => string, i18n: I18n): TotalRow[] {
  const { t } = i18n;
  return [
    ...(order.shipping_cents > 0
      ? [{ label: t('email.totals.shipping'), amount: money(order.shipping_cents) }]
      : []),
    ...(order.discount_cents > 0
      ? [{ label: t('email.totals.discount'), amount: `&minus;${money(order.discount_cents)}` }]
      : []),
    ...(order.tax_cents > 0 ? [{ label: t('email.totals.tax'), amount: money(order.tax_cents) }] : []),
    { label: t('email.totals.total'), amount: money(order.amount_total_cents), strong: true },
  ];
}

/** The same totals as plain-text lines. */
function totalLines(order: Order, money: (cents: number) => string, i18n: I18n): string[] {
  const { t } = i18n;
  return [
    ...(order.shipping_cents > 0 ? [t('email.text.shipping', { amount: money(order.shipping_cents) })] : []),
    ...(order.discount_cents > 0 ? [t('email.text.discount', { amount: money(order.discount_cents) })] : []),
    ...(order.tax_cents > 0 ? [t('email.text.tax', { amount: money(order.tax_cents) })] : []),
    t('email.text.total', { amount: money(order.amount_total_cents) }),
  ];
}

/** One-line-per-field shipping address, blank lines dropped. */
function formatShipAddress(order: Order): string {
  if (!order.ship_address) return '-';
  const a = JSON.parse(order.ship_address) as ShippingAddress;
  return [
    a.name,
    a.line1,
    a.line2,
    [a.city, a.state, a.postal].filter(Boolean).join(', '),
    a.country,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Build the order-confirmation email for a paid order. `order.email` must be set.
 * `baseUrl` is the site origin (e.g. https://shop.example.com) for the order link.
 */
export function orderConfirmationEmail(
  order: Order,
  items: OrderItemWithImage[],
  baseUrl: string,
  storeName: string,
  imageDelivery: ImageDelivery = 'original',
  /** Tokenized guest link (allowlisted email position); null = omit the link. */
  guestOrderUrl?: string | null,
  i18n: I18n = enI18n,
): EmailMessage {
  const { t, th } = i18n;
  const cfg = getConfig();
  const num = orderReference(order.public_id, order.id, cfg.orderNumber);
  const money = (cents: number) => formatPrice(cents, order.currency, i18n.intl);
  const orderUrl = guestOrderUrl ?? null;
  const hasDigital = items.some((item) => Boolean(item.file_key));

  const rows = items.map(
    (it) => `${it.name} × ${it.quantity}: ${money(it.price_cents * it.quantity)}`,
  );

  const text = [
    t('email.confirmation.textThanks'),
    ``,
    t('email.confirmation.textOrder', { num, store: storeName }),
    ``,
    ...rows,
    ...totalLines(order, money, i18n),
    ...(hasDigital && orderUrl ? [``, t('email.confirmation.downloadReady')] : []),
    ...(orderUrl ? [``, t('email.text.viewOrder', { url: orderUrl })] : []),
  ].join('\n');

  const html = emailShell({
    storeName,
    heading: t('email.confirmation.heading'),
    subheading: th('email.confirmation.subheading', { num }),
    body:
      emailItemsTable(
        items.map((it) => ({
          thumb: thumbCell(it.image_key, baseUrl, imageDelivery),
          name: it.name,
          quantity: it.quantity,
          amount: money(it.price_cents * it.quantity),
        })),
        totalRows(order, money, i18n),
      ) +
      (hasDigital && orderUrl
        ? `<p style="margin:20px 0 0;font-size:14px;">${t('email.confirmation.downloadReady')}</p>`
        : '') +
      (orderUrl ? emailButton(orderUrl, t('email.button.viewOrder')) : ''),
    footer: t('email.confirmation.footer'),
  });

  return {
    to: order.email!,
    subject: t('email.confirmation.subject', { store: storeName, num }),
    html,
    text,
  };
}

/**
 * Build the store-owner "new order" notification. `to` is the owner address;
 * `baseUrl` is the site origin for the admin order link.
 */
export function orderNotificationEmail(
  order: Order,
  items: OrderItemWithImage[],
  to: string,
  baseUrl: string,
  storeName: string,
  imageDelivery: ImageDelivery = 'original',
  i18n: I18n = enI18n,
): EmailMessage {
  const { t, th } = i18n;
  const publicId = order.public_id ?? '—';
  // ASCII hyphen on purpose: a non-ASCII char anywhere in a header forces RFC
  // 2047 encoded-words, which read as "=?utf-8?b?...?=" in raw logs. The em
  // dashes in the BODY are fine — bodies declare their charset.
  const subjectPublicId = order.public_id ? ` - ${order.public_id}` : '';
  const money = (cents: number) => formatPrice(cents, order.currency, i18n.intl);
  const shipText = formatShipAddress(order);
  const adminUrl = baseUrl + withMount(`/admin/orders/${order.public_id ?? order.id}`);

  const rows = items.map(
    (it) => `${it.name} × ${it.quantity}: ${money(it.price_cents * it.quantity)}`,
  );

  const text = [
    t('email.notification.textHeading', { id: order.id }),
    t('email.notification.textPublicId', { publicId }),
    ``,
    t('email.notification.textCustomer', { email: order.email ?? '-' }),
    ``,
    t('email.notification.textShipTo'),
    shipText,
    ``,
    ...rows,
    ...totalLines(order, money, i18n),
    ``,
    t('email.notification.textViewInAdmin', { url: adminUrl }),
  ].join('\n');

  const html = emailShell({
    storeName,
    heading: t('email.notification.heading', { id: order.id }),
    subheading: th('email.notification.subheading', {
      amount: money(order.amount_total_cents),
      email: order.email ?? t('email.notification.unknownAddress'),
    }),
    body:
      emailLabel(t('email.notification.identifiers')) +
      `<p style="margin:0;font-size:14px;line-height:1.6;">${th('email.notification.orderNumber', { id: order.id })}<br><span style="font-family:monospace;">${escapeHtml(publicId)}</span></p>` +
      emailLabel(t('email.notification.shipTo')) +
      `<p style="margin:0;font-size:14px;line-height:1.6;">${escapeHtml(shipText).replace(/\n/g, '<br>')}</p>` +
      emailItemsTable(
        items.map((it) => ({
          thumb: thumbCell(it.image_key, baseUrl, imageDelivery),
          name: it.name,
          quantity: it.quantity,
          amount: money(it.price_cents * it.quantity),
        })),
        totalRows(order, money, i18n),
      ) +
      emailButton(adminUrl, t('email.notification.viewInAdmin')),
  });

  return {
    to,
    subject: `${t('email.notification.subject', { store: storeName, id: order.id })}${subjectPublicId}`,
    html,
    text,
  };
}

/** Build the "your order has shipped" email. `order.email` must be set. */
export function orderShippedEmail(
  order: Order,
  storeName: string,
  /** Tokenized guest link (allowlisted email position); null = omit the link. */
  guestOrderUrl?: string | null,
  i18n: I18n = enI18n,
): EmailMessage {
  const { t, th } = i18n;
  const cfg = getConfig();
  const num = orderReference(order.public_id, order.id, cfg.orderNumber);
  const url = order.tracking_url ?? trackingUrl(order.tracking_carrier, order.tracking_number);
  const orderUrl = guestOrderUrl ?? null;
  const carrier = carrierName(order.tracking_carrier, i18n);

  const text = [
    t('email.shipped.textShipped', { num }),
    ...(order.tracking_number
      ? [
          ``,
          t('email.shipped.textCarrier', { carrier }),
          t('email.shipped.textTracking', { number: order.tracking_number }),
          ...(url ? [t('email.shipped.textTrackIt', { url })] : []),
        ]
      : []),
    ...(orderUrl ? [``, t('email.text.viewOrder', { url: orderUrl })] : []),
  ].join('\n');

  const trackingHtml = order.tracking_number
    ? emailLabel(t('email.shipped.tracking')) +
      `<p style="margin:0;font-size:14px;line-height:1.6;">
        ${escapeHtml(carrier)}<br>
        ${
          url
            ? `<a href="${url}" style="color:${PALETTE.brand};font-weight:600;">${escapeHtml(order.tracking_number)}</a>`
            : escapeHtml(order.tracking_number)
        }
      </p>`
    : '';

  const html = emailShell({
    storeName,
    heading: t('email.shipped.heading'),
    subheading: th('email.shipped.subheading', { num }),
    body:
      trackingHtml +
      (url
        ? emailButton(url, t('email.shipped.trackPackage'))
        : orderUrl
          ? emailButton(orderUrl, t('email.button.viewOrder'))
          : ''),
    footer:
      orderUrl && url
        ? `${t('email.shipped.orderDetails')} <a href="${orderUrl}" style="color:${PALETTE.muted};">${orderUrl}</a>`
        : undefined,
  });

  return {
    to: order.email!,
    subject: t('email.shipped.subject', { store: storeName, num }),
    html,
    text,
  };
}

/** One package of an order, as its email tells it (features/fulfillment/packages.ts). */
export interface ShippedPackage {
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  items: Array<{ name: string; quantity: number }>;
}

/**
 * One email per package. An order that leaves in one package reads as before
 * («your order is on its way»); one that leaves in several says what this
 * package holds and what is still to come, so nobody waits for a parcel that
 * already arrived or wonders where the rest went.
 */
export function packageShippedEmail(
  order: Order,
  pkg: ShippedPackage,
  /** Units still waiting for a package, by line. */
  waiting: Array<{ name: string; quantity: number }>,
  /** All packages of the order so far, this one included. */
  packageCount: number,
  storeName: string,
  guestOrderUrl?: string | null,
  i18n: I18n = enI18n,
): EmailMessage {
  const { t, th } = i18n;
  const num = orderReference(order.public_id, order.id, getConfig().orderNumber);
  const url = pkg.trackingUrl ?? trackingUrl(pkg.carrier, pkg.trackingNumber);
  const orderUrl = guestOrderUrl ?? null;
  const carrier = carrierName(pkg.carrier, i18n);
  const whole = packageCount === 1 && waiting.length === 0;
  const line = (i: { name: string; quantity: number }) => (i.quantity > 1 ? `${i.quantity} × ${i.name}` : i.name);

  const text = [
    whole ? t('email.shipped.textShipped', { num }) : t('email.package.textShipped', { num }),
    ...(!whole && pkg.items.length > 0 ? [``, t('email.package.contains'), ...pkg.items.map((i) => `- ${line(i)}`)] : []),
    ...(pkg.trackingNumber
      ? [
          ``,
          t('email.shipped.textCarrier', { carrier }),
          t('email.shipped.textTracking', { number: pkg.trackingNumber }),
          ...(url ? [t('email.shipped.textTrackIt', { url })] : []),
        ]
      : []),
    ...(waiting.length > 0
      ? [``, t('email.package.waiting'), ...waiting.map((i) => `- ${line(i)}`)]
      : !whole
        ? [``, t('email.package.lastOne')]
        : []),
    ...(orderUrl ? [``, t('email.text.viewOrder', { url: orderUrl })] : []),
  ].join('\n');

  const list = (items: Array<{ name: string; quantity: number }>) =>
    `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${items.map((i) => escapeHtml(line(i))).join('<br>')}</p>`;
  const trackingHtml = pkg.trackingNumber
    ? emailLabel(t('email.shipped.tracking')) +
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        ${escapeHtml(carrier)}<br>
        ${
          url
            ? `<a href="${url}" style="color:${PALETTE.brand};font-weight:600;">${escapeHtml(pkg.trackingNumber)}</a>`
            : escapeHtml(pkg.trackingNumber)
        }
      </p>`
    : '';
  const containsHtml = !whole && pkg.items.length > 0 ? emailLabel(t('email.package.contains')) + list(pkg.items) : '';
  const waitingHtml =
    waiting.length > 0
      ? emailLabel(t('email.package.waiting')) + list(waiting)
      : !whole
        ? `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;">${escapeHtml(t('email.package.lastOne'))}</p>`
        : '';

  const html = emailShell({
    storeName,
    heading: whole ? t('email.shipped.heading') : t('email.package.heading'),
    subheading: whole ? th('email.shipped.subheading', { num }) : th('email.package.subheading', { num }),
    body:
      containsHtml +
      trackingHtml +
      waitingHtml +
      (url
        ? emailButton(url, t('email.shipped.trackPackage'))
        : orderUrl
          ? emailButton(orderUrl, t('email.button.viewOrder'))
          : ''),
    footer:
      orderUrl && url
        ? `${t('email.shipped.orderDetails')} <a href="${orderUrl}" style="color:${PALETTE.muted};">${orderUrl}</a>`
        : undefined,
  });

  return {
    to: order.email!,
    subject: whole
      ? t('email.shipped.subject', { store: storeName, num })
      : t('email.package.subject', { store: storeName, num }),
    html,
    text,
  };
}

/**
 * Refund notice. Sent once per newly recognised refund — the amount the total
 * just advanced by, not the cumulative total — so a partial refund followed by
 * another reads as two distinct amounts rather than one growing number.
 *
 * `refundedCents` is the running total, shown only when it differs from this
 * refund, i.e. when there was an earlier one.
 */
export function orderRefundedEmail(
  order: Order,
  refundCents: number,
  refundedCents: number,
  storeName: string,
  /** Tokenized guest link (allowlisted email position); null = omit the link. */
  guestOrderUrl?: string | null,
  i18n: I18n = enI18n,
): EmailMessage {
  const { t, th } = i18n;
  const cfg = getConfig();
  const num = orderReference(order.public_id, order.id, cfg.orderNumber);
  const orderUrl = guestOrderUrl ?? null;
  const full = refundedCents >= order.amount_total_cents;
  const remaining = Math.max(0, order.amount_total_cents - refundedCents);
  const method = order.payment_method;

  // How the money actually gets back differs per rail, and the honest answer is
  // "it depends on your bank" for cards. Saying nothing invites a support email.
  const timing =
    method === 'stripe' || method === null
      ? t('email.refunded.timingCard')
      : t('email.refunded.timingOther');

  // Prices in the ORDER's currency, not the store's current one — an order
  // placed before a currency change must still read back in what was charged.
  const money = (cents: number) => formatPrice(cents, order.currency, i18n.intl);

  const priorLine =
    refundedCents > refundCents
      ? t('email.refunded.textTotalSoFar', { amount: money(refundedCents) })
      : null;

  const text = [
    full ? t('email.refunded.textFull', { num }) : t('email.refunded.textPartial', { num }),
    ``,
    t('email.refunded.textRefunded', { amount: money(refundCents) }),
    ...(priorLine ? [priorLine] : []),
    ...(full ? [] : [t('email.refunded.textStillPaid', { amount: money(remaining) })]),
    ``,
    timing,
    ...(orderUrl ? [``, t('email.text.viewOrder', { url: orderUrl })] : []),
  ].join('\n');

  const rows: TotalRow[] = [
    { label: t('email.refunded.refunded'), amount: money(refundCents), strong: true },
    ...(priorLine ? [{ label: t('email.refunded.totalRefunded'), amount: money(refundedCents) }] : []),
    ...(full ? [] : [{ label: t('email.refunded.stillPaid'), amount: money(remaining) }]),
  ];

  const html = emailShell({
    storeName,
    heading: full ? t('email.refunded.headingFull') : t('email.refunded.headingPartial'),
    subheading: th('email.refunded.subheading', { num }),
    body:
      emailLabel(t('email.refunded.refund')) +
      `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">${rows
        .map(
          (r) =>
            `<tr><td style="padding:4px 0;font-size:14px;color:${PALETTE.muted};">${escapeHtml(r.label)}</td>` +
            `<td align="right" style="padding:4px 0;font-size:14px;${r.strong ? 'font-weight:600;' : ''}">${escapeHtml(r.amount)}</td></tr>`,
        )
        .join('')}</table>` +
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${PALETTE.muted};">${escapeHtml(timing)}</p>` +
      (orderUrl ? emailButton(orderUrl, t('email.button.viewOrder')) : ''),
  });

  return {
    to: order.email!,
    subject: full
      ? t('email.refunded.subjectFull', { store: storeName, num })
      : t('email.refunded.subjectPartial', { store: storeName, num }),
    html,
    text,
  };
}
