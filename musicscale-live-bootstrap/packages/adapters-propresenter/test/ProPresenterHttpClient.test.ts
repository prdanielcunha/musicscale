import { describe, expect, it } from 'vitest';
import {
  normalizeProPresenterApiUrl,
  ProPresenterHttpClient
} from '../src/ProPresenterHttpClient';

describe('ProPresenterHttpClient', () => {
  it('uses the exact local Network API address supplied by setup', () => {
    expect(normalizeProPresenterApiUrl('192.168.1.40:1025'))
      .toBe('http://192.168.1.40:1025');
    expect(normalizeProPresenterApiUrl('http://127.0.0.1:54321/'))
      .toBe('http://127.0.0.1:54321');
  });

  it('requires a configured address rather than inventing a port', () => {
    expect(() => normalizeProPresenterApiUrl(''))
      .toThrow('propresenter_url_required');
  });

  it('rejects public internet endpoints', () => {
    expect(() => normalizeProPresenterApiUrl('https://example.com'))
      .toThrow('propresenter_url_must_be_local');
  });

  it('keeps /version at the API root', async () => {
    const calls: Array<{ url: string; method: string }> = [];
    const fakeFetch: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), method: String(init?.method || 'GET') });
      return new Response(JSON.stringify({
        name: 'Main sanctuary ProPresenter',
        platform: 'win',
        api_version: 'v1'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const client = new ProPresenterHttpClient({
      baseUrl: 'http://127.0.0.1:1025',
      fetchImpl: fakeFetch
    });

    await client.get('/version');
    expect(calls[0]).toEqual({
      url: 'http://127.0.0.1:1025/version',
      method: 'GET'
    });
  });

  it('reads only the initial JSON object from a chunked status stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(
          JSON.stringify({ current: { text: 'Now' }, next: { text: 'Next' } }) +
          '\r\n\r\n'
        ));
        controller.enqueue(encoder.encode(
          JSON.stringify({ current: { text: 'Later' } }) + '\r\n\r\n'
        ));
      }
    });

    const fakeFetch: typeof fetch = async () => new Response(stream, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

    const client = new ProPresenterHttpClient({
      baseUrl: 'http://127.0.0.1:1025',
      fetchImpl: fakeFetch
    });

    const first = await client.getInitial<any>('/v1/status/slide');
    expect(first.current.text).toBe('Now');
    expect(first.next.text).toBe('Next');
  });

  it('JSON-encodes stage message string bodies', async () => {
    let body: BodyInit | null | undefined;
    const fakeFetch: typeof fetch = async (_input, init) => {
      body = init?.body;
      return new Response(null, { status: 204 });
    };

    const client = new ProPresenterHttpClient({
      baseUrl: 'http://127.0.0.1:1025',
      fetchImpl: fakeFetch
    });

    await client.put('/v1/stage/message', 'Go to bridge');
    expect(body).toBe(JSON.stringify('Go to bridge'));
  });
});
