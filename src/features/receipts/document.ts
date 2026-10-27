/**
 * Receipt documents: what one says (buildReceiptDocument) and how it looks
 * (renderReceiptPdf). Both pure. The built document is a JSON snapshot stored
 * with the receipt row, every string already resolved, so a receipt prints the
 * same years later whatever the settings, translations or donor rows say then.
 */
import type { MessageKey, Translator } from '../../i18n/index.ts';
import type { Donor } from '../benefit/donor';
import { PdfFlow, jpegInfo } from './pdf';
import { receiptText, type ReceiptSettings, type ReceiptTextSlot } from './settings';
import { amountInWords } from './words';

export type ReceiptKind = 'donation' | 'shipping' | 'refund_note';

export interface ReceiptGift {
  name: string;
  quantity: number;
}

export interface ReceiptInput {
  kind: ReceiptKind;
  label: string;
  /** Calendar dates in the store's time zone, YYYY-MM-DD. */
  issuedOn: string;
  paidOn: string;
  amountCents: number;
  currency: string;
  /** How the order is referred to on the document (its number). */
  orderRef: string;
  paymentMethod: string | null;
  donor: Donor;
  /** Gift annex (donation receipts only); empty = no annex. */
  gifts: ReceiptGift[];
  /** A reissued receipt names the one it replaces; a refund note the one it cancels. */
  relatedLabel?: string | null;
  settings: ReceiptSettings;
  i18n: Translator<MessageKey>;
  countryName: (code: string) => string;
}

export interface ReceiptDocument {
  v: 1;
  kind: ReceiptKind;
  locale: string;
  label: string;
  amountCents: number;
  currency: string;
  title: string;
  issuer: string[];
  meta: Array<[string, string]>;
  body: string[];
  partyHeading: string;
  party: string[];
  annex: { heading: string; quantityLabel: string; rows: Array<[string, number]> } | null;
  notes: string[];
  signature: string;
  footer: string[];
  stampKey: string | null;
  logoKey: string | null;
}

/** Fill {placeholders}; unknown ones stay visible so a typo shows on the proof. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (Object.hasOwn(vars, name) ? vars[name] : match));
}

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function formatDay(iso: string, intl: string, style: 'numeric' | 'long'): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return style === 'long'
    ? new Intl.DateTimeFormat(intl, { dateStyle: 'long', timeZone: 'UTC' }).format(date)
    : new Intl.DateTimeFormat(intl, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function textSlot(input: ReceiptInput): ReceiptTextSlot {
  return input.kind === 'donation' ? `donation:${input.donor.kind}` : input.kind;
}

function paymentMethodLabel(i18n: ReceiptInput['i18n'], method: string | null): string {
  if (method === 'stripe') return i18n.t('benefit.receipt.method.stripe');
  if (method === 'demo') return i18n.t('benefit.receipt.method.demo');
  return i18n.t('benefit.receipt.method.other');
}

/** The donor block, as printed under "From" / "To". */
export function donorLines(donor: Donor, i18n: ReceiptInput['i18n'], countryName: (code: string) => string): string[] {
  const a = donor.address;
  const lines = [donor.name, a.line1, [a.postal, a.city, a.region ? `(${a.region})` : ''].filter(Boolean).join(' ')];
  lines.push(countryName(a.country));
  if (donor.kind === 'company') {
    if (donor.vatNumber) lines.push(`${i18n.t('benefit.receipt.vat')} ${donor.vatNumber}`);
    if (donor.taxCode && donor.taxCode !== donor.vatNumber) lines.push(`${i18n.t('benefit.receipt.taxCode')} ${donor.taxCode}`);
  } else if (donor.taxCode) {
    lines.push(`${i18n.t('benefit.receipt.taxCode')} ${donor.taxCode}`);
  }
  return lines.filter(Boolean);
}

export function buildReceiptDocument(input: ReceiptInput): ReceiptDocument {
  const { i18n, settings, kind } = input;
  const slot = textSlot(input);
  const template =
    receiptText(settings, slot, i18n.locale) ?? i18n.t(`benefit.receipt.placeholder.${slot.replace(':', '.')}` as MessageKey);
  const vars = {
    issuer: settings.issuer[0] ?? '',
    donor: input.donor.name,
    amount: i18n.money(input.amountCents, input.currency),
    amount_words: amountInWords(input.amountCents, input.currency, i18n.locale),
    date: formatDay(input.paidOn, i18n.intl, 'long'),
    payment_method: paymentMethodLabel(i18n, input.paymentMethod),
    number: input.label,
    order: input.orderRef,
  };
  const footerText = receiptText(settings, 'footer', i18n.locale);
  const notes: string[] = [];
  if (input.relatedLabel) {
    notes.push(
      kind === 'refund_note'
        ? i18n.t('benefit.receipt.cancels', { label: input.relatedLabel })
        : i18n.t('benefit.receipt.replaces', { label: input.relatedLabel }),
    );
  }
  return {
    v: 1,
    kind,
    locale: i18n.locale,
    label: input.label,
    amountCents: input.amountCents,
    currency: input.currency,
    title: i18n.t(`benefit.receipt.title.${kind}` as MessageKey),
    issuer: settings.issuer,
    meta: [
      [i18n.t('benefit.receipt.date'), formatDay(input.issuedOn, i18n.intl, 'numeric')],
      [i18n.t(kind === 'refund_note' ? 'benefit.receipt.noteNumber' : 'benefit.receipt.number'), input.label],
      [i18n.t('benefit.receipt.order'), input.orderRef],
    ],
    body: paragraphs(fillTemplate(template, vars)),
    partyHeading: i18n.t(kind === 'refund_note' ? 'benefit.receipt.to' : 'benefit.receipt.from'),
    party: donorLines(input.donor, i18n, input.countryName),
    annex:
      kind === 'donation' && input.gifts.length > 0
        ? {
            heading: i18n.t('benefit.receipt.annex'),
            quantityLabel: i18n.t('benefit.receipt.annexQuantity'),
            rows: input.gifts.map((g) => [g.name, g.quantity]),
          }
        : null,
    notes,
    signature: i18n.t('benefit.receipt.signature'),
    footer: [...(footerText ? paragraphs(fillTemplate(footerText, vars)) : []), settings.issuer.join(' - ')].filter(Boolean),
    stampKey: settings.stampKey,
    logoKey: settings.logoKey,
  };
}

/** Parse a stored snapshot; null when the row is not one this code can draw. */
export function readReceiptDocument(json: string): ReceiptDocument | null {
  try {
    const doc = JSON.parse(json) as ReceiptDocument;
    return doc && doc.v === 1 && typeof doc.label === 'string' && Array.isArray(doc.body) ? doc : null;
  } catch {
    return null;
  }
}

/** Draw the document. Images are the bytes behind stampKey / logoKey, when they could be read. */
export function renderReceiptPdf(doc: ReceiptDocument, images: { stamp?: Uint8Array | null; logo?: Uint8Array | null } = {}): Uint8Array<ArrayBuffer> {
  const flow = new PdfFlow();
  const logo = images.logo ? jpegInfo(images.logo) : null;
  if (logo && images.logo) flow.image({ bytes: images.logo, info: logo }, 150, 70).space(10);
  flow.text(doc.title.toUpperCase(), { face: 'bold', size: 14, align: 'center' }).space(12);
  for (const [label, value] of doc.meta) flow.text(`${label} ${value}`, { align: 'right' });
  flow.space(14);
  for (const p of doc.body) flow.text(p, { size: 10.5, leading: 15 }).space(6);
  flow.space(6).text(`${doc.partyHeading}:`, { face: 'bold' });
  doc.party.forEach((line, index) => flow.text(line, { face: index === 0 ? 'bold' : 'regular' }));
  if (doc.annex) {
    flow.space(14).text(doc.annex.heading, { face: 'bold' }).rule();
    flow.row('', doc.annex.quantityLabel, { size: 9 });
    for (const [name, quantity] of doc.annex.rows) flow.row(name, String(quantity));
    flow.rule();
  }
  for (const note of doc.notes) flow.space(8).text(note, { face: 'bold' });
  flow.space(22).text(doc.signature, { align: 'right', size: 9 });
  const stamp = images.stamp ? jpegInfo(images.stamp) : null;
  if (stamp && images.stamp) flow.space(4).image({ bytes: images.stamp, info: stamp }, 200, 90, 'right');
  flow.space(24);
  for (const line of doc.footer) flow.text(line, { size: 8, color: 0.35, align: 'center' }).space(3);
  return flow.toBytes({ title: `${doc.title} ${doc.label}` });
}
