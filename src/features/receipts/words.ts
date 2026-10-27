/**
 * Amounts in words, as Italian receipts traditionally repeat them next to the
 * figures ("€ 40,00 — quaranta/00"). Italian and English only: the two
 * languages the receipts are issued in. Other locales fall back to English.
 */
import { currencyDecimals } from '../../money';

const IT_UNITS = ['', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove'];
const IT_TEENS = [
  'dieci', 'undici', 'dodici', 'tredici', 'quattordici', 'quindici', 'sedici', 'diciassette', 'diciotto', 'diciannove',
];
const IT_TENS = ['', '', 'venti', 'trenta', 'quaranta', 'cinquanta', 'sessanta', 'settanta', 'ottanta', 'novanta'];

/** 0–999 in Italian, as one word ("" for 0). */
function italianHundreds(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let out = hundreds === 0 ? '' : hundreds === 1 ? 'cento' : `${IT_UNITS[hundreds]}cento`;
  let tail = '';
  if (rest >= 20) {
    const unit = rest % 10;
    let tens = IT_TENS[Math.floor(rest / 10)];
    // "ventuno", "trentotto": the tens drop their vowel before uno and otto.
    if (unit === 1 || unit === 8) tens = tens.slice(0, -1);
    tail = tens + (unit === 3 ? 'tré' : IT_UNITS[unit]);
  } else if (rest >= 10) {
    tail = IT_TEENS[rest - 10];
  } else if (rest > 0) {
    tail = rest === 3 && hundreds > 0 ? 'tré' : IT_UNITS[rest];
  }
  // "centottanta", "centotto": cento elides before an "o".
  if (out && tail.startsWith('o')) out = out.slice(0, -1);
  return out + tail;
}

/** A non-negative integer in Italian words ("duemilacinquecento"). */
export function italianWords(n: number): string {
  if (n === 0) return 'zero';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  let out = '';
  if (millions > 0) out += millions === 1 ? 'unmilione' : `${italianWords(millions)}milioni`;
  if (thousands > 0) out += thousands === 1 ? 'mille' : `${italianHundreds(thousands)}mila`;
  out += italianHundreds(rest);
  return out;
}

const EN_UNITS = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen',
  'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function englishHundreds(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${EN_UNITS[hundreds]} hundred`);
  if (rest >= 20) parts.push(EN_TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${EN_UNITS[rest % 10]}` : ''));
  else if (rest > 0) parts.push(EN_UNITS[rest]);
  return parts.join(' ');
}

/** A non-negative integer in English words ("two thousand five hundred"). */
export function englishWords(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  if (millions > 0) parts.push(`${englishWords(millions)} million`);
  if (thousands > 0) parts.push(`${englishHundreds(thousands)} thousand`);
  if (n % 1000 > 0) parts.push(englishHundreds(n % 1000));
  return parts.join(' ');
}

/**
 * Minor units as words plus the fraction in figures, the cheque convention:
 * 4000 EUR → "quaranta/00" (it) or "forty/00" (en); 1500 JPY → "millecinquecento".
 */
export function amountInWords(minor: number, currency: string, locale: string): string {
  const decimals = currencyDecimals(currency);
  const scale = 10 ** decimals;
  const major = Math.floor(minor / scale);
  const words = locale.toLowerCase().startsWith('it') ? italianWords(major) : englishWords(major);
  return decimals === 0 ? words : `${words}/${String(minor % scale).padStart(decimals, '0')}`;
}
