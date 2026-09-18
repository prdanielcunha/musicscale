import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HolyricsHttpClient } from '../src/HolyricsHttpClient';

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('HolyricsHttpClient', () => {
  it('uses Holyrics hash authentication without putting the access token in URLs', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const token = 'super-secret-token';

    const fakeFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const body = String(init?.body || '');
      calls.push({ url, body });

      if (url.endsWith('/api/Auth')) {
        return jsonResponse({ status: 'ok', data: { sid: 'sid-1', nonce: 'nonce-1' } });
      }
      if (url.includes('/api/Auth?')) {
        return jsonResponse({ status: 'ok' });
      }
      if (url.includes('/api/SearchLyrics?')) {
        return jsonResponse({ status: 'ok', data: [{ id: '1', title: 'Song' }] });
      }
      return jsonResponse({ status: 'error', error: 'unexpected' });
    };

    const client = new HolyricsHttpClient({
      baseUrl: 'http://127.0.0.1:8091',
      token,
      fetchImpl: fakeFetch
    });

    const result = await client.request<Array<{ id: string }>>('SearchLyrics', { text: 'Song' });
    expect(result[0]?.id).toBe('1');
    expect(calls.every(call => !call.url.includes(token))).toBe(true);

    const actionCall = calls.find(call => call.url.includes('/api/SearchLyrics?'));
    expect(actionCall).toBeTruthy();

    const body = JSON.stringify({ text: 'Song' });
    const expected = createHash('sha256')
      .update(`nonce-1:1:${token}:${body}`)
      .digest('hex');
    expect(actionCall?.url).toContain(`rid=1&dtoken=${expected}`);
  });
  it('serializes concurrent requests so signed request ids remain monotonic', async () => {
    const actionRids: number[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.endsWith('/api/Auth')) {
        return jsonResponse({ status: 'ok', data: { sid: 'sid-2', nonce: 'nonce-2' } });
      }
      if (url.includes('/api/Auth?')) {
        return jsonResponse({ status: 'ok' });
      }
      const rid = Number(new URL(url).searchParams.get('rid'));
      actionRids.push(rid);
      await new Promise(resolve => setTimeout(resolve, rid === 1 ? 10 : 0));
      return jsonResponse({ status: 'ok', data: { rid } });
    };

    const client = new HolyricsHttpClient({
      token: 'secret',
      fetchImpl: fakeFetch
    });

    await Promise.all([
      client.request('GetCurrentPresentation'),
      client.request('GetTokenInfo'),
      client.request('SearchLyrics', { text: 'x' })
    ]);

    expect(actionRids).toEqual([1, 2, 3]);
  });
});
