/**
 * Instance-wide search-engine exclusion. A test or staging instance shares the
 * production build (same mount, same code), so this is deployment policy read
 * from the NOINDEX Worker var, not a build-time or Admin setting: a database
 * copied between instances can never carry it into production by accident.
 */
export function instanceNoindex(value: string | undefined): boolean {
  if (value === undefined) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/** Header value sent on every response of a noindex instance. */
export const NOINDEX_ROBOTS_TAG = 'noindex, nofollow';
