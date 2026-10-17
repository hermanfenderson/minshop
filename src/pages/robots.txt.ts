import { withMount } from '../deployment';
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { publicOrigin } from '../features/http/origin';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const origin = publicOrigin(url.origin, env.CANONICAL_ORIGIN);
  // Under a mount this file is not the host's robots.txt (crawlers only read the
  // root one); it still names the store's own paths, for the host site to copy.
  const body = `User-agent: *
Allow: /
Disallow: ${withMount('/admin')}
Disallow: ${withMount('/api/')}
Sitemap: ${origin}${withMount('/sitemap.xml')}
`;
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
