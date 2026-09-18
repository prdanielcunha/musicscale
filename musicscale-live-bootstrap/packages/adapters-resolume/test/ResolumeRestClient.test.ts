import { describe, expect, it } from 'vitest';
import {
  normalizeResolumeApiUrl,
  ResolumeRestClient
} from '../src/ResolumeRestClient';

describe('ResolumeRestClient', () => {
  it('normalizes local Webserver URLs to /api/v1', () => {
    expect(normalizeResolumeApiUrl('127.0.0.1:8080'))
      .toBe('http://127.0.0.1:8080/api/v1');
    expect(normalizeResolumeApiUrl('http://192.168.1.40:8080/api/v1'))
      .toBe('http://192.168.1.40:8080/api/v1');
  });

  it('rejects public internet endpoints', () => {
    expect(() => normalizeResolumeApiUrl('https://example.com'))
      .toThrow('resolume_url_must_be_local');
  });

  it('calls the official API path under /api/v1', async () => {
    const calls: string[] = [];
    const fakeFetch: typeof fetch = async input => {
      calls.push(String(input));
      return new Response(JSON.stringify({ name: 'Arena', version: '7' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = new ResolumeRestClient({
      baseUrl: 'http://127.0.0.1:8080',
      fetchImpl: fakeFetch
    });

    await client.get('/product');
    expect(calls[0]).toBe('http://127.0.0.1:8080/api/v1/product');
  });
});
