import { describe, expect, it } from 'vitest';
import { isTrustedLiveWebOrigin } from '../src/networkPolicy';

describe('Live Node web origin policy', () => {
  const configured = new Set(['https://preview.example.internal']);

  it('trusts current and future MillionsNest HTTPS subdomains', () => {
    expect(isTrustedLiveWebOrigin('https://musicscale.millionsnest.com', configured)).toBe(true);
    expect(isTrustedLiveWebOrigin('https://live.millionsnest.com', configured)).toBe(true);
    expect(isTrustedLiveWebOrigin('https://live.musicscale.millionsnest.com', configured)).toBe(true);
  });

  it('keeps arbitrary internet origins out', () => {
    expect(isTrustedLiveWebOrigin('https://evil.example', configured)).toBe(false);
    expect(isTrustedLiveWebOrigin('http://live.millionsnest.com', configured)).toBe(false);
  });

  it('allows explicitly configured preview origins and local development', () => {
    expect(isTrustedLiveWebOrigin('https://preview.example.internal', configured)).toBe(true);
    expect(isTrustedLiveWebOrigin('http://localhost:4316', configured)).toBe(true);
  });
});
