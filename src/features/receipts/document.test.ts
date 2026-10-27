import { describe, expect, it } from 'vitest';
import { createI18n } from '../../i18n/index.ts';
import type { Donor } from '../benefit/donor';
import { buildReceiptDocument, fillTemplate, readReceiptDocument, renderReceiptPdf, type ReceiptInput } from './document';
import { parseReceiptSettings, receiptLabel, seriesPrefix } from './settings';

const person: Donor = {
  kind: 'person',
  name: 'Mario Rossi',
  firstName: 'Mario',
  lastName: 'Rossi',
  taxCode: 'RSSMRA85T10A562S',
  vatNumber: null,
  address: { line1: 'Via Roma 1', postal: '00100', city: 'Roma', region: 'RM', country: 'IT' },
  listed: false,
  displayName: null,
};

const company: Donor = {
  ...person,
  kind: 'company',
  name: 'Esempio S.r.l.',
  firstName: null,
  lastName: null,
  taxCode: null,
  vatNumber: '15861571006',
};

const settings = parseReceiptSettings([
  { key: 'receipt_prefix', value: 'W' },
  { key: 'receipt_issuer', value: 'Associazione Esempio ETS\nVia Esempio 1, 00100 Roma\nC.F. 00000000000' },
  { key: 'receipt_text:donation:company:it', value: 'Da {donor}: {amount} ({amount_words}), {date}.\n\nSecondo paragrafo {nope}.' },
  { key: 'receipt_text:footer:it', value: 'Nota privacy.' },
  { key: 'receipt_stamp_key', value: 'media/stamp.jpg' },
  { key: 'unrelated', value: 'x' },
]);

const input = (overrides: Partial<ReceiptInput> = {}): ReceiptInput => ({
  kind: 'donation',
  label: receiptLabel(settings.prefix, 12, 2027),
  issuedOn: '2027-03-18',
  paidOn: '2027-03-17',
  amountCents: 4000,
  currency: 'EUR',
  orderRef: '1042',
  paymentMethod: 'stripe',
  donor: person,
  gifts: [],
  settings,
  i18n: createI18n('it'),
  countryName: (code) => (code === 'IT' ? 'Italia' : code),
  ...overrides,
});

describe('parseReceiptSettings', () => {
  it('reads the issuer lines, prefix, images and texts per slot and language', () => {
    expect(settings.prefix).toBe('W');
    expect(settings.issuer).toHaveLength(3);
    expect(settings.stampKey).toBe('media/stamp.jpg');
    expect(Object.keys(settings.texts).sort()).toEqual(['donation:company:it', 'footer:it']);
  });

  it('gives every series its own prefix unless one is set', () => {
    expect(seriesPrefix(settings, 'donation')).toBe('W');
    expect(seriesPrefix(settings, 'shipping')).toBe('WS');
    expect(seriesPrefix(settings, 'refund_note')).toBe('WR');
    const custom = parseReceiptSettings([{ key: 'receipt_prefix:shipping', value: 'SP-' }]);
    expect(seriesPrefix(custom, 'shipping')).toBe('SP-');
    expect(seriesPrefix(custom, 'refund_note')).toBe('R');
  });

  it('keeps the prefix printable', () => {
    expect(parseReceiptSettings([{ key: 'receipt_prefix', value: ' W/<b> ' }]).prefix).toBe('Wb');
  });
});

describe('buildReceiptDocument', () => {
  it('uses the placeholder wording when none is configured, filled in', () => {
    const doc = buildReceiptDocument(input());
    expect(doc.title).toBe('Ricevuta per erogazione liberale');
    expect(doc.label).toBe('W12/2027');
    expect(doc.meta[0]).toEqual(['Data', '18/03/2027']);
    expect(doc.body[0]).toContain('Associazione Esempio ETS dichiara di aver ricevuto da Mario Rossi');
    expect(doc.body[0]).toContain('quaranta/00');
    expect(doc.body[0]).toContain('17 marzo 2027');
    expect(doc.body[1]).toMatch(/^\[Testo provvisorio/);
    expect(doc.party).toEqual(['Mario Rossi', 'Via Roma 1', '00100 Roma (RM)', 'Italia', 'Codice fiscale RSSMRA85T10A562S']);
    expect(doc.annex).toBeNull();
  });

  it('uses the configured wording for the donor type and language', () => {
    const doc = buildReceiptDocument(input({ donor: company }));
    expect(doc.body).toEqual(['Da Esempio S.r.l.: 40,00\u00a0€ (quaranta/00), 17 marzo 2027.', 'Secondo paragrafo {nope}.']);
    expect(doc.party).toContain('Partita IVA 15861571006');
    expect(doc.footer).toEqual(['Nota privacy.', 'Associazione Esempio ETS - Via Esempio 1, 00100 Roma - C.F. 00000000000']);
  });

  it('lists the gifts in an annex on donation receipts only', () => {
    const gifts = [{ name: 'T-shirt — M', quantity: 2 }];
    expect(buildReceiptDocument(input({ gifts })).annex?.rows).toEqual([['T-shirt — M', 2]]);
    expect(buildReceiptDocument(input({ gifts, kind: 'shipping' })).annex).toBeNull();
  });

  it('names the receipt a document replaces or cancels', () => {
    expect(buildReceiptDocument(input({ relatedLabel: 'W3/2027' })).notes).toEqual([
      'Il presente documento annulla e sostituisce la ricevuta W3/2027.',
    ]);
    const note = buildReceiptDocument(input({ kind: 'refund_note', relatedLabel: 'W3/2027' }));
    expect(note.title).toBe('Nota di restituzione');
    expect(note.partyHeading).toBe('A');
    expect(note.notes).toEqual(['La presente nota annulla la ricevuta W3/2027.']);
  });

  it('speaks English for English orders', () => {
    const doc = buildReceiptDocument(input({ i18n: createI18n('en') }));
    expect(doc.title).toBe('Contribution receipt');
    expect(doc.body[0]).toContain('forty/00');
  });

  it('round-trips through its JSON snapshot and renders', () => {
    const doc = buildReceiptDocument(input({ gifts: [{ name: 'Tazza', quantity: 1 }] }));
    const stored = readReceiptDocument(JSON.stringify(doc));
    expect(stored).toEqual(doc);
    expect(readReceiptDocument('{"v":2}')).toBeNull();
    const pdf = renderReceiptPdf(stored!);
    expect(String.fromCharCode(...pdf.slice(0, 8))).toBe('%PDF-1.4');
  });
});

describe('fillTemplate', () => {
  it('fills known placeholders and leaves unknown ones visible', () => {
    expect(fillTemplate('{a} {b}', { a: '1' })).toBe('1 {b}');
  });
});
