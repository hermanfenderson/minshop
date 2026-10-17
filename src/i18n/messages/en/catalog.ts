import type { Message } from '../../format';

export const catalog = {
  // Catalog list defaults (src/features/products/ProductList.astro).
  'catalog.list.eyebrow': 'Shop',
  'catalog.list.heading': 'All products',

  // Storefront sort options (src/features/products/sort.ts).
  'catalog.sort.newest': 'Newest',
  'catalog.sort.price': 'Price',
  'catalog.sort.name': 'Name',
} satisfies Record<`catalog.${string}`, Message>;
