import { enI18n, type I18n } from '../../i18n/index.ts';
import type { EmailMessage } from './provider';
import { PALETTE, emailShell, emailButton } from './layout';

/** Passwordless sign-in email — a single-use, short-lived magic link, in the store's language. */
export function loginLinkEmail(
  to: string,
  link: string,
  storeName: string,
  i18n: I18n = enI18n,
): EmailMessage {
  const { t } = i18n;
  const subject = t('email.login.subject', { store: storeName });
  const text = `${t('email.login.textIntro', { store: storeName })}\n\n${link}\n\n${t('email.login.textExpiry')}`;
  const html = emailShell({
    storeName,
    heading: t('email.login.heading'),
    subheading: t('email.login.subheading'),
    body:
      emailButton(link, t('email.login.button')) +
      `<p style="margin:0;font-size:12px;line-height:1.6;color:${PALETTE.muted};">
        ${t('email.login.fallback')}<br>
        <a href="${link}" style="color:${PALETTE.muted};word-break:break-all;">${link}</a>
      </p>`,
    footer: t('email.login.footer'),
  });
  return { to, subject, html, text };
}
