/**
 * The site shell: the header, footer, menu and brand tokens of the website a
 * store lives in, published by that website as one JSON file (docs/SITE_SHELL.md).
 *
 * The `site-shell` theme renders it, so the website and the store share ONE
 * configuration: a menu entry changed on the site reaches the store at its next
 * build. Selection is BUILD TIME, like the theme: the file is read here and
 * bundled through the `#site-shell` alias; a request never fetches it.
 *
 *   SITE_SHELL=<path>       a file on disk (relative to the repo root or absolute)
 *   SITE_SHELL=<https URL>  fetched once per build, e.g. https://example.com/shell.json
 *   unset                   the neutral example; refused when deploying the
 *                           site-shell theme (scripts/deploy-instance.sh)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const SITE_SHELL_EXAMPLE = 'src/features/storefront/site-shell.example.json';
const FETCHED = '.astro/site-shell.json';

/** Structural check, deliberately small: what the theme cannot render without. */
export function validateSiteShell(shell, source) {
  const fail = (why) => {
    throw new Error(`SITE_SHELL (${source}): ${why}. See docs/SITE_SHELL.md.`);
  };
  if (!shell || typeof shell !== 'object') fail('not a JSON object');
  if (shell.version !== 1) fail(`unsupported "version" ${JSON.stringify(shell.version)} (expected 1)`);
  if (!shell.name) fail('missing "name"');
  if (!Array.isArray(shell.nav)) fail('"nav" must be an array');
  for (const item of shell.nav) {
    if (!item?.label || !(item.href || Array.isArray(item.children))) fail('every nav item needs "label" and "href" or "children"');
  }
  return shell;
}

/**
 * Resolves SITE_SHELL to a validated JSON file on disk and returns its absolute
 * path, for the alias. A URL is fetched and cached under .astro/.
 */
export async function resolveSiteShell(env = process.env, root = process.cwd()) {
  const spec = env.SITE_SHELL?.trim();
  if (!spec) return { path: resolve(root, SITE_SHELL_EXAMPLE), source: 'example' };
  if (/^https?:\/\//.test(spec)) {
    const res = await fetch(spec, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`SITE_SHELL: GET ${spec} → HTTP ${res.status}`);
    const shell = validateSiteShell(await res.json(), spec);
    const path = resolve(root, FETCHED);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(shell, null, 2)}\n`);
    return { path, source: spec };
  }
  const path = resolve(root, spec);
  if (!existsSync(path)) throw new Error(`SITE_SHELL: ${path} does not exist`);
  validateSiteShell(JSON.parse(readFileSync(path, 'utf8')), path);
  return { path, source: path };
}
