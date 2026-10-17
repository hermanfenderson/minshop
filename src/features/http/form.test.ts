import { describe, expect, it } from 'vitest';
import { readForm } from './form';

const post = (body: BodyInit | null, type?: string) =>
  new Request('https://shop.example/api/cart', {
    method: 'POST',
    body,
    headers: type ? { 'content-type': type } : {},
  });

describe('readForm', () => {
  it('reads urlencoded and multipart forms', async () => {
    expect((await readForm(post('a=1&b=2', 'application/x-www-form-urlencoded'))).get('b')).toBe('2');
    const multipart = new FormData();
    multipart.set('a', '1');
    expect((await readForm(new Request('https://shop.example/x', { method: 'POST', body: multipart }))).get('a')).toBe('1');
  });

  it('treats a bare POST, or a non-form body, as an empty form instead of throwing', async () => {
    expect([...(await readForm(post(null))).keys()]).toEqual([]);
    expect([...(await readForm(post('{"a":1}', 'application/json'))).keys()]).toEqual([]);
  });
});
