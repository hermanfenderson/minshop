import { enI18n, type I18n } from '../../i18n/translator.ts';

// Whitelisted sort columns. The query param `sort` maps to a fixed column name
// here, so user input is never interpolated into SQL.
const COLUMNS: Record<string, string> = {
  newest: 'created_at',
  created: 'created_at',
  name: 'name',
  price: 'price_cents',
  stock: 'stock',
  sold: 'sold', // aggregate alias from listAllProducts (units sold, paid orders)
  active: 'active',
  id: 'id',
};

/** Build a safe `ORDER BY` clause from query params (whitelisted col + direction). */
export function orderByClause(
  sort: string | null,
  dir: string | null,
  fallback: { col: string; dir: 'ASC' | 'DESC' } = { col: 'created_at', dir: 'DESC' },
): string {
  const col = (sort && COLUMNS[sort]) || fallback.col;
  const d =
    dir?.toLowerCase() === 'asc' ? 'ASC' : dir?.toLowerCase() === 'desc' ? 'DESC' : fallback.dir;
  const collate = col === 'name' ? ' COLLATE NOCASE' : ''; // case-insensitive name sort
  // Tiebreak on the unique id (same direction) so equal values still sort
  // deterministically AND flip with direction — e.g. products seeded with the same
  // created_at would otherwise look identical for "Newest" ascending vs descending.
  const tiebreak = col === 'id' ? '' : `, id ${d}`;
  return `${col}${collate} ${d}${tiebreak}`;
}

/**
 * Preset storefront sort options (rendered as links). One entry per field — `dir`
 * is the DEFAULT direction applied when you first pick that field; clicking an
 * already-active field toggles it (the arrow flips), so a field never appears twice.
 * Labels are in `i18n`'s language (the storefront passes the store translator).
 */
export function storeSorts(
  i18n: I18n = enI18n,
): { sort: string; dir: 'asc' | 'desc'; label: string }[] {
  return [
    { sort: 'newest', dir: 'desc', label: i18n.t('catalog.sort.newest') },
    { sort: 'price', dir: 'asc', label: i18n.t('catalog.sort.price') },
    { sort: 'name', dir: 'asc', label: i18n.t('catalog.sort.name') },
  ];
}

/** The sort options with English labels. Prefer storeSorts(i18n) for display. */
export const STORE_SORTS = storeSorts();

export type StoreSort = 'newest' | 'price' | 'name';

export interface StoreSortQuery {
  sort: StoreSort;
  dir: 'asc' | 'desc';
}

/**
 * Canonical storefront sorting. Admin-only columns such as stock/sold stay
 * unavailable on public pages, and equivalent invalid/default query strings
 * collapse to one edge-cache key.
 */
export function parseStoreSortQuery(
  sort: string | null,
  dir: string | null,
): StoreSortQuery {
  const normalizedSort: StoreSort =
    sort === 'price' || sort === 'name' || sort === 'newest' ? sort : 'newest';
  const normalizedDir = dir?.toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { sort: normalizedSort, dir: normalizedDir };
}
