/**
 * The page's JSON-LD graph: a WebPage in the language of its main content, its
 * BreadcrumbList, and (on a product page) the Product. Names and descriptions
 * come from the same translated rows the page renders; prices, currency and
 * availability are the shared commercial data, identical in every language.
 * Pure; the URLs are the page's canonical ones.
 */
import type { PageSeo } from './seo.ts';

export interface Crumb {
  name: string;
  /** Absolute URL. */
  url: string;
}

export function structuredData(input: {
  seo: Pick<PageSeo, 'canonical' | 'contentLanguage'>;
  pageType: 'WebPage' | 'ItemPage' | 'CollectionPage';
  name: string;
  breadcrumb: Crumb[];
  /** A schema.org Product (without @context), or nothing. */
  product?: Record<string, unknown>;
}): string {
  const { canonical, contentLanguage } = input.seo;
  const graph: Record<string, unknown>[] = [
    {
      '@type': input.pageType,
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: input.name,
      inLanguage: contentLanguage,
      ...(input.breadcrumb.length > 0 && { breadcrumb: { '@id': `${canonical}#breadcrumb` } }),
      ...(input.product && { mainEntity: { '@id': `${canonical}#product` } }),
    },
  ];
  if (input.breadcrumb.length > 0) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: input.breadcrumb.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    });
  }
  if (input.product) {
    const offers = input.product.offers as Record<string, unknown> | undefined;
    graph.push({
      ...input.product,
      '@id': `${canonical}#product`,
      url: canonical,
      ...(offers && { offers: { ...offers, url: canonical } }),
    });
  }
  // Escape "<" so no name can close the <script> element.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}
