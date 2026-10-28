import { describe, expect, it } from 'vitest';
import { DONOR_FIELDS, isValidCodiceFiscale, isValidPartitaIva, parseDonor, readStoredDonor } from './donor';

const form = (values: Record<string, string>) => (name: string) => values[name];
const F = DONOR_FIELDS;
const italianAddress = { [F.address]: 'Via Roma 1', [F.postal]: '70043', [F.city]: 'Monopoli', [F.region]: 'BA', [F.country]: 'it' };

describe('Italian tax identifiers', () => {
  it('checks the codice fiscale control letter', () => {
    expect(isValidCodiceFiscale('RSSMRA85T10A562S')).toBe(true);
    expect(isValidCodiceFiscale('rssmra85t10a562s')).toBe(true);
    expect(isValidCodiceFiscale('RSSMRA85T10A562T')).toBe(false);
    expect(isValidCodiceFiscale('RSSMRA85T10A562')).toBe(false);
  });

  it('checks the partita IVA control digit', () => {
    expect(isValidPartitaIva('15861571006')).toBe(true);
    expect(isValidPartitaIva('15861571007')).toBe(false);
    expect(isValidPartitaIva('1586157100')).toBe(false);
  });
});

describe('parseDonor', () => {
  it('reads an Italian person, normalizing the tax code', () => {
    const r = parseDonor(form({ ...italianAddress, [F.firstName]: ' Ada ', [F.lastName]: 'Lovelace', [F.taxCode]: 'rssmra 85t10 a562s', [F.listed]: 'on', [F.displayName]: 'Ada L.' }));
    expect(r).toEqual({
      ok: true,
      donor: {
        kind: 'person',
        name: 'Ada Lovelace',
        firstName: 'Ada',
        lastName: 'Lovelace',
        taxCode: 'RSSMRA85T10A562S',
        vatNumber: null,
        address: { line1: 'Via Roma 1', postal: '70043', city: 'Monopoli', region: 'BA', country: 'IT' },
        listed: true,
        displayName: 'Ada L.',
      },
    });
  });

  it('requires a valid codice fiscale from Italian residents only', () => {
    const missing = parseDonor(form({ ...italianAddress, [F.firstName]: 'Ada', [F.lastName]: 'L' }));
    expect(missing).toEqual({ ok: false, problems: [{ field: 'tax_code', code: 'required' }] });
    const wrong = parseDonor(form({ ...italianAddress, [F.firstName]: 'Ada', [F.lastName]: 'L', [F.taxCode]: 'RSSMRA85T10A562T' }));
    expect(wrong).toEqual({ ok: false, problems: [{ field: 'tax_code', code: 'invalid' }] });
    const abroad = parseDonor(form({ ...italianAddress, [F.country]: 'DE', [F.firstName]: 'Ada', [F.lastName]: 'L' }));
    expect(abroad.ok).toBe(true);
  });

  it('reads a company, accepting an IT-prefixed VAT number', () => {
    const r = parseDonor(form({ ...italianAddress, [F.company]: 'on', [F.companyName]: 'Voltare Pagina ETS', [F.vat]: 'IT 15861571006', [F.listed]: 'on', [F.displayName]: 'ignored' }));
    expect(r.ok && r.donor).toMatchObject({ kind: 'company', name: 'Voltare Pagina ETS', vatNumber: '15861571006', taxCode: null, listed: true, displayName: null });
  });

  it('requires a company tax identifier everywhere, checked in Italy', () => {
    expect(parseDonor(form({ ...italianAddress, [F.company]: 'on', [F.companyName]: 'X' }))).toEqual({ ok: false, problems: [{ field: 'vat', code: 'required' }] });
    expect(parseDonor(form({ ...italianAddress, [F.company]: 'on', [F.companyName]: 'X', [F.vat]: '15861571007' }))).toEqual({ ok: false, problems: [{ field: 'vat', code: 'invalid' }] });
    expect(parseDonor(form({ ...italianAddress, [F.country]: 'FR', [F.company]: 'on', [F.companyName]: 'X', [F.vat]: 'FR40303265045' })).ok).toBe(true);
  });

  it('lists every missing field at once, and is not listed unless asked', () => {
    const r = parseDonor(form({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.map((p) => p.field)).toEqual(['country', 'address', 'postal', 'city', 'first_name', 'last_name']);
    const quiet = parseDonor(form({ ...italianAddress, [F.country]: 'DE', [F.firstName]: 'A', [F.lastName]: 'B', [F.displayName]: 'AB' }));
    expect(quiet.ok && quiet.donor).toMatchObject({ listed: false, displayName: null });
    const named = parseDonor(form({ ...italianAddress, [F.country]: 'DE', [F.firstName]: 'Ada', [F.lastName]: 'Lovelace', [F.listed]: 'on', [F.displayName]: ' ' }));
    expect(named.ok && named.donor).toMatchObject({ listed: true, displayName: 'Ada Lovelace' });
  });

  it('round-trips through its stored JSON', () => {
    const r = parseDonor(form({ ...italianAddress, [F.country]: 'DE', [F.firstName]: 'A', [F.lastName]: 'B' }));
    if (!r.ok) throw new Error('expected a donor');
    expect(readStoredDonor(JSON.stringify(r.donor))).toEqual(r.donor);
    expect(readStoredDonor('{"kind":"x"}')).toBeNull();
    expect(readStoredDonor('nope')).toBeNull();
  });
});
