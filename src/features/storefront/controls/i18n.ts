/**
 * The translator storefront templates and controls render text with.
 *
 * Templates and controls never read request context, so the request's
 * translator arrives as an `i18n` prop: Layout and the routes pass
 * `Astro.locals.i18n`, and a template hands it on to the controls it composes.
 * Rendered without one (a container test, a fixture) they fall back to English,
 * so every component still renders from its model alone.
 *
 * The fallback is deliberately NOT src/i18n/core. The storefront boundary
 * checker walks every module a template can reach, once per template, and core
 * pulls in every locale's full catalog — which made the walk an order of
 * magnitude slower. This module reaches only the two English catalogs the
 * storefront speaks (both import-free for the same reason) and the pure money
 * helper, through the catalog-free formatter core itself uses (i18n/format).
 */
import { storefront } from '../../../i18n/messages/en/storefront.ts';
import { common } from '../../../i18n/messages/en/common.ts';
import { createTranslator, type Message } from '../../../i18n/format.ts';

/** The request translator's type, named through the global Locals so that no
 *  import reaches the translator core. */
export type I18n = App.Locals['i18n'];

const ENGLISH: Record<string, Message> = { ...common, ...storefront };
const english = createTranslator('en', 'en-US', (key: string) => ENGLISH[key]) as unknown as I18n;

/** The translator a component was handed, or English when it was given none. */
export function storefrontI18n(i18n: I18n | undefined): I18n {
  return i18n ?? english;
}
