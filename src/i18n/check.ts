/**
 * Catalog checks. ERRORS break rendered text and fail the build: an unknown
 * key, a placeholder that differs from English, or a plural message missing a
 * form its language needs. MISSING keys only degrade to the fallback, so they
 * are reported as coverage, never as failures.
 */
import type { Message } from './format.ts';

export interface CatalogReport {
  errors: string[];
  /** Source keys the catalog doesn't translate (they fall back). */
  missing: string[];
  /** Translated share of the source keys, 0–1. */
  coverage: number;
}

/** The `{param}` names a message uses, across all its forms, sorted. */
export function placeholders(message: Message): string[] {
  const forms = typeof message === 'string' ? [message] : Object.values(message);
  const names = forms.flatMap((f) => [...(f ?? '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  return [...new Set(names)].sort();
}

export function checkCatalog(
  catalog: Readonly<Record<string, Message | undefined>>,
  intl: string,
  source: Readonly<Record<string, Message>>,
): CatalogReport {
  const errors: string[] = [];
  const forms = new Intl.PluralRules(intl).resolvedOptions().pluralCategories;

  for (const [key, message] of Object.entries(catalog)) {
    if (message === undefined) continue;
    const original = source[key];
    if (original === undefined) {
      errors.push(`${key}: not a key of the English catalog`);
      continue;
    }
    const want = placeholders(original).join(',');
    const got = placeholders(message).join(',');
    if (want !== got) errors.push(`${key}: placeholders {${got}} differ from English {${want}}`);
    if (typeof original !== 'string') {
      if (typeof message === 'string') {
        errors.push(`${key}: English is a plural message, the translation is not`);
        continue;
      }
      for (const form of forms) {
        if (typeof message[form] !== 'string') errors.push(`${key}: missing plural form "${form}"`);
      }
    }
  }

  const keys = Object.keys(source);
  const missing = keys.filter((key) => catalog[key] === undefined);
  const coverage = keys.length === 0 ? 1 : (keys.length - missing.length) / keys.length;
  return { errors, missing, coverage };
}

/** English-only rules: every plural message has `other`, every key is `area.name`. */
export function checkSourceCatalog(source: Readonly<Record<string, Message>>): string[] {
  const errors: string[] = [];
  for (const [key, message] of Object.entries(source)) {
    if (!/^[a-z][A-Za-z]*\.[\w.]+$/.test(key)) errors.push(`${key}: keys are "area.name"`);
    if (typeof message !== 'string' && typeof message.other !== 'string') {
      errors.push(`${key}: plural message without an "other" form`);
    }
  }
  return errors;
}
