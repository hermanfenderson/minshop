import type { D1Database } from '@cloudflare/workers-types';
import type { FulfillmentShipmentItem } from './provider';

/**
 * Packages (migration 0049): an order can leave in several — the fulfiller
 * splits it by facility, the shop ships its own items itself — and each one
 * says which order lines it holds. The order is shipped when every line that
 * ships is in a package; each package gets its own email.
 *
 * The pure half (mapping, progress) is tested in packages.test.ts; the
 * statements run against a real D1 in test/integration/fulfillment-shipments.mjs.
 */

/** An order line as packing sees it. */
export interface PackableLine {
  id: number;
  name: string;
  quantity: number;
  /** The fulfiller's ref for this line (variant's, else product's); null = the shop ships it. */
  ref: string | null;
  /** 0 for what never ships (a donation, a download). */
  requires_shipping: number;
}

export interface PackedItem {
  orderItemId: number;
  quantity: number;
}

/**
 * Turn what a fulfiller says a package holds into our lines: by the line id we
 * handed over, else by the unit's ref (orders sent before line ids were), never
 * more of a line than the order has and earlier packages have not taken.
 */
export function mapPackageItems(
  items: FulfillmentShipmentItem[],
  lines: PackableLine[],
  alreadyPacked: Map<number, number>,
): PackedItem[] {
  const left = new Map(lines.map((l) => [l.id, l.quantity - (alreadyPacked.get(l.id) ?? 0)]));
  const out = new Map<number, number>();
  const take = (lineId: number, wanted: number): number => {
    const n = Math.min(wanted, left.get(lineId) ?? 0);
    if (n <= 0) return 0;
    left.set(lineId, (left.get(lineId) ?? 0) - n);
    out.set(lineId, (out.get(lineId) ?? 0) + n);
    return n;
  };
  for (const item of items) {
    let wanted = item.quantity;
    const byId = item.externalId ? lines.find((l) => String(l.id) === item.externalId) : undefined;
    if (byId) wanted -= take(byId.id, wanted);
    if (item.ref) {
      for (const l of lines) {
        if (wanted <= 0) break;
        if (l.ref === item.ref) wanted -= take(l.id, wanted);
      }
    }
  }
  return [...out].map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
}

export interface LineProgress {
  id: number;
  name: string;
  quantity: number;
  packed: number;
}

/** What still waits for a package: lines that ship, with fewer units packed than ordered. */
export function waitingLines(lines: PackableLine[], packed: Map<number, number>): LineProgress[] {
  return lines
    .filter((l) => l.requires_shipping && l.quantity > 0)
    .map((l) => ({ id: l.id, name: l.name, quantity: l.quantity, packed: packed.get(l.id) ?? 0 }))
    .filter((l) => l.packed < l.quantity);
}

/** Lines the fulfiller makes, still unpacked: when it says the order is done, they are in its packages. */
export function fulfillerRemainder(lines: PackableLine[], packed: Map<number, number>): PackedItem[] {
  return lines
    .filter((l) => l.ref && l.quantity > (packed.get(l.id) ?? 0))
    .map((l) => ({ orderItemId: l.id, quantity: l.quantity - (packed.get(l.id) ?? 0) }));
}

// ── Statements ────────────────────────────────────────────────────────────────

export async function loadPackableLines(db: D1Database, orderId: number): Promise<PackableLine[]> {
  const { results } = await db
    .prepare(
      `SELECT oi.id, oi.name, oi.quantity,
              COALESCE(v.fulfillment_ref, CASE WHEN oi.variant_id IS NULL THEN p.fulfillment_ref END) AS ref,
              COALESCE(p.requires_shipping, 1) AS requires_shipping
         FROM order_items oi
         LEFT JOIN product_variants v ON v.id = oi.variant_id
         LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
        ORDER BY oi.id`,
    )
    .bind(orderId)
    .all<PackableLine>();
  return results ?? [];
}

/** Units of each line already in a package. */
export async function packedQuantities(db: D1Database, orderId: number): Promise<Map<number, number>> {
  const { results } = await db
    .prepare(
      `SELECT si.order_item_id, SUM(si.quantity) AS packed
         FROM order_shipment_items si JOIN order_shipments s ON s.id = si.shipment_id
        WHERE s.order_id = ?
        GROUP BY si.order_item_id`,
    )
    .bind(orderId)
    .all<{ order_item_id: number; packed: number }>();
  return new Map((results ?? []).map((r) => [r.order_item_id, Number(r.packed)]));
}

export interface NewPackage {
  orderId: number;
  /** 'printful', 'manual', … */
  provider: string;
  providerShipmentId: string;
  carrier: string | null;
  service: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  items: PackedItem[];
}

/**
 * Record a package and what it holds. Returns its row id, or null when the
 * same package (provider + its id) was recorded before: a repeated webhook,
 * poll or click records nothing new.
 */
export async function recordPackage(db: D1Database, p: NewPackage): Promise<number | null> {
  const row = await db
    .prepare(
      `INSERT OR IGNORE INTO order_shipments
         (order_id, provider, provider_shipment_id, carrier, service, tracking_number, tracking_url, shipped_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    )
    .bind(p.orderId, p.provider, p.providerShipmentId, p.carrier, p.service, p.trackingNumber, p.trackingUrl, p.shippedAt)
    .first<{ id: number }>();
  if (!row) return null;
  if (p.items.length > 0) await addPackageItems(db, row.id, p.items);
  return row.id;
}

export async function addPackageItems(db: D1Database, shipmentId: number, items: PackedItem[]): Promise<void> {
  await db.batch(
    items.map((i) =>
      db
        .prepare('INSERT OR IGNORE INTO order_shipment_items (shipment_id, order_item_id, quantity) VALUES (?, ?, ?)')
        .bind(shipmentId, i.orderItemId, i.quantity),
    ),
  );
}

/** A package recorded before line contents were (or reported without them). */
export async function packagesWithoutItems(db: D1Database, orderId: number, provider: string): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT s.id FROM order_shipments s
        WHERE s.order_id = ? AND s.provider = ?
          AND NOT EXISTS (SELECT 1 FROM order_shipment_items si WHERE si.shipment_id = s.id)
        ORDER BY s.id`,
    )
    .bind(orderId, provider)
    .all<{ id: number }>();
  return (results ?? []).map((r) => r.id);
}

/**
 * Mark the order shipped once nothing waits any more, with the latest
 * package's tracking on the order row (its one-line summary in lists and
 * exports). Refused, like every route to fulfilled, while a label purchase is
 * in flight. True = it changed now.
 */
export async function fulfilWhenAllPacked(db: D1Database, orderId: number): Promise<boolean> {
  const lines = await loadPackableLines(db, orderId);
  if (waitingLines(lines, await packedQuantities(db, orderId)).length > 0) return false;
  const res = await db
    .prepare(
      `UPDATE orders
          SET fulfillment_status = 'fulfilled', fulfilled_at = datetime('now'),
              (tracking_carrier, tracking_number, tracking_url) = (
                SELECT carrier, tracking_number, tracking_url FROM order_shipments
                 WHERE order_id = ?1 ORDER BY id DESC LIMIT 1)
        WHERE id = ?1 AND fulfillment_status = 'unfulfilled'
          AND EXISTS (SELECT 1 FROM order_shipments WHERE order_id = ?1)
          AND NOT EXISTS (
            SELECT 1 FROM shipping_labels
             WHERE order_id = orders.id AND status IN ('purchasing', 'uncertain')
          )`,
    )
    .bind(orderId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export interface PackageView {
  id: number;
  provider: string;
  provider_shipment_id: string;
  carrier: string | null;
  service: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  created_at: string;
  items: Array<{ order_item_id: number; name: string; quantity: number }>;
}

/** Every package of an order with what it holds, oldest first. */
export async function listPackages(db: D1Database, orderId: number): Promise<PackageView[]> {
  const [shipments, items] = await db.batch([
    db
      .prepare(
        `SELECT id, provider, provider_shipment_id, carrier, service, tracking_number, tracking_url, shipped_at, created_at
           FROM order_shipments WHERE order_id = ? ORDER BY id`,
      )
      .bind(orderId),
    db
      .prepare(
        `SELECT si.shipment_id, si.order_item_id, si.quantity, oi.name
           FROM order_shipment_items si
           JOIN order_shipments s ON s.id = si.shipment_id
           JOIN order_items oi ON oi.id = si.order_item_id
          WHERE s.order_id = ?
          ORDER BY si.order_item_id`,
      )
      .bind(orderId),
  ]);
  const byShipment = new Map<number, PackageView['items']>();
  for (const r of (items.results ?? []) as Array<{ shipment_id: number; order_item_id: number; quantity: number; name: string }>) {
    const list = byShipment.get(r.shipment_id) ?? [];
    list.push({ order_item_id: r.order_item_id, name: r.name, quantity: r.quantity });
    byShipment.set(r.shipment_id, list);
  }
  return ((shipments.results ?? []) as Omit<PackageView, 'items'>[]).map((s) => ({
    ...s,
    items: byShipment.get(s.id) ?? [],
  }));
}

/** The packages the shop recorded by hand go when the order is marked unshipped; the fulfiller's are facts and stay. */
export async function deleteManualPackages(db: D1Database, orderId: number): Promise<void> {
  await db.batch([
    db
      .prepare(
        `DELETE FROM order_shipment_items WHERE shipment_id IN
           (SELECT id FROM order_shipments WHERE order_id = ? AND provider = 'manual')`,
      )
      .bind(orderId),
    db.prepare(`DELETE FROM order_shipments WHERE order_id = ? AND provider = 'manual'`).bind(orderId),
  ]);
}
