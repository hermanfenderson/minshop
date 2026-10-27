/** Low-stock threshold for the customer-facing "Low stock" bucket. */
export const LOW_STOCK = 5;

export type StockState = 'out' | 'low' | 'in';

/** What an untracked product reports as its stock: never out, never low. */
export const UNTRACKED_STOCK = 1_000_000;

/**
 * The stock a shopper can buy from: the row's count, or UNTRACKED_STOCK when
 * the product is not counted (`track_inventory = 0`, see migration 0045). Every
 * availability check and display goes through this, so an untracked product
 * with a stale count of 0 is never shown or refused as sold out.
 */
export function sellableStock(product: { track_inventory?: number | null }, stock: number): number {
  return product.track_inventory === 0 ? UNTRACKED_STOCK : stock;
}
export type StockTransitionPurger = (publicIds: string[]) => Promise<void>;

/** Classify stock for display: out (0), low (≤ LOW_STOCK), or in stock. */
export function stockState(stock: number): StockState {
  if (stock <= 0) return 'out';
  if (stock <= LOW_STOCK) return 'low';
  return 'in';
}

/**
 * Products render in/low/out; individual variants render available/sold-out.
 * Exact quantities are deliberately absent, so changes within a bucket do not
 * require invalidating cached catalog responses.
 */
export function visibleStockChanged(
  hasVariant: boolean,
  before: number,
  after: number,
): boolean {
  return hasVariant
    ? (before > 0) !== (after > 0)
    : stockState(before) !== stockState(after);
}
