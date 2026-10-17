// The catalog-free formatter's type only: storefront controls will reach these
// files for their English fallback, and importing the bound catalogs here would
// drag every locale into the storefront boundary checker's import walk.
import type { Message } from '../../format';

export const common = {
  // Page links, shared by the storefront catalog and the admin lists (ddyy/minshop#60).
  'common.pagination.label': 'Pagination',
  'common.pagination.prev': 'Prev',
  'common.pagination.next': 'Next',
  // Language switcher.
  'common.language.label': 'Language',
  'common.language.switchTo': 'View this page in {language}',
  // Generic counts.
  'common.items': { one: '{count} item', other: '{count} items' },
} satisfies Record<`common.${string}`, Message>;
