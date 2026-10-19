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

/**
 * English: the source catalog. Its keys define MessageKey. Add areas here.
 * The storefront, catalog, cart, checkout, order and account areas come from
 * ddyy/minshop#60 (Luca G.).
 */
export const en = {
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
};
