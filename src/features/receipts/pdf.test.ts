import { describe, expect, it } from 'vitest';
import { PdfFlow, jpegInfo, textWidth, wrapText } from './pdf';

// The smallest useful JPEG header: SOI, an APP0 segment, then a baseline SOF0
// for a 3-component 40×20 image.
const JPEG = Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x14, 0x00, 0x28, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0xff, 0xd9,
]);

const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

describe('jpegInfo', () => {
  it('reads the frame size and components', () => {
    expect(jpegInfo(JPEG)).toEqual({ width: 40, height: 20, components: 3 });
  });

  it('rejects anything that is not a JPEG', () => {
    expect(jpegInfo(new TextEncoder().encode('%PDF-1.4'))).toBeNull();
    expect(jpegInfo(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});

describe('text metrics', () => {
  it('measures with the Helvetica widths', () => {
    expect(textWidth('A', 'regular', 10)).toBeCloseTo(6.67);
    expect(textWidth('AA', 'bold', 10)).toBeCloseTo(14.44);
    // An accented letter measures as its base letter.
    expect(textWidth('à', 'regular', 10)).toBe(textWidth('a', 'regular', 10));
  });

  it('wraps on spaces and keeps explicit newlines', () => {
    const lines = wrapText('uno due tre quattro', 'regular', 10, 40);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('uno due tre quattro');
    expect(wrapText('a\nb', 'regular', 10, 500)).toEqual(['a', 'b']);
  });
});

describe('PdfFlow', () => {
  it('writes a well-formed PDF with a correct cross-reference table', () => {
    const pdf = latin1(
      new PdfFlow().text('Ricevuta N. W1/2027', { face: 'bold', size: 14 }).text('Totale: € 40,00 — è così').toBytes({ title: 'Ricevuta' }),
    );
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    // Every xref offset points at the start of its object.
    const xrefAt = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(xrefAt, xrefAt + 4)).toBe('xref');
    const entries = pdf.slice(xrefAt).split('\n').slice(2).filter((line) => / n $/.test(line));
    entries.forEach((line, index) => {
      const offset = Number(line.slice(0, 10));
      expect(pdf.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
    // WinAnsi: € is 0x80 (octal 200), è is 0xE8 (octal 350).
    expect(pdf).toContain('\\200 40,00');
    expect(pdf).toContain('\\350 cos\\354');
  });

  it('escapes PDF string delimiters', () => {
    const pdf = latin1(new PdfFlow().text('a (b) \\ c').toBytes());
    expect(pdf).toContain('(a \\(b\\) \\\\ c)');
  });

  it('embeds a JPEG as a DCT image and draws it', () => {
    const pdf = latin1(new PdfFlow().image({ bytes: JPEG, info: jpegInfo(JPEG)! }, 100, 100).toBytes());
    expect(pdf).toContain('/Subtype /Image /Width 40 /Height 20 /ColorSpace /DeviceRGB');
    expect(pdf).toContain('/Filter /DCTDecode');
    expect(pdf).toContain('/Im1 Do');
  });

  it('starts a new page when the content overflows', () => {
    const flow = new PdfFlow();
    for (let i = 0; i < 120; i++) flow.text(`Riga ${i}`);
    const pdf = latin1(flow.toBytes());
    expect(/\/Count (\d+)/.exec(pdf)![1]).toBe('3');
  });
});
