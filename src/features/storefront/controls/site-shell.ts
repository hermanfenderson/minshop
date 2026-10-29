/**
 * The site shell for the `site-shell` theme: the website's menu, footer, logo
 * and brand tokens, read at build time from the file named by SITE_SHELL
 * (scripts/site-shell.mjs, docs/SITE_SHELL.md).
 *
 * Pure: no bindings, no request state. Templates call `siteShell(i18n.locale)`
 * and get every text in that language, every link ready to render.
 */
import source from '#site-shell';

/** A text, or one text per language code ({ "en": "Shop", "it": "Negozio" }). */
export type ShellText = string | Readonly<Record<string, string>>;

export interface ShellLinkSource {
  label: ShellText;
  /** Root-relative or absolute. Omitted for a plain line (an address) or a group. */
  href?: ShellText;
  /** Stable key; `shopNav` names the item that is current inside the store. */
  id?: string;
  children?: readonly ShellLinkSource[];
}

export const SHELL_COLORS = [
  'ink', 'muted', 'faint', 'line', 'paper', 'surface',
  'brand', 'brandHover', 'onBrand', 'accent',
  'header', 'onHeader', 'headerLine', 'navAccent',
  'footer', 'onFooter', 'footerMuted', 'badge', 'onBadge', 'bannerLink',
] as const;
export type ShellColor = (typeof SHELL_COLORS)[number];

export interface SiteShellSource {
  version: 1;
  name: string;
  /** Prefix for root-relative links when the store runs on another host. */
  origin?: string;
  home?: ShellText;
  logo?: { src: string; alt?: ShellText; width?: number; height?: number; text?: ShellText; tagline?: ShellText };
  /** The website's site icon, so the store shows the same one (PNG files). */
  icons?: { png32?: string; png192?: string; appleTouch?: string };
  fonts?: {
    /** https stylesheet (e.g. Google Fonts). */
    stylesheet?: string;
    /** @font-face rules with absolute URLs. */
    faces?: string;
    /** CSS font-family of running text (Minshop's --font-sans). */
    body?: string;
    /** CSS font-family of headings and the store name (Minshop's --font-serif). */
    heading?: string;
    /** CSS font-family of product descriptions and content pages. Default: body. */
    prose?: string;
  };
  colors?: Partial<Record<ShellColor, string>>;
  /** "dark" when `paper` is dark: native controls (select menus, date pickers,
   *  scrollbars) are then drawn dark too, instead of light with light text. */
  scheme?: 'light' | 'dark';
  /** Product photos in cards and on the product page: "3/4" + "contain" for
   *  book covers (never cropped), the default "1/1" + "cover" for products. */
  products?: { aspect?: string; fit?: 'cover' | 'contain' };
  nav: readonly ShellLinkSource[];
  shopNav?: string;
  cart?: { label?: ShellText };
  /** A line above the header; `[label](href)` becomes a link. */
  banner?: { text: ShellText } | null;
  footer?: {
    /** Plain text; `[label](href)` becomes a link. */
    about?: ShellText;
    columns?: readonly { title: ShellText; links: readonly ShellLinkSource[] }[];
    legal?: ShellText;
    links?: readonly ShellLinkSource[];
  };
}

export interface ShellLink {
  label: string;
  href: string | null;
  external: boolean;
  current: boolean;
  children: ShellLink[];
}
export type ShellSegment = { text: string; href: string | null };

export interface SiteShell {
  name: string;
  homeHref: string;
  logo: { src: string; alt: string; width?: number; height?: number; text: string | null; tagline: string | null } | null;
  /** Null: the store's own favicon. */
  icons: { png32: string | null; png192: string | null; appleTouch: string | null } | null;
  nav: ShellLink[];
  cartLabel: string | null;
  banner: ShellSegment[] | null;
  footer: {
    about: ShellSegment[];
    columns: { title: string; links: ShellLink[] }[];
    legal: string | null;
    links: ShellLink[];
  } | null;
  /** Font links and the :root custom properties, for the header to emit. */
  head: { stylesheet: string | null; css: string };
}

const shell = source as SiteShellSource;

const pick = (text: ShellText | undefined, locale: string): string | null => {
  if (text == null) return null;
  if (typeof text === 'string') return text;
  return text[locale] ?? text[locale.split('-')[0]] ?? Object.values(text)[0] ?? null;
};

const isExternal = (href: string) => /^https?:\/\//.test(href) && !(shell.origin && href.startsWith(shell.origin));
const absolute = (href: string) =>
  shell.origin && href.startsWith('/') && !href.startsWith('//') ? `${shell.origin.replace(/\/+$/, '')}${href}` : href;

function link(item: ShellLinkSource, locale: string): ShellLink {
  const href = pick(item.href, locale);
  return {
    label: pick(item.label, locale) ?? '',
    href: href ? absolute(href) : null,
    external: href ? isExternal(href) : false,
    current: Boolean(item.id && item.id === shell.shopNav),
    children: (item.children ?? []).map((child) => link(child, locale)),
  };
}

/** `[label](href)` → link segments; everything else is text. */
function segments(text: string | null): ShellSegment[] {
  if (!text) return [];
  const out: ShellSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), href: null });
    out.push({ text: m[1], href: absolute(m[2]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), href: null });
  return out;
}

// Values land in a <style> element: colors and families are held to a narrow
// alphabet, so a stray quote or brace in the JSON cannot break out of the rule.
const SAFE_COLOR = /^[#a-z0-9(),.%\s/-]+$/i;
const SAFE_FAMILY = /^[a-z0-9 ,'"-]+$/i;
const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function headCss(): string {
  const vars: string[] = [];
  for (const key of SHELL_COLORS) {
    const value = shell.colors?.[key];
    if (value && SAFE_COLOR.test(value)) vars.push(`--shell-${kebab(key)}:${value}`);
  }
  const { body, heading, prose } = shell.fonts ?? {};
  if (prose && SAFE_FAMILY.test(prose)) vars.push(`--shell-prose:${prose}`);
  if (body && SAFE_FAMILY.test(body)) vars.push(`--shell-body:${body}`);
  if (heading && SAFE_FAMILY.test(heading)) vars.push(`--shell-heading:${heading}`);
  const aspect = shell.products?.aspect;
  if (aspect && /^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(aspect)) vars.push(`--shell-card-aspect:${aspect}`);
  if (shell.products?.fit === 'contain' || shell.products?.fit === 'cover') vars.push(`--shell-card-fit:${shell.products.fit}`);
  if (shell.scheme === 'dark' || shell.scheme === 'light') vars.push(`color-scheme:${shell.scheme}`);
  const faces = (shell.fonts?.faces ?? '').replace(/<\/?style/gi, '');
  return `${faces}:root{${vars.join(';')}}`;
}

const cache = new Map<string, SiteShell>();

export function siteShell(locale: string): SiteShell {
  const hit = cache.get(locale);
  if (hit) return hit;
  const footer = shell.footer;
  const stylesheet = shell.fonts?.stylesheet;
  const resolved: SiteShell = {
    name: shell.name,
    homeHref: absolute(pick(shell.home, locale) ?? '/'),
    logo: shell.logo
      ? {
          src: absolute(shell.logo.src),
          alt: pick(shell.logo.alt, locale) ?? shell.name,
          width: shell.logo.width,
          height: shell.logo.height,
          text: pick(shell.logo.text, locale),
          tagline: pick(shell.logo.tagline, locale),
        }
      : null,
    icons: shell.icons
      ? {
          png32: shell.icons.png32 ? absolute(shell.icons.png32) : null,
          png192: shell.icons.png192 ? absolute(shell.icons.png192) : null,
          appleTouch: shell.icons.appleTouch ? absolute(shell.icons.appleTouch) : null,
        }
      : null,
    nav: shell.nav.map((item) => link(item, locale)),
    cartLabel: pick(shell.cart?.label, locale),
    banner: shell.banner ? segments(pick(shell.banner.text, locale)) : null,
    footer: footer
      ? {
          about: segments(pick(footer.about, locale)),
          columns: (footer.columns ?? []).map((c) => ({ title: pick(c.title, locale) ?? '', links: c.links.map((l) => link(l, locale)) })),
          legal: pick(footer.legal, locale),
          links: (footer.links ?? []).map((l) => link(l, locale)),
        }
      : null,
    head: { stylesheet: stylesheet && /^https:\/\//.test(stylesheet) ? stylesheet : null, css: headCss() },
  };
  cache.set(locale, resolved);
  return resolved;
}
