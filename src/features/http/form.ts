/**
 * Read a request body as a form, treating a body that isn't a form as an EMPTY
 * form. `Request.formData()` throws a TypeError when the Content-Type header is
 * missing or isn't a form type, which surfaced as a 500 for a bare POST (a
 * crawler, a client that drops the header). Every caller already handles a
 * form with no fields — it redirects back to the cart or the product — so an
 * empty form is the honest reading of "no form was sent".
 */
const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data'];

export async function readForm(request: Request): Promise<FormData> {
  const type = request.headers.get('content-type')?.toLowerCase() ?? '';
  if (!FORM_TYPES.some((t) => type.includes(t))) return new FormData();
  return request.formData();
}
