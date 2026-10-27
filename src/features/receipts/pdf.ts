/**
 * A small, dependency-free PDF writer for receipts: A4 pages, the two standard
 * Helvetica faces, word-wrapped paragraphs and JPEG images. That is all a
 * receipt needs, and it runs anywhere — a Worker included — with no library,
 * no font files and no rendering service.
 *
 * Text uses WinAnsiEncoding, which covers Italian and the other Western
 * European languages (à è é ì ò ù, €, curly quotes, guillemets). A character
 * outside it prints as "?" rather than breaking the file.
 */

export const A4 = { width: 595.28, height: 841.89 };

export interface JpegInfo {
  width: number;
  height: number;
  components: number;
}

/** Read a JPEG's size and colour components from its frame header; null if it is not one. */
export function jpegInfo(bytes: Uint8Array): JpegInfo | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    // Start-of-frame markers (baseline, extended, progressive; not DHT/JPG/DAC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (bytes[i + 5] << 8) | bytes[i + 6],
        width: (bytes[i + 7] << 8) | bytes[i + 8],
        components: bytes[i + 9],
      };
    }
    i += 2 + length;
  }
  return null;
}

// ── Fonts ────────────────────────────────────────────────────────────────────

export type FontFace = 'regular' | 'bold';

// Helvetica advance widths (1/1000 em) for ASCII 32–126, from the standard AFMs.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611,
  556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
  280, 389, 584,
];

// Unicode → WinAnsi byte for the characters outside Latin-1's shared range.
const WIN_ANSI: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94,
  '‹': 0x8b, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99, '›': 0x9b,
  // Intl puts a narrow no-break space in some amounts and dates; WinAnsi has only the plain one.
  '\u202f': 0xa0,
};

/** One character → its WinAnsi byte ("?" when the encoding has none). */
function winAnsi(char: string): number {
  const special = WIN_ANSI[char];
  if (special !== undefined) return special;
  const code = char.codePointAt(0) ?? 63;
  return (code >= 32 && code <= 126) || (code >= 0xa0 && code <= 0xff) ? code : 63;
}

/** Width of a character in 1/1000 em: ASCII from the AFM, accented letters as their base. */
function charWidth(char: string, face: FontFace): number {
  const table = face === 'bold' ? HELVETICA_BOLD : HELVETICA;
  const code = char.codePointAt(0) ?? 63;
  if (code >= 32 && code <= 126) return table[code - 32];
  const base = char.normalize('NFD')[0];
  if (base !== char && base.charCodeAt(0) >= 32 && base.charCodeAt(0) <= 126) return table[base.charCodeAt(0) - 32];
  if (char === '’' || char === '‘') return face === 'bold' ? 278 : 222;
  if (char === '—') return 1000;
  if (char === ' ') return 278;
  return 556;
}

export function textWidth(text: string, face: FontFace, size: number): number {
  let total = 0;
  for (const char of text) total += charWidth(char, face);
  return (total * size) / 1000;
}

/** Break text into lines no wider than `width`; explicit newlines are kept. */
export function wrapText(text: string, face: FontFace, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || textWidth(candidate, face, size) <= width) {
        line = candidate;
        continue;
      }
      lines.push(line);
      line = word;
    }
    lines.push(line);
  }
  return lines;
}

function pdfString(text: string): string {
  let out = '(';
  for (const char of text) {
    const byte = winAnsi(char);
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`;
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, '0')}`;
    else out += String.fromCharCode(byte);
  }
  return `${out})`;
}

const num = (n: number) => (Math.round(n * 100) / 100).toString();

// ── Document ─────────────────────────────────────────────────────────────────

export interface PdfImage {
  bytes: Uint8Array;
  info: JpegInfo;
}

export type Align = 'left' | 'center' | 'right';

/**
 * A top-to-bottom flow over A4 pages. Each call places its block under the
 * previous one and starts a new page when the block would not fit.
 */
export class PdfFlow {
  private pages: string[][] = [[]];
  private images: PdfImage[] = [];
  private y: number;
  readonly left: number;
  readonly width: number;

  constructor(private readonly margin = 56) {
    this.left = margin;
    this.width = A4.width - margin * 2;
    this.y = A4.height - margin;
  }

  private get ops(): string[] {
    return this.pages[this.pages.length - 1];
  }

  private ensure(height: number): void {
    if (this.y - height >= this.margin) return;
    this.pages.push([]);
    this.y = A4.height - this.margin;
  }

  space(points: number): this {
    this.y -= points;
    return this;
  }

  text(text: string, options: { size?: number; face?: FontFace; align?: Align; leading?: number; color?: number } = {}): this {
    const size = options.size ?? 10;
    const face = options.face ?? 'regular';
    const leading = options.leading ?? size * 1.35;
    const font = face === 'bold' ? '/F2' : '/F1';
    const gray = options.color ?? 0;
    for (const line of wrapText(text, face, size, this.width)) {
      this.ensure(leading);
      this.y -= leading;
      const w = textWidth(line, face, size);
      const x =
        options.align === 'center' ? this.left + (this.width - w) / 2
        : options.align === 'right' ? this.left + this.width - w
        : this.left;
      this.ops.push(`BT ${num(gray)} g ${font} ${num(size)} Tf ${num(x)} ${num(this.y + leading - size)} Td ${pdfString(line)} Tj ET`);
    }
    return this;
  }

  /** Two columns on one line: a label on the left, a value on the right. */
  row(label: string, value: string, options: { size?: number; face?: FontFace } = {}): this {
    const size = options.size ?? 10;
    const face = options.face ?? 'regular';
    const font = face === 'bold' ? '/F2' : '/F1';
    const valueWidth = textWidth(value, face, size);
    const labelLines = wrapText(label, face, size, this.width - valueWidth - 16);
    const leading = size * 1.35;
    labelLines.forEach((line, index) => {
      this.ensure(leading);
      this.y -= leading;
      const baseline = this.y + leading - size;
      this.ops.push(`BT 0 g ${font} ${num(size)} Tf ${num(this.left)} ${num(baseline)} Td ${pdfString(line)} Tj ET`);
      if (index === 0) {
        this.ops.push(
          `BT 0 g ${font} ${num(size)} Tf ${num(this.left + this.width - valueWidth)} ${num(baseline)} Td ${pdfString(value)} Tj ET`,
        );
      }
    });
    return this;
  }

  rule(gray = 0.75): this {
    this.ensure(8);
    this.y -= 4;
    this.ops.push(`${num(gray)} G 0.5 w ${num(this.left)} ${num(this.y)} m ${num(this.left + this.width)} ${num(this.y)} l S`);
    this.y -= 4;
    return this;
  }

  /** A JPEG scaled to fit `maxWidth` × `maxHeight`, keeping its proportions. */
  image(image: PdfImage, maxWidth: number, maxHeight: number, align: Align = 'left'): this {
    const scale = Math.min(maxWidth / image.info.width, maxHeight / image.info.height);
    const w = image.info.width * scale;
    const h = image.info.height * scale;
    this.ensure(h);
    this.y -= h;
    const x =
      align === 'center' ? this.left + (this.width - w) / 2
      : align === 'right' ? this.left + this.width - w
      : this.left;
    this.images.push(image);
    this.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(this.y)} cm /Im${this.images.length} Do Q`);
    return this;
  }

  /** The finished file. */
  toBytes(meta: { title?: string } = {}): Uint8Array<ArrayBuffer> {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const offsets: number[] = [];
    let length = 0;
    const push = (chunk: Uint8Array | string) => {
      const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk;
      chunks.push(bytes);
      length += bytes.length;
    };
    // Latin-1 only, so one character is one byte and offsets stay exact.
    const latin1 = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

    const pageCount = this.pages.length;
    // 1 catalog, 2 pages, 3–4 fonts, 5 info, then images, then page/content pairs.
    const firstImage = 6;
    const firstPage = firstImage + this.images.length;
    const total = firstPage + pageCount * 2 - 1;
    const object = (id: number, body: string | Uint8Array, tail = '') => {
      offsets[id] = length;
      push(`${id} 0 obj\n`);
      push(typeof body === 'string' ? latin1(body) : body);
      push(`${tail}\nendobj\n`);
    };

    push(latin1('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    const kids = Array.from({ length: pageCount }, (_, i) => `${firstPage + i * 2} 0 R`).join(' ');
    object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
    object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    object(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    object(5, `<< /Producer (Minshop) ${meta.title ? `/Title ${pdfString(meta.title)}` : ''} >>`);
    this.images.forEach((image, index) => {
      const space = image.info.components === 1 ? '/DeviceGray' : image.info.components === 4 ? '/DeviceCMYK' : '/DeviceRGB';
      offsets[firstImage + index] = length;
      push(`${firstImage + index} 0 obj\n`);
      push(
        `<< /Type /XObject /Subtype /Image /Width ${image.info.width} /Height ${image.info.height} /ColorSpace ${space} /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
      );
      push(image.bytes);
      push('\nendstream\nendobj\n');
    });
    const xobjects = this.images.map((_, i) => `/Im${i + 1} ${firstImage + i} 0 R`).join(' ');
    this.pages.forEach((ops, index) => {
      const pageId = firstPage + index * 2;
      const content = latin1(ops.join('\n'));
      object(
        pageId,
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(A4.width)} ${num(A4.height)}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << ${xobjects} >> >> /Contents ${pageId + 1} 0 R >>`,
      );
      offsets[pageId + 1] = length;
      push(`${pageId + 1} 0 obj\n<< /Length ${content.length} >>\nstream\n`);
      push(content);
      push('\nendstream\nendobj\n');
    });

    const xref = length;
    let table = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
    for (let id = 1; id <= total; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    push(table);
    push(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

    const out = new Uint8Array(length);
    let at = 0;
    for (const chunk of chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}
