import type { APIRoute } from 'astro';
import { llmsResponse } from '../features/storefront/llms';

export const prerender = false;

// /llms.txt in the default language. Other languages (/it/llms.txt) are served
// by the middleware calling the same builder: see LOCALIZED_FILES there.
export const GET: APIRoute = (context) => llmsResponse(context);
