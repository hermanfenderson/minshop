import type { Catalog } from '../../catalog';
import { common } from './common';
import { storefront } from './storefront';
import { catalog } from './catalog';
import { cart } from './cart';
import { checkout } from './checkout';

/**
 * Italian. Any subset of the English keys; missing ones fall back.
 * The storefront, catalog and cart translations come from ddyy/minshop#60 (Luca G.).
 */
export const it: Catalog = {
  ...common,
  ...storefront,
  ...catalog,
  ...cart,
  ...checkout,
};
