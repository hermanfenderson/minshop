/**
 * The language of an email and of the links inside it. Emails leave long after
 * the request that caused them (webhooks, the outbox sweep, the cron), so the
 * language is passed in — the order's stored one, or the admin's — never read
 * off whichever request happens to deliver.
 */
import type { StoreSettings } from '../settings/db';
import { MOUNT } from '../../deployment';
import { languageSettings, LOCALE_REGISTRY } from './settings';
import { requestLanguage, type RequestLanguage } from './request';

export function emailLanguage(
  store: StoreSettings | undefined,
  locale: string,
  origin: string,
  mount: string = MOUNT,
): RequestLanguage {
  const settings = languageSettings(store);
  const current = { path: '/', search: '' };
  const text = requestLanguage(settings, LOCALE_REGISTRY, mount, locale, origin, current);
  // The words stay in the language the shopper used, but a link must still
  // resolve: a language the store has since switched off links to the default.
  if (settings.enabledLocales.includes(locale)) return text;
  const links = requestLanguage(settings, LOCALE_REGISTRY, mount, settings.defaultLocale, origin, current);
  return { ...text, urls: links.urls };
}
