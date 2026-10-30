/**
 * A minimal ZIP writer for the receipts export: entries are stored, not
 * compressed (PDFs barely shrink), and written one after another into a stream,
 * so only one file is held in memory at a time however many there are.
 * Pure — no bindings — and tested in zip.test.ts.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS time and date fields, as ZIP stores them. */
function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | Math.floor(d.getUTCSeconds() / 2),
    date: ((Math.max(1980, d.getUTCFullYear()) - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(),
  };
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  modified?: Date;
}

const encoder = new TextEncoder();

/**
 * Write the entries `next` yields into a ZIP stream. `next` returns null when
 * there are no more; an entry it cannot produce it simply skips.
 */
export function zipStream(next: () => Promise<ZipEntry | null>): ReadableStream<Uint8Array> {
  const central: Uint8Array[] = [];
  let offset = 0;
  let count = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const entry = await next();
      if (entry) {
        const name = encoder.encode(entry.name);
        const crc = crc32(entry.data);
        const size = entry.data.length;
        const { time, date } = dosDateTime(entry.modified ?? new Date());
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true); // version needed
        local.setUint16(6, 0x0800, true); // UTF-8 names
        local.setUint16(8, 0, true); // stored
        local.setUint16(10, time, true);
        local.setUint16(12, date, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, size, true);
        local.setUint32(22, size, true);
        local.setUint16(26, name.length, true);
        local.setUint16(28, 0, true);
        const header = new DataView(new ArrayBuffer(46));
        header.setUint32(0, 0x02014b50, true);
        header.setUint16(4, 20, true);
        header.setUint16(6, 20, true);
        header.setUint16(8, 0x0800, true);
        header.setUint16(10, 0, true);
        header.setUint16(12, time, true);
        header.setUint16(14, date, true);
        header.setUint32(16, crc, true);
        header.setUint32(20, size, true);
        header.setUint32(24, size, true);
        header.setUint16(28, name.length, true);
        header.setUint32(42, offset, true);
        central.push(new Uint8Array(header.buffer), name);
        controller.enqueue(new Uint8Array(local.buffer));
        controller.enqueue(name);
        controller.enqueue(entry.data);
        offset += 30 + name.length + size;
        count++;
        return;
      }
      const centralSize = central.reduce((n, part) => n + part.length, 0);
      for (const part of central) controller.enqueue(part);
      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);
      end.setUint16(8, count, true);
      end.setUint16(10, count, true);
      end.setUint32(12, centralSize, true);
      end.setUint32(16, offset, true);
      controller.enqueue(new Uint8Array(end.buffer));
      controller.close();
    },
  });
}
