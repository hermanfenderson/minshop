/**
 * The secret part of the fulfiller's webhook URL (Printful does not sign its
 * calls): derived from AUTH_SECRET, so nothing new is stored and every instance
 * has its own. A forged call could only make the shop read an order back.
 */
export async function fulfillmentWebhookKey(authSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(authSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('minshop:fulfillment-webhook')));
  return [...mac.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
