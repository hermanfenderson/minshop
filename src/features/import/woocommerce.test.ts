import { describe, expect, it } from 'vitest';
import {
  buildImportSql,
  htmlToMarkdown,
  mapCategories,
  mapProduct,
  sqlValue,
  UNMANAGED_STOCK,
  weightToGrams,
  type StoredMedia,
  type WooProduct,
  type WooVariation,
} from './woocommerce';

const opts = { currency: 'eur', weightUnit: 'kg' as const };

function product(over: Partial<WooProduct> = {}): WooProduct {
  return {
    id: 1,
    name: 'Tee',
    slug: 'tee',
    type: 'simple',
    status: 'publish',
    description: '<p>Hello</p>',
    short_description: '',
    price: '20',
    regular_price: '20',
    virtual: false,
    manage_stock: false,
    stock_quantity: null,
    stock_status: 'instock',
    weight: '',
    categories: [{ id: 10 }],
    images: [{ id: 100, src: 'https://x/a.jpg', alt: '' }],
    attributes: [],
    ...over,
  };
}

function variation(id: number, options: Record<string, string>, over: Partial<WooVariation> = {}): WooVariation {
  return {
    id,
    sku: `SKU_${id}`,
    price: '20',
    regular_price: '20',
    status: 'publish',
    manage_stock: false,
    stock_quantity: null,
    stock_status: 'instock',
    weight: '0.19',
    attributes: Object.entries(options).map(([name, option]) => ({ name, option })),
    image: null,
    ...over,
  };
}

describe('htmlToMarkdown', () => {
  it('turns WordPress paragraphs, breaks and emphasis into Markdown', () => {
    const html = '<p>Wear it.<br />\nCarry it.</p>\n<p><strong>Note:</strong> the price &amp; more…</p>';
    expect(htmlToMarkdown(html)).toBe('Wear it.  \nCarry it.\n\n**Note:** the price & more…');
  });

  it('keeps links and lists, drops other tags', () => {
    const html = '<ul><li>One</li><li><a href="https://e.x/a">Two</a></li></ul><span style="x">end</span>';
    expect(htmlToMarkdown(html)).toBe('- One\n- [Two](https://e.x/a)\n\nend');
  });

  it('never lets raw HTML through', () => {
    expect(htmlToMarkdown('<script>alert(1)</script><img src=x onerror=y>ok')).toBe('ok');
  });
});

describe('weightToGrams', () => {
  it('converts and rounds', () => {
    expect(weightToGrams('0.19', 'kg')).toBe(190);
    expect(weightToGrams('', 'kg')).toBeNull();
    expect(weightToGrams('1', 'lbs')).toBe(454);
  });
});

describe('mapCategories', () => {
  it('drops Uncategorized and orders parents first', () => {
    const cats = mapCategories([
      { id: 2, name: 'Child &amp; co', slug: 'child', parent: 1 },
      { id: 1, name: 'Parent', slug: 'parent', parent: 0 },
      { id: 15, name: 'Uncategorized', slug: 'uncategorized', parent: 0 },
    ]);
    expect(cats.map((c) => c.slug)).toEqual(['parent', 'child']);
    expect(cats[1]).toMatchObject({ name: 'Child & co', parentWooId: 1 });
  });
});

describe('mapProduct', () => {
  it('maps a simple product with unmanaged stock', () => {
    const p = mapProduct(product(), opts);
    expect(p).toMatchObject({ priceCents: 2000, stock: UNMANAGED_STOCK, active: true, requiresShipping: true, variantLabel: null });
    expect(p.description).toBe('Hello');
  });

  it('imports a zero-price virtual product inactive and not shipped', () => {
    const p = mapProduct(product({ price: '0', regular_price: '0', virtual: true }), opts);
    expect(p).toMatchObject({ priceCents: 0, active: false, requiresShipping: false });
  });

  it('combines two attributes into one variant group: colors as listed, sizes in size order', () => {
    const p = mapProduct(
      product({
        type: 'variable',
        attributes: [
          { name: 'Color', variation: true, options: ['White', 'Black'] },
          { name: 'Size', variation: true, options: ['2XL', 'L', 'M', 'S', 'XL'] },
        ],
        variations: [
          variation(1, { Color: 'White', Size: '2XL' }, { regular_price: '21' }),
          variation(2, { Color: 'White', Size: 'S' }),
          variation(3, { Color: 'Black', Size: 'S' }, { image: { id: 300, src: 'https://x/b.jpg', alt: '' } }),
        ],
      }),
      opts,
    );
    expect(p.variantLabel).toBe('Color / Size');
    expect(p.variants.map((v) => v.label)).toEqual(['White / S', 'White / 2XL', 'Black / S']);
    expect(p.priceCents).toBe(2000);
    expect(p.variants[0].weightGrams).toBe(190);
    // The variation-only photo joins the gallery so the variant can point at it.
    expect(p.images.map((i) => i.wooImageId)).toEqual([100, 300]);
    expect(p.stock).toBe(3 * UNMANAGED_STOCK);
  });
});

describe('buildImportSql', () => {
  it('links rows by public id and inserts only new media', () => {
    const p = mapProduct(
      product({
        type: 'variable',
        attributes: [{ name: 'Size', variation: true, options: ['S'] }],
        variations: [variation(1, { Size: 'S' }, { image: { id: 100, src: 'https://x/a.jpg' } })],
      }),
      opts,
    );
    const media = new Map<number, StoredMedia>([
      [100, { key: 'media/aa.jpg', publicId: 'med_1', originalName: "o'a.jpg", mime: 'image/jpeg', sizeBytes: 9, width: 2, height: 3, existing: false }],
    ]);
    let n = 0;
    const sql = buildImportSql(mapCategories([{ id: 10, name: 'Shirts', slug: 'shirts', parent: 0 }]), [p], {
      currency: 'eur',
      replace: true,
      media,
      newId: (kind) => `${kind}_${++n}`,
    });
    expect(sql[0]).toMatch(/^DELETE FROM/);
    const inserts = sql.filter((s) => s.startsWith('INSERT'));
    expect(inserts.map((s) => s.split(' ')[2])).toEqual([
      'categories', 'media', 'products', 'product_categories', 'product_images', 'product_variants',
    ]);
    expect(inserts[1]).toContain("'o''a.jpg'");
    expect(inserts[2]).toContain("'media/aa.jpg'");
    expect(inserts[5]).toContain("(SELECT id FROM product_images WHERE public_id = 'productImage_");

    media.get(100)!.existing = true;
    const rerun = buildImportSql([], [p], { currency: 'eur', replace: false, media, newId: (k) => `${k}_x` });
    expect(rerun.some((s) => s.startsWith('INSERT INTO media'))).toBe(false);
  });

  it('escapes SQL literals', () => {
    expect(sqlValue("it's")).toBe("'it''s'");
    expect(sqlValue(null)).toBe('NULL');
    expect(sqlValue(true)).toBe('1');
  });
});
