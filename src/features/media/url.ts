// Explicit .ts: the D1 integration suite loads this module under plain Node.
import { withMount } from '../../deployment.ts';

/**
 * Public URL for a stored object. The single place that knows how a media key
 * becomes a URL, so products, pages, and branding cannot drift apart.
 *
 * With `baseUrl` set (config.images.baseUrl, from IMAGE_BASE_URL — e.g. an R2
 * custom domain) it returns an absolute URL that bypasses the Worker's /images
 * route; otherwise the mount-relative `/images/...` path (`/shop/images/...`).
 */
export function mediaUrl(imageKey: string, baseUrl = ''): string {
  return baseUrl ? `${baseUrl}/${imageKey}` : withMount(`/images/${imageKey}`);
}
