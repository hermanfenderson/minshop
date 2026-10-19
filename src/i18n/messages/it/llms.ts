import type { Catalog } from '../../catalog.ts';

export const llms = {
  'llms.intro':
    '{storeName} è un negozio online che si può esplorare e da cui si può acquistare in modo programmatico. Tutti i prezzi sono in {currency}. Questo file segue la convenzione llms.txt (https://llmstxt.org). I link al catalogo e alle categorie sono attivi; un agente può completare un acquisto tramite l\'endpoint JSON di checkout descritto in "For agents".',
  'llms.products': 'Prodotti',
  'llms.noProducts': '(nessun prodotto)',
  'llms.categories': 'Categorie',
  'llms.noCategories': '(nessuna categoria)',
  'llms.pages': 'Pagine',
  'llms.agents': 'For agents',
  'llms.language': 'Questo file è in italiano. Altre lingue: {others}.',
} satisfies Catalog;
