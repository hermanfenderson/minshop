/**
 * The language of a public catalog response: `?lang=` (validated by the
 * middleware) picks the texts and the product URLs. A store with one language
 * answers exactly as before — no translation read, no extra header.
 */
import { MOUNT } from '../../deployment';
import { requestLanguage } from '../i18n/request';
import { LOCALE_REGISTRY, isMultilingual, languageSettings } from '../i18n/settings';
import { loadTranslations, type TranslationWants } from '../translations/db';
import type { TranslationSet } from '../translations/content';
import type { D1Database } from '@cloudflare/workers-types';

export interface CatalogLanguage {
  translations: TranslationSet;
  absolute: (path: string) => string;
  /** The response's Content-Language, or null for a single-language store. */
  contentLanguage: string | null;
}

export async function catalogLanguage(
  db: D1Database,
  locals: App.Locals,
  origin: string,
  wants: TranslationWants,
): Promise<CatalogLanguage> {
  const settings = languageSettings(locals.settings);
  const { urls } = requestLanguage(settings, LOCALE_REGISTRY, MOUNT, locals.locale, origin, { path: '/', search: '' });
  return {
    translations: await loadTranslations(db, locals.contentLocale, wants),
    absolute: (path) => urls.absolute(path),
    contentLanguage: isMultilingual(settings) ? locals.locale : null,
  };
}
