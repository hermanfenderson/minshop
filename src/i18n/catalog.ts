/**
 * Typed UI dictionaries. A catalog is a flat map of `area.key` → message, one
 * file per area under `messages/<locale>/`. English is the source: its keys are
 * the `MessageKey` type, so an unknown key fails `astro check`, and every other
 * catalog is any subset of them.
 *
 * Dictionaries hold interface text only. Editorial content (product names,
 * pages, menus) is data and lives in D1, never here.
 */
import type { Message } from './format';
import { en } from './messages/en';
import { it } from './messages/it';

export type { Message, Params, PluralMessage } from './format';

export type MessageKey = keyof typeof en;

/** A translation: any subset of the English keys (missing ones fall back). */
export type Catalog = Partial<Record<MessageKey, Message>>;

/** The English source catalog, typed loosely for lookups and checks. */
export const SOURCE_CATALOG: Readonly<Record<string, Message>> = en;

/**
 * Catalogs bundled with upstream, by language code. A language in the registry
 * without an entry here still works: every key falls back along its chain.
 */
export const BUNDLED_CATALOGS: Readonly<Record<string, Catalog>> = Object.freeze({
  en,
  it,
});
