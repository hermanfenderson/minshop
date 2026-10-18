import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { mountedRedirect } from '../../../features/i18n/urls';
import { languageSettings } from '../../../features/i18n/settings';
import { readForm } from '../../../features/http/form';
import { parsePublicId } from '../../../features/ids/publicId';
import { getConfig } from '../../../config';
import { getProductByPublicId, listProductImages } from '../../../features/products/db';
import { listVariants, listExtras } from '../../../features/products/variants';
import { getCategoryByPublicId } from '../../../features/categories/db';
import { getPageByPublicId } from '../../../features/pages/db';
import { pageTranslationMediaStatements } from '../../../features/pages/save';
import { menuItemIdsByPublicId } from '../../../features/navigation/db';
import { getStoreSettings, setSetting } from '../../../features/settings/db';
import { saveTranslationStatement, translatableLocales } from '../../../features/translations/db';
import { parseTranslationForm } from '../../../features/translations/form';
import type { TranslatableEntity } from '../../../features/translations/content';
import { translationPurgeTags } from '../../../features/translations/cache';
import { purgeCacheTags } from '../../../features/cache/purge';

export const prerender = false;

const rowsById = <T extends { id: number; public_id: string | null }>(rows: T[]) =>
  new Map(rows.filter((r) => r.public_id).map((r) => [r.public_id!, r.id]));

/** Same rule as the source announcement link: a same-site path or http(s). */
const safeHref = (href: string) =>
  !href || (href.startsWith('/') && !href.startsWith('//')) || /^https?:\/\//i.test(href);

/**
 * POST /api/admin/translations — save one language of one editor's content.
 *
 * `scope` names the editor (product, category, page, menu, announcement) and
 * `id` its public ID. Only that editor's rows are resolved, so a crafted form
 * cannot reach another entity; only translation tables (and the announcement's
 * per-language settings rows) are written, so the main rows — prices, stock,
 * SKUs, slugs, status — stay exactly as they were. Admin-only via the gate.
 */
export const POST: APIRoute = async ({ request, redirect: astroRedirect, locals }) => {
  const redirect = mountedRedirect(astroRedirect);
  const form = await readForm(request);
  const scope = String(form.get('scope') ?? '');
  const locale = String(form.get('locale') ?? '');

  // Back to the editor the form came from (admin paths only), at its section.
  const returnTo = String(form.get('return') ?? '');
  const base = /^\/admin(\/[\w\-/]*)?$/.test(returnTo) ? returnTo : '/admin';
  const back = (query: string) => redirect(`${base}?${query}#translations`, 303);

  // Admin API routes do not get the settings overlay from middleware.
  const languages = languageSettings(locals.settings ?? (await getStoreSettings(env.DB)));
  if (!translatableLocales(languages).includes(locale)) {
    return back(`translation_error=${encodeURIComponent('That language is not enabled for translation.')}`);
  }

  let allowed: Partial<Record<TranslatableEntity, Map<string, number>>> = {};
  let purge: string[] = [];
  let pageScope: Awaited<ReturnType<typeof getPageByPublicId>> = null;

  switch (scope) {
    case 'product': {
      const publicId = parsePublicId(form.get('id'), 'product');
      const product = publicId ? await getProductByPublicId(env.DB, publicId) : null;
      if (!product) return new Response('Not found', { status: 404 });
      const [variants, extras, images] = await Promise.all([
        listVariants(env.DB, product.id, true),
        listExtras(env.DB, product.id, true),
        listProductImages(env.DB, product.id),
      ]);
      allowed = {
        product: rowsById([product]),
        variant: rowsById(variants),
        extra: rowsById(extras),
        image: rowsById(images),
      };
      purge = translationPurgeTags('product', publicId);
      break;
    }
    case 'category': {
      const publicId = parsePublicId(form.get('id'), 'category');
      const category = publicId ? await getCategoryByPublicId(env.DB, publicId) : null;
      if (!category) return new Response('Not found', { status: 404 });
      allowed = { category: rowsById([category]) };
      purge = translationPurgeTags('category', publicId);
      break;
    }
    case 'page': {
      const publicId = parsePublicId(form.get('id'), 'page');
      pageScope = publicId ? await getPageByPublicId(env.DB, publicId) : null;
      if (!pageScope) return new Response('Not found', { status: 404 });
      allowed = { page: rowsById([pageScope]) };
      purge = translationPurgeTags('page', publicId);
      break;
    }
    case 'menu': {
      const [header, footer] = await Promise.all([
        menuItemIdsByPublicId(env.DB, 'header'),
        menuItemIdsByPublicId(env.DB, 'footer'),
      ]);
      allowed = { menuItem: new Map([...header, ...footer]) };
      purge = translationPurgeTags('menu', null);
      break;
    }
    case 'announcement': {
      const text = String(form.get('announcement') ?? '').trim();
      const href = String(form.get('announcement_href') ?? '').trim();
      if (text.length > 200) return back(`translation_error=${encodeURIComponent('The announcement is longer than 200 characters.')}`);
      if (!safeHref(href)) {
        return back(`translation_error=${encodeURIComponent('The announcement link must be a path like /sale or an http(s) URL.')}`);
      }
      // Blank deletes the row: that language falls back to the source text.
      await setSetting(env.DB, `announcement:${locale}`, text);
      await setSetting(env.DB, `announcement_href:${locale}`, href);
      await purgeCacheTags(translationPurgeTags('announcement', null));
      return back(`translated=${locale}`);
    }
    default:
      return new Response('Unknown translation scope', { status: 400 });
  }

  const { writes, errors } = parseTranslationForm(form, allowed);
  if (errors.length > 0) return back(`translation_error=${encodeURIComponent(errors.join(' '))}`);

  const statements = writes.map((w) => saveTranslationStatement(env.DB, w.entity, w.id, locale, w.fields));
  let warning = '';
  if (pageScope) {
    // A translated body uses media too: rebuild the page's claims from every
    // body in the same batch as the write, as a source save does.
    const body = writes.find((w) => w.entity === 'page')?.fields as { body_markdown?: string | null } | undefined;
    const media = await pageTranslationMediaStatements(env.DB, pageScope, locale, body?.body_markdown ?? null, {
      baseUrl: getConfig().images.baseUrl,
    });
    statements.push(...media.statements);
    if (media.unresolved.length > 0) {
      warning = `Saved, but ${media.unresolved.length} image(s) in this translation are missing from the media library.`;
    }
  }
  if (statements.length > 0) await env.DB.batch(statements);
  // Tags cover every language's URL of the affected pages at once.
  await purgeCacheTags(purge);
  return back(`translated=${locale}${warning ? `&translation_error=${encodeURIComponent(warning)}` : ''}`);
};
