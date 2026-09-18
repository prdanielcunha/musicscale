import { describe, expect, it } from 'vitest';
import {
  normalizeProPresenterApiUrl,
  ProPresenterHttpClient
} from '../src/ProPresenterHttpClient';

describe('ProPresenterHttpClient', () => {
  it('normalizes local ProPresenter URLs', () => {
    expect(normalizeProPresenterApiUrl('127.0.0.1:50001'))
      .toBe('http://127.0.0.1:50001');
    expect(normalizeProPresenterApiUrl('http://192.168.1.44:50001/'))
      .toBe('http://192.168.1.44:50001');
  });

  it('rejects public internet endpoints', () => {
    expect(() => normalizeProPresenterApiUrl('https://example.com'))
      .toThrow('propresenter_url_must_be_local');
  });

  it('calls the public HTTP API without provider-specific data leaking outside the adapter', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), method: String(init?.method || 'GET') });
      return new Response(JSON.stringify({ version: '21.4' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = new ProPresenterHttpClient({
      baseUrl: 'http://127.0.0.1:50001',
      fetchImpl: fakeFetch
    });

    await client.get('/version');
    expect(calls[0]).toEqual({
      url: 'http://127.0.0.1:50001/version',
      method: 'GET'
    });
  });
});
