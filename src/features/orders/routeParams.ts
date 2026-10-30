/**
 * The order routes' parameters, read from the request path when Astro hands
 * none over. A language-prefixed request ('/it/order/…') reaches its route
 * through the middleware's rewrite, and Astro gives an endpoint (unlike a
 * page) empty params on a rewrite: the receipt, download and status links of
 * an Italian order page all answered «not found». The path still carries
 * them, after the mount and the language.
 */
export function orderRouteParams(
  params: Record<string, string | undefined>,
  pathname: string,
): { token?: string; sub?: string } {
  if (params.token) return { token: params.token, sub: params.receiptPublicId ?? params.itemPublicId };
  const m = /\/order\/([^/]+)(?:\/(?:receipt|download)\/([^/]+)|\/status)?\/?$/.exec(pathname);
  return { token: m?.[1] ? decodeURIComponent(m[1]) : undefined, sub: m?.[2] ? decodeURIComponent(m[2]) : undefined };
}
