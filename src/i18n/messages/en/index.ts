import { common } from './common';
import { storefront } from './storefront';
import { catalog } from './catalog';
import { cart } from './cart';
import { checkout } from './checkout';

/**
 * English: the source catalog. Its keys define MessageKey. Add areas here.
 * The storefront, catalog and cart areas come from ddyy/minshop#60 (Luca G.).
 */
export const en = {
  ...common,
  ...storefront,
  ...catalog,
  ...cart,
  ...checkout,
};
