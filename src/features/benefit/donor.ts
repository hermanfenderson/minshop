/**
 * Benefit Mode's donor data (R14): who the receipt is made out to, collected
 * by the shop BEFORE payment, whatever rail then takes the money. Pure, so the
 * cart form, the buy-now page and JSON checkout validate it the same way.
 *
 * Italian residents must give a tax identifier (codice fiscale for a person,
 * partita IVA for a company), checked by its control character or digit.
 * Donors abroad give their country and, as a company, their own tax
 * identifier, in whatever format their country uses.
 */

export interface DonorAddress {
  line1: string;
  postal: string;
  city: string;
  /** Province / state, free text; optional. */
  region: string | null;
  /** ISO 3166-1 alpha-2, upper case. */
  country: string;
}

export interface Donor {
  kind: 'person' | 'company';
  /** What the receipt prints: "First Last", or the company name. */
  name: string;
  firstName: string | null;
  lastName: string | null;
  /** Codice fiscale (or a foreign person's tax id, optional abroad). */
  taxCode: string | null;
  /** A company's VAT number (partita IVA in Italy). */
  vatNumber: string | null;
  address: DonorAddress;
  /** Consent to appear in the public supporter list (R13). */
  listed: boolean;
  /** The name shown in that list (a person's first and last name unless they typed
   *  another); null when not listed. Companies show `name`. */
  displayName: string | null;
}

export type DonorField =
  | 'first_name'
  | 'last_name'
  | 'company_name'
  | 'tax_code'
  | 'vat'
  | 'address'
  | 'postal'
  | 'city'
  | 'country';

export type DonorProblem = { field: DonorField; code: 'required' | 'invalid' };

export type DonorResult = { ok: true; donor: Donor } | { ok: false; problems: DonorProblem[] };

/** Form field names, so pages and the parser cannot drift apart. */
export const DONOR_FIELDS = {
  company: 'donor_company',
  firstName: 'donor_first_name',
  lastName: 'donor_last_name',
  companyName: 'donor_company_name',
  taxCode: 'donor_tax_code',
  vat: 'donor_vat',
  address: 'donor_address',
  postal: 'donor_postal',
  city: 'donor_city',
  region: 'donor_region',
  country: 'donor_country',
  listed: 'donor_listed',
  displayName: 'donor_display_name',
} as const;

const MAX = 200;
const clean = (value: unknown): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX) : '';
const compact = (value: unknown): string => clean(value).replace(/[\s.\-/]/g, '').toUpperCase();

// ── Codice fiscale ────────────────────────────────────────────────────────────

const CF_PATTERN = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;
// Values of a character in an odd (1st, 3rd, …) position; digits map like A–J.
const CF_ODD = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23];

function cfValue(char: string, odd: boolean): number {
  const code = char.charCodeAt(0);
  const index = code >= 48 && code <= 57 ? code - 48 : code - 65;
  return odd ? CF_ODD[index] : index;
}

/** A person's 16-character codice fiscale, including its control letter. */
export function isValidCodiceFiscale(raw: string): boolean {
  const cf = raw.toUpperCase();
  if (!CF_PATTERN.test(cf)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) sum += cfValue(cf[i], i % 2 === 0);
  return String.fromCharCode(65 + (sum % 26)) === cf[15];
}

/** An 11-digit partita IVA (also a company's numeric codice fiscale). */
export function isValidPartitaIva(raw: string): boolean {
  if (!/^\d{11}$/.test(raw)) return false;
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    let digit = Number(raw[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// ── Parsing ───────────────────────────────────────────────────────────────────

/** Read the donor from a form (or JSON fields with the same names). */
export function parseDonor(get: (name: string) => unknown): DonorResult {
  const problems: DonorProblem[] = [];
  const need = (field: DonorField, value: string) => {
    if (!value) problems.push({ field, code: 'required' });
    return value;
  };
  const truthy = (value: unknown) => value === true || value === 'on' || value === '1' || value === 'true';

  const company = truthy(get(DONOR_FIELDS.company));
  const country = compact(get(DONOR_FIELDS.country));
  if (!country) problems.push({ field: 'country', code: 'required' });
  else if (!/^[A-Z]{2}$/.test(country)) problems.push({ field: 'country', code: 'invalid' });
  const italian = country === 'IT';

  const address: DonorAddress = {
    line1: need('address', clean(get(DONOR_FIELDS.address))),
    postal: need('postal', clean(get(DONOR_FIELDS.postal))),
    city: need('city', clean(get(DONOR_FIELDS.city))),
    region: clean(get(DONOR_FIELDS.region)) || null,
    country,
  };

  let donor: Donor;
  if (company) {
    const name = need('company_name', clean(get(DONOR_FIELDS.companyName)));
    const vat = compact(get(DONOR_FIELDS.vat)).replace(/^IT(?=\d{11}$)/, '');
    // A company's codice fiscale is usually its VAT number; asked only when different.
    const taxCode = compact(get(DONOR_FIELDS.taxCode)) || null;
    if (!vat) problems.push({ field: 'vat', code: 'required' });
    else if (italian && !isValidPartitaIva(vat)) problems.push({ field: 'vat', code: 'invalid' });
    if (italian && taxCode && !isValidPartitaIva(taxCode) && !isValidCodiceFiscale(taxCode)) {
      problems.push({ field: 'tax_code', code: 'invalid' });
    }
    donor = {
      kind: 'company',
      name,
      firstName: null,
      lastName: null,
      taxCode,
      vatNumber: vat || null,
      address,
      listed: truthy(get(DONOR_FIELDS.listed)),
      displayName: null,
    };
  } else {
    const firstName = need('first_name', clean(get(DONOR_FIELDS.firstName)));
    const lastName = need('last_name', clean(get(DONOR_FIELDS.lastName)));
    const taxCode = compact(get(DONOR_FIELDS.taxCode));
    if (italian) {
      if (!taxCode) problems.push({ field: 'tax_code', code: 'required' });
      // Rare temporary codes are 11 digits; everything else is the 16-character one.
      else if (!isValidCodiceFiscale(taxCode) && !isValidPartitaIva(taxCode)) {
        problems.push({ field: 'tax_code', code: 'invalid' });
      }
    }
    const listed = truthy(get(DONOR_FIELDS.listed));
    donor = {
      kind: 'person',
      name: `${firstName} ${lastName}`.trim(),
      firstName,
      lastName,
      taxCode: taxCode || null,
      vatNumber: null,
      address,
      listed,
      // Asking to be listed means being listed by name (Mauro, 2026-10-28): an empty
      // field takes the donor's own name rather than turning them anonymous.
      displayName: listed ? clean(get(DONOR_FIELDS.displayName)) || `${firstName} ${lastName}`.trim() : null,
    };
  }
  return problems.length > 0 ? { ok: false, problems } : { ok: true, donor };
}

/** A stored donor snapshot back into the type, or null when it is not one. */
export function readStoredDonor(json: string | null | undefined): Donor | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Donor;
    return value && (value.kind === 'person' || value.kind === 'company') && typeof value.name === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}
