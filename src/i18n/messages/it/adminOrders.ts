import type { Catalog } from '../../catalog.ts';

// Only the order status words the customer's pages share with the admin
// (features/orders/statusLabels.ts), from ddyy/minshop#60. The admin comes later.
export const adminOrders = {
  'adminOrders.status.paid': 'pagato',
  'adminOrders.status.refunded': 'rimborsato',
  'adminOrders.status.pending': 'in attesa',
  'adminOrders.fulfillment.fulfilled': 'Evaso',
  'adminOrders.fulfillment.unfulfilled': 'Da evadere',
} satisfies Catalog;
