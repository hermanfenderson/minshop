import type { Message } from '../../format.ts';

/** llms.txt (llmstxt.org): the headings, intro and link labels. The agent
 *  instructions under "For agents" document the JSON contract and stay English. */
export const llms = {
  'llms.intro':
    '{storeName} is an online store you can browse and purchase from programmatically. All prices are in {currency}. This file follows the llms.txt convention (https://llmstxt.org). Catalog and category links are live; an agent can complete a purchase via the JSON checkout endpoint under "For agents".',
  'llms.products': 'Products',
  'llms.noProducts': '(no products listed)',
  'llms.categories': 'Categories',
  'llms.noCategories': '(no categories)',
  'llms.pages': 'Pages',
  'llms.agents': 'For agents',
  'llms.language': 'This file is in English. Other languages: {others}.',
} satisfies Record<`llms.${string}`, Message>;
