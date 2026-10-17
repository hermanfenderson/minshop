import { describe, expect, it } from 'vitest';
import { parseStoreSettings } from '../settings/db';
import { isMultilingual, languageRows, languageSettings } from './settings';

const rows = (entries: Record<string, string>) =>
  parseStoreSettings(Object.entries(entries).map(([key, value]) => ({ key, value })));

describe('language settings from D1 rows', () => {
  it('gives an existing store (no rows) one language and today\'s URLs', () => {
    const s = languageSettings(rows({}));
    expect(s.enabledLocales).toEqual(['en']);
    expect(s.routing).toBe('prefix');
    expect(isMultilingual(s)).toBe(false);
    expect(languageSettings(undefined)).toEqual(s);
  });

  it('reads the Monopolele setup', () => {
    const s = languageSettings(
      rows({ i18n_default_locale: 'en', i18n_content_source_locale: 'en', i18n_enabled_locales: 'en,it', i18n_routing: 'prefix' }),
    );
    expect(s).toMatchObject({ defaultLocale: 'en', contentSourceLocale: 'en', enabledLocales: ['en', 'it'], routing: 'prefix', prefixDefault: false });
    expect(isMultilingual(s)).toBe(true);
  });

  it('ignores stored values the engine would not accept', () => {
    const s = languageSettings(rows({ i18n_enabled_locales: 'en, xx ,it', i18n_routing: 'cookie', i18n_detect: 'always' }));
    expect(s.enabledLocales).toEqual(['en', 'it']);
    expect(s.routing).toBe('prefix');
    expect(s.detect).toBe('off');
  });
});

describe('language settings to D1 rows', () => {
  it('stores nothing for the defaults, so turning languages off restores a pristine store', () => {
    expect(languageRows(languageSettings(rows({}))).filter(([, v]) => v !== null)).toEqual([]);
  });

  it('round-trips through the rows', () => {
    const s = languageSettings(rows({ i18n_enabled_locales: 'en,it', i18n_detect: 'root', i18n_prefix_default: '1' }));
    const stored = Object.fromEntries(languageRows(s).filter(([, v]) => v !== null)) as Record<string, string>;
    expect(stored).toEqual({ i18n_enabled_locales: 'en,it', i18n_detect: 'root', i18n_prefix_default: '1' });
    expect(languageSettings(rows(stored))).toEqual(s);
  });
});
