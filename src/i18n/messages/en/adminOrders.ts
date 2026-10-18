import type { Message } from '../../format.ts';

// Only the order status words the customer's pages share with the admin
// (features/orders/statusLabels.ts), from ddyy/minshop#60. The admin comes later.
export const adminOrders = {
  'adminOrders.status.paid': 'paid',
  'adminOrders.status.refunded': 'refunded',
  'adminOrders.status.pending': 'pending',
  'adminOrders.fulfillment.fulfilled': 'Fulfilled',
  'adminOrders.fulfillment.unfulfilled': 'Unfulfilled',
} satisfies Record<`adminOrders.${string}`, Message>;
