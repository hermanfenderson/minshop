/**
 * WooCommerce → Minshop catalog mapping. Pure (no bindings, no network) so the
 * mapping is unit-tested; scripts/import-woocommerce.mjs does the fetching,
 * the R2 uploads and runs the SQL this module builds.
 *
 * Scope: categories, products, variations, gallery and variation images, in
 * the source language. Not mapped: category images and descriptions (Minshop
 * categories have neither), related/upsell links, reviews, tax classes, sale
 * prices (the regular price is the price), translations (redone in the admin).
 */
import { toMinorUnits } from '../../money.ts';
import { slugify } from '../products/slug.ts';

export interface WooImage {
  id: number;
  src: string;
  alt?: string;
}

export interface WooCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
}

export interface WooAttribute {
  name: string;
  /** Set on a variation: the value this variation takes. */
  option?: string;
  /** Set on a product: every value the attribute can take. */
  options?: string[];
  variation?: boolean;
}

export interface WooVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  status: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  weight: string;
  attributes: WooAttribute[];
  image: WooImage | null;
}

export interface WooProduct {
  id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  description: string;
  short_description: string;
  price: string;
  regular_price: string;
  virtual: boolean;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: string;
  weight: string;
  categories: { id: number }[];
  images: WooImage[];
  attributes: WooAttribute[];
  /** Filled in by the fetcher from /products/<id>/variations. */
  variations?: WooVariation[];
}

export interface ImportCategory {
  wooId: number;
  name: string;
  slug: string;
  parentWooId: number | null;
}

export interface ImportImage {
  wooImageId: number;
  src: string;
  alt: string | null;
}

export interface ImportVariant {
  wooId: number;
  label: string;
  priceCents: number;
  sku: string | null;
  stock: number;
  weightGrams: number | null;
  active: boolean;
  position: number;
  wooImageId: number | null;
}

export interface ImportProduct {
  wooId: number;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  stock: number;
  active: boolean;
  requiresShipping: boolean;
  weightGrams: number | null;
  variantLabel: string | null;
  categoryWooIds: number[];
  images: ImportImage[];
  variants: ImportVariant[];
  /** Human-readable remarks for the import report (nothing reads them). */
  notes: string[];
}

/**
 * WooCommerce has no stock when "manage stock" is off — the item is simply in
 * or out of stock (a Printful item is always in). Minshop always counts, so an
 * unmanaged in-stock item gets this many: high enough to read as "in stock",
 * low enough to be obviously a placeholder in the admin.
 */
export const UNMANAGED_STOCK = 100;

/** Category WordPress creates by default; empty in practice, never imported. */
const DEFAULT_CATEGORY_SLUG = 'uncategorized';

/** Usual apparel size order; anything else keeps WooCommerce's order. */
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL'];

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  times: '×',
  euro: '€',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/**
 * WooCommerce descriptions are WordPress HTML; Minshop stores Markdown and
 * renders it with raw HTML disabled, so tags must become Markdown or go.
 * Covers what the editor produces — paragraphs, breaks, emphasis, links,
 * lists, headings; any other tag is dropped and its text kept.
 */
export function htmlToMarkdown(html: string): string {
  let s = html.replace(/\r\n?/g, '\n');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  // Source newlines are not line breaks in HTML.
  s = s.replace(/\s*\n\s*/g, ' ');
  s = s.replace(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_m, _q, href: string, text: string) => {
    const label = text.replace(/<[^>]+>/g, '').trim();
    return label ? `[${label}](${href})` : '';
  });
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, t: string) => (t.trim() ? `**${t.trim()}**` : ''));
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, t: string) => (t.trim() ? `*${t.trim()}*` : ''));
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_m, level: string, t: string) =>
    `\n\n${'#'.repeat(Math.max(2, Number(level)))} ${t.trim()}\n\n`,
  );
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, t: string) => `\n- ${t.trim()}`);
  s = s.replace(/<\/?(ul|ol)\b[^>]*>/gi, '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '  \n');
  s = s.replace(/<\/?(p|div|blockquote|section|figure)\b[^>]*>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = decodeEntities(s);
  return s
    .split('\n')
    .map((line) => line.replace(/^[ \t]+/, '').replace(/[ \t]+$/, (trail) => (trail.length >= 2 ? '  ' : '')))
    .join('\n')
    .replace(/ {2}\n(\n|$)/g, '\n$1') // a break right before a paragraph end is noise
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Woo weight string in `unit` → integer grams, or null when blank. */
export function weightToGrams(weight: string, unit: 'kg' | 'g' | 'lbs' | 'oz'): number | null {
  const n = Number(weight);
  if (weight.trim() === '' || !Number.isFinite(n) || n <= 0) return null;
  const factor = { kg: 1000, g: 1, lbs: 453.59237, oz: 28.349523125 }[unit];
  return Math.round(n * factor);
}

function stockOf(item: { manage_stock: boolean; stock_quantity: number | null; stock_status: string }): number {
  if (item.manage_stock && item.stock_quantity !== null) return Math.max(0, item.stock_quantity);
  return item.stock_status === 'outofstock' ? 0 : UNMANAGED_STOCK;
}

function priceOf(item: { regular_price: string; price: string }, currency: string): number {
  const major = Number(item.regular_price !== '' ? item.regular_price : item.price);
  return Number.isFinite(major) && major > 0 ? toMinorUnits(major, currency) : 0;
}

export function mapCategories(categories: WooCategory[]): ImportCategory[] {
  const kept = categories.filter((c) => c.slug !== DEFAULT_CATEGORY_SLUG);
  const ids = new Set(kept.map((c) => c.id));
  // Parents first, so a single INSERT pass can resolve parent_id by slug.
  const depth = (c: WooCategory): number => {
    let d = 0;
    let cur: WooCategory | undefined = c;
    while (cur && cur.parent && d < kept.length) {
      cur = kept.find((k) => k.id === cur!.parent);
      d++;
    }
    return d;
  };
  return [...kept]
    .sort((a, b) => depth(a) - depth(b))
    .map((c) => ({
      wooId: c.id,
      name: decodeEntities(c.name),
      slug: slugify(safeDecode(c.slug)),
      parentWooId: c.parent && ids.has(c.parent) ? c.parent : null,
    }));
}

function safeDecode(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function sizeRank(value: string): number {
  const i = SIZE_ORDER.indexOf(value.trim().toUpperCase());
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
}

export function mapProduct(
  p: WooProduct,
  opts: { currency: string; weightUnit: 'kg' | 'g' | 'lbs' | 'oz' },
): ImportProduct {
  const notes: string[] = [];
  const images: ImportImage[] = p.images.map((img) => ({
    wooImageId: img.id,
    src: img.src,
    alt: img.alt?.trim() ? decodeEntities(img.alt.trim()) : null,
  }));
  const axes = p.attributes.filter((a) => a.variation).map((a) => a.name);
  const variations = p.type === 'variable' ? (p.variations ?? []) : [];
  if (p.type !== 'simple' && p.type !== 'variable') notes.push(`type ${p.type} imported as a simple product`);

  // Within each axis keep the first-seen order (colors), except sizes, which
  // WooCommerce lists alphabetically (2XL, L, M, S, XL).
  const firstSeen = axes.map((axis) => {
    const order: string[] = [];
    for (const v of variations) {
      const opt = v.attributes.find((a) => a.name === axis)?.option ?? '';
      if (!order.includes(opt)) order.push(opt);
    }
    return order;
  });
  const optionsOf = (v: WooVariation) => axes.map((axis) => v.attributes.find((a) => a.name === axis)?.option ?? '');
  const sorted = [...variations].sort((a, b) => {
    const oa = optionsOf(a);
    const ob = optionsOf(b);
    for (let i = 0; i < axes.length; i++) {
      const bySize = sizeRank(oa[i]) - sizeRank(ob[i]);
      if (bySize !== 0) return bySize;
      const bySeen = firstSeen[i].indexOf(oa[i]) - firstSeen[i].indexOf(ob[i]);
      if (bySeen !== 0) return bySeen;
    }
    return 0;
  });

  const variants: ImportVariant[] = sorted.map((v, position) => {
    if (v.image && !images.some((i) => i.wooImageId === v.image!.id)) {
      // Minshop points a variant at a gallery image, so variation-only photos
      // join the gallery after the product's own.
      images.push({ wooImageId: v.image.id, src: v.image.src, alt: v.image.alt?.trim() ? decodeEntities(v.image.alt.trim()) : null });
    }
    return {
      wooId: v.id,
      label: optionsOf(v).map((o) => o || '—').join(' / '),
      priceCents: priceOf(v, opts.currency),
      sku: v.sku?.trim() || null,
      stock: stockOf(v),
      weightGrams: weightToGrams(v.weight ?? '', opts.weightUnit),
      active: v.status === 'publish',
      position,
      wooImageId: v.image?.id ?? null,
    };
  });

  const activePrices = variants.filter((v) => v.active && v.priceCents > 0).map((v) => v.priceCents);
  const priceCents = variants.length > 0 ? (activePrices.length ? Math.min(...activePrices) : 0) : priceOf(p, opts.currency);
  if (priceCents === 0) notes.push('price is 0: imported inactive (a zero-total cart cannot be paid)');
  if (new Set(variants.map((v) => v.priceCents)).size > 1) notes.push('variant prices differ');
  if (variations.length === 0 && p.type === 'variable') notes.push('variable product without variations');
  const anyManaged = p.manage_stock || variations.some((v) => v.manage_stock);
  if (!anyManaged) notes.push(`stock not managed in WooCommerce: set to ${UNMANAGED_STOCK}`);

  const description = htmlToMarkdown(p.description || p.short_description || '');
  return {
    wooId: p.id,
    name: decodeEntities(p.name),
    slug: slugify(safeDecode(p.slug)),
    description,
    priceCents,
    stock: variants.length > 0 ? variants.reduce((n, v) => n + (v.active ? v.stock : 0), 0) : stockOf(p),
    active: p.status === 'publish' && priceCents > 0,
    requiresShipping: !p.virtual,
    weightGrams: weightToGrams(p.weight ?? '', opts.weightUnit),
    variantLabel: variants.length > 0 ? axes.join(' / ') : null,
    categoryWooIds: p.categories.map((c) => c.id),
    images,
    variants,
    notes,
  };
}

/** Single-quoted SQL literal, or NULL. */
export function sqlValue(v: string | number | boolean | null): string {
  if (v === null) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`not a finite number: ${v}`);
    return String(v);
  }
  return `'${v.replace(/'/g, "''")}'`;
}

export interface StoredMedia {
  /** R2 key (`media/<hex>.<ext>`) of the image already in the bucket. */
  key: string;
  /** media.public_id; the row is inserted unless `existing` is true. */
  publicId: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  /** The media row is already in D1 (a re-run): reuse it, insert nothing. */
  existing: boolean;
}

export interface SqlOptions {
  currency: string;
  /** Remove the existing catalog first (products, categories and their rows). */
  replace: boolean;
  media: Map<number, StoredMedia>;
  newId: (kind: 'product' | 'variant' | 'category' | 'productImage') => string;
}

/**
 * Statements that load the catalog. Rows reference each other by public_id
 * subqueries, so the file needs no generated row ids and runs as one
 * `wrangler d1 execute --file`. Orders are never touched: their lines keep
 * their own name and price snapshot when a product is replaced.
 */
export function buildImportSql(categories: ImportCategory[], products: ImportProduct[], o: SqlOptions): string[] {
  const out: string[] = [];
  if (o.replace) {
    out.push(
      'DELETE FROM product_image_translations',
      'DELETE FROM product_variant_translations',
      'DELETE FROM product_extra_translations',
      'DELETE FROM product_translations',
      'DELETE FROM category_translations',
      'DELETE FROM product_categories',
      'DELETE FROM product_images',
      'DELETE FROM product_variants',
      'DELETE FROM product_extras',
      "DELETE FROM menu_items WHERE target_type IN ('product', 'category')",
      'DELETE FROM products',
      'DELETE FROM categories',
    );
  }

  const catPublic = new Map<number, string>();
  for (const c of categories) {
    const id = o.newId('category');
    catPublic.set(c.wooId, id);
    const parent = c.parentWooId !== null && catPublic.has(c.parentWooId)
      ? `(SELECT id FROM categories WHERE public_id = ${sqlValue(catPublic.get(c.parentWooId)!)})`
      : 'NULL';
    out.push(
      `INSERT INTO categories (name, slug, parent_id, public_id) VALUES (${sqlValue(c.name)}, ${sqlValue(c.slug)}, ${parent}, ${sqlValue(id)})`,
    );
  }

  for (const m of new Map([...o.media].filter(([, m]) => !m.existing)).values()) {
    out.push(
      `INSERT INTO media (image_key, original_name, mime_type, size_bytes, width, height, public_id) VALUES (${[
        m.key, m.originalName, m.mime, m.sizeBytes, m.width, m.height, m.publicId,
      ].map(sqlValue).join(', ')})`,
    );
  }

  for (const p of products) {
    const pid = o.newId('product');
    const productRef = `(SELECT id FROM products WHERE public_id = ${sqlValue(pid)})`;
    const stored = p.images.filter((img) => o.media.has(img.wooImageId));
    const primary = stored[0] ? o.media.get(stored[0].wooImageId)!.key : null;
    out.push(
      `INSERT INTO products (name, slug, description, price_cents, currency, image_key, stock, active, weight_grams, requires_shipping, variant_label, public_id) VALUES (${[
        p.name, p.slug, p.description, p.priceCents, o.currency, primary, p.stock, p.active, p.weightGrams,
        p.requiresShipping, p.variantLabel, pid,
      ].map(sqlValue).join(', ')})`,
    );
    for (const wooCat of p.categoryWooIds) {
      const cid = catPublic.get(wooCat);
      if (!cid) continue;
      out.push(
        `INSERT INTO product_categories (product_id, category_id) VALUES (${productRef}, (SELECT id FROM categories WHERE public_id = ${sqlValue(cid)}))`,
      );
    }
    const imagePublic = new Map<number, string>();
    stored.forEach((img, position) => {
      const iid = o.newId('productImage');
      imagePublic.set(img.wooImageId, iid);
      out.push(
        `INSERT INTO product_images (product_id, image_key, position, alt, public_id) VALUES (${productRef}, ${[
          o.media.get(img.wooImageId)!.key, position, img.alt, iid,
        ].map(sqlValue).join(', ')})`,
      );
    });
    for (const v of p.variants) {
      const image = v.wooImageId !== null && imagePublic.has(v.wooImageId)
        ? `(SELECT id FROM product_images WHERE public_id = ${sqlValue(imagePublic.get(v.wooImageId)!)})`
        : 'NULL';
      out.push(
        `INSERT INTO product_variants (product_id, label, price_cents, stock, sku, position, active, weight_grams, image_id, public_id) VALUES (${productRef}, ${[
          v.label, v.priceCents, v.stock, v.sku, v.position, v.active, v.weightGrams,
        ].map(sqlValue).join(', ')}, ${image}, ${sqlValue(o.newId('variant'))})`,
      );
    }
  }
  return out;
}
