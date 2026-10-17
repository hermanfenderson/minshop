/**
 * Message formatting with no catalogs attached. Kept apart from the catalogs so
 * that code which must not pull every locale into its import graph (storefront
 * templates, whose boundary checker walks each import) can still build a
 * translator over the catalogs it actually speaks.
 *
 * Adapted from ddyy/minshop#60 by Luca G. (lgibelli).
 */
import { formatMoney, formatNumber } from '../money';
import { formatTimestamp } from '../dates';

export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type Message = string | PluralMessage;
export type Params = Record<string, string | number>;

/** A translator over keys `K`. The bound engine's `I18n` is this over every catalog key. */
export interface Translator<K extends string = string> {
  /** Catalog code: 'en', 'it', 'pt-br'. */
  locale: string;
  /** BCP 47 tag for Intl (en-US, it-IT, …). */
  intl: string;
  /** Translate a key. Unknown keys return the key itself (and fail typecheck). */
  t(key: K, params?: Params): string;
  /**
   * Translate a message that contains markup (catalogs are trusted source),
   * HTML-escaping every param. Render with `set:html`.
   */
  th(key: K, params?: Params): string;
  /** Integer minor units → localized price in an explicit currency. */
  money(minor: number, currency: string): string;
  /** Localized number (grouping, decimals). */
  number(value: number, opts?: Intl.NumberFormatOptions): string;
  /** Stored UTC timestamp → localized date in a time zone. */
  date(value: string | null | undefined, opts: Intl.DateTimeFormatOptions, timeZone: string): string;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

function interpolate(template: string, params: Params | undefined, escape: boolean): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!Object.hasOwn(params, name)) return match;
    const value = String(params[name]);
    return escape ? escapeHtml(value) : value;
  });
}

// Intl constructors are expensive; one cached instance per locale.
const pluralRules = new Map<string, Intl.PluralRules>();

function pluralCategory(intl: string, count: number): Intl.LDMLPluralRule {
  let rules = pluralRules.get(intl);
  if (!rules) {
    rules = new Intl.PluralRules(intl);
    pluralRules.set(intl, rules);
  }
  return rules.select(count);
}

/**
 * Render one message: pick the plural form for `params.count` (falling back to
 * `other`), then fill `{param}` placeholders. Unknown placeholders stay as-is.
 */
export function formatMessage(
  message: Message,
  intl: string,
  params?: Params,
  escape = false,
): string {
  if (typeof message === 'string') return interpolate(message, params, escape);
  const count = Number(params?.count ?? 0);
  const form = message[pluralCategory(intl, count)] ?? message.other;
  return interpolate(form, params, escape);
}

/** A translator over `lookup`; a key it doesn't know renders as the key. */
export function createTranslator<K extends string>(
  locale: string,
  intl: string,
  lookup: (key: K) => Message | undefined,
): Translator<K> {
  const render = (key: K, params: Params | undefined, escape: boolean): string => {
    const message = lookup(key);
    return message === undefined ? key : formatMessage(message, intl, params, escape);
  };
  return {
    locale,
    intl,
    t: (key, params) => render(key, params, false),
    th: (key, params) => render(key, params, true),
    money: (minor, currency) => formatMoney(minor, currency, intl),
    number: (value, opts) => formatNumber(value, intl, opts),
    date: (value, opts, timeZone) => formatTimestamp(value, opts, timeZone, intl),
  };
}
