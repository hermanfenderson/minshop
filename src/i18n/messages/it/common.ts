import type { Catalog } from '../../catalog';

export const common = {
  'common.pagination.label': 'Paginazione',
  'common.pagination.prev': 'Precedente',
  'common.pagination.next': 'Successiva',
  'common.language.label': 'Lingua',
  'common.language.switchTo': 'Visualizza questa pagina in {language}',
  'common.items': { one: '{count} articolo', many: '{count} di articoli', other: '{count} articoli' },
} satisfies Catalog;
