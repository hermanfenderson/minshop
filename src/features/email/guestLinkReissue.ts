import { getConfig } from '../../config';
import { enI18n, type I18n } from '../../i18n/index.ts';
import type { Order } from '../orders/db';
import { orderReference } from '../orders/number';
import type { EmailMessage } from './provider';
import { PALETTE, emailShell, emailButton } from './layout';

/**
 * Build the guest-link reissue email. Sent when support rotates an order's
 * access token (a reported forwarded/leaked link): the previous links stop
 * working the moment the rotation lands, so this message is the only path the
 * replacement credential is allowed to travel — admin output never shows it.
 * `guestOrderUrl` is the tokenized /order/<token> link, an allowlisted
 * customer-email token position. `order.email` must be set. Sent from the
 * outbox, outside the request, so it speaks the store's language by default.
 */
export function guestLinkReissueEmail(
  order: Order,
  storeName: string,
  guestOrderUrl: string,
  i18n: I18n = enI18n,
): EmailMessage {
  const { t, th } = i18n;
  const num = orderReference(order.public_id, order.id, getConfig().orderNumber);

  const text = [
    t('email.reissue.textIntro', { store: storeName, num }),
    ``,
    t('email.reissue.textBody'),
    guestOrderUrl,
    ``,
    t('email.reissue.textIgnore'),
  ].join('\n');

  const html = emailShell({
    storeName,
    heading: t('email.reissue.heading'),
    subheading: th('email.reissue.subheading', { num }),
    body:
      `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${PALETTE.muted};">` +
      `${t('email.reissue.body')}</p>` +
      emailButton(guestOrderUrl, t('email.button.viewOrder')),
    footer: t('email.reissue.footer'),
  });

  return {
    to: order.email!,
    subject: t('email.reissue.subject', { store: storeName, num }),
    html,
    text,
  };
}
