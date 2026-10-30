import { describe, expect, it } from 'vitest';
import { crc32, zipStream, type ZipEntry } from './zip';

async function bytes(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe('zip', () => {
  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('writes stored entries a reader can find through the central directory', async () => {
    const entries: ZipEntry[] = [
      { name: 'registro.csv', data: new TextEncoder().encode('a,b\r\n'), modified: new Date('2027-03-04T10:20:30Z') },
      { name: 'M1-2027.pdf', data: new Uint8Array([37, 80, 68, 70]) },
    ];
    let i = 0;
    const zip = await bytes(zipStream(async () => entries[i++] ?? null));
    const view = new DataView(zip.buffer);
    const end = zip.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const centralOffset = view.getUint32(end + 16, true);
    // Second central record → its local header → its data.
    const firstNameLength = view.getUint16(centralOffset + 28, true);
    const second = centralOffset + 46 + firstNameLength;
    expect(view.getUint32(second, true)).toBe(0x02014b50);
    const local = view.getUint32(second + 42, true);
    expect(view.getUint32(local, true)).toBe(0x04034b50);
    const nameLength = view.getUint16(local + 26, true);
    expect(new TextDecoder().decode(zip.slice(local + 30, local + 30 + nameLength))).toBe('M1-2027.pdf');
    expect([...zip.slice(local + 30 + nameLength, local + 34 + nameLength)]).toEqual([37, 80, 68, 70]);
    expect(view.getUint32(local + 14, true)).toBe(crc32(entries[1].data));
  });

  it('writes a valid empty archive', async () => {
    const zip = await bytes(zipStream(async () => null));
    expect(zip.length).toBe(22);
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x06054b50);
  });
});
