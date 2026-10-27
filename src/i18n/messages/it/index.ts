import type { Catalog } from '../../catalog.ts';
import { common } from './common.ts';
import { storefront } from './storefront.ts';
import { catalog } from './catalog.ts';
import { cart } from './cart.ts';
import { checkout } from './checkout.ts';
import { order } from './order.ts';
import { account } from './account.ts';
import { adminOrders } from './adminOrders.ts';
import { email } from './email.ts';
import { llms } from './llms.ts';
import { benefit } from './benefit.ts';

/**
 * Italian. Any subset of the English keys; missing ones fall back.
 * The storefront, catalog, cart, checkout, order and account translations
 * come from ddyy/minshop#60 (Luca G.).
 */
export const it: Catalog = {
  ...common,
  ...storefront,
  ...catalog,
  ...cart,
  ...checkout,
  ...order,
  ...account,
  ...adminOrders,
  ...email,
  ...llms,
  ...benefit,
};
