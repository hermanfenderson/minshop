import { describe, expect, it } from 'vitest';
import { structuredData } from './structuredData';

const seo = { canonical: 'https://s.example/it/shop/products/strap', contentLanguage: 'it' };

describe('structuredData', () => {
  const graph = () =>
    JSON.parse(
      structuredData({
        seo,
        pageType: 'ItemPage',
        name: 'Tracolla </script>',
        breadcrumb: [
          { name: 'Negozio', url: 'https://s.example/it/shop/' },
          { name: 'Tracolla', url: seo.canonical },
        ],
        product: {
          '@type': 'Product',
          name: 'Tracolla',
          offers: { '@type': 'Offer', price: '24.00', priceCurrency: 'EUR' },
        },
      }),
    )['@graph'];

  it('names the page language and links page, trail and product by id', () => {
    const [page, crumbs, product] = graph();
    expect(page).toMatchObject({ '@type': 'ItemPage', url: seo.canonical, inLanguage: 'it' });
    expect(page.breadcrumb['@id']).toBe(crumbs['@id']);
    expect(page.mainEntity['@id']).toBe(product['@id']);
    expect(crumbs.itemListElement.map((c: { position: number }) => c.position)).toEqual([1, 2]);
  });

  it('gives the product and its offer the canonical URL, prices untouched', () => {
    const product = graph()[2];
    expect(product.url).toBe(seo.canonical);
    expect(product.offers).toEqual({ '@type': 'Offer', price: '24.00', priceCurrency: 'EUR', url: seo.canonical });
  });

  it('cannot close its script element', () => {
    const raw = structuredData({ seo, pageType: 'WebPage', name: '</script><b>', breadcrumb: [] });
    expect(raw).not.toContain('</script>');
    expect(JSON.parse(raw)['@graph'][0].name).toBe('</script><b>');
  });
});
