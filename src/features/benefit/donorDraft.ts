import type { AstroCookies } from 'astro';
import { cookieName } from '../../deployment';
import { DONOR_FIELDS } from './donor';

/**
 * What the supporter last typed in the donor form, so a refused checkout (a
 * mistyped tax code) or a return from the payment page never makes them type
 * it all again. httpOnly and short-lived: it is their own data, in their own
 * browser, never in a URL.
 */
const COOKIE = cookieName('donor');
const NAMES: string[] = Object.values(DONOR_FIELDS);

export type DonorDraft = Partial<Record<string, string>>;

export function readDonorDraft(cookies: AstroCookies): DonorDraft {
  try {
    const value = cookies.get(COOKIE)?.json() as unknown;
    if (!value || typeof value !== 'object') return {};
    const out: DonorDraft = {};
    for (const name of NAMES) {
      const v = (value as Record<string, unknown>)[name];
      if (typeof v === 'string') out[name] = v.slice(0, 200);
    }
    return out;
  } catch {
    return {};
  }
}

export function writeDonorDraft(cookies: AstroCookies, get: (name: string) => unknown, secure: boolean): void {
  const draft: DonorDraft = {};
  for (const name of NAMES) {
    const v = get(name);
    if (typeof v === 'string' && v.trim()) draft[name] = v.trim().slice(0, 200);
  }
  cookies.set(COOKIE, draft, { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: 60 * 60 * 24 });
}
