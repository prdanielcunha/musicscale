import { describe, expect, it } from 'vitest';
import {
  getMusicScaleCorsAllowlist,
  isMusicScaleRequestOriginAllowed,
} from '../../services/server/corsOriginPolicy';

describe('MusicScale CORS origin gate', () => {
  it('allows requests without Origin, including server-to-server requests', () => {
    expect(isMusicScaleRequestOriginAllowed({ host: 'musicscale.millionsnest.com' })).toBe(true);
  });

  it('allows the explicit MillionsNest cross-origin allowlist', () => {
    for (const origin of getMusicScaleCorsAllowlist()) {
      expect(isMusicScaleRequestOriginAllowed({
        origin,
        host: 'musicscale.millionsnest.com',
      })).toBe(true);
    }
  });

  it('allows same-origin Vercel previews without wildcarding every vercel.app site', () => {
    expect(isMusicScaleRequestOriginAllowed({
      origin: 'https://musicscale-preview-abc.vercel.app',
      forwardedHost: 'musicscale-preview-abc.vercel.app',
      host: 'fallback.example.com',
    })).toBe(true);

    expect(isMusicScaleRequestOriginAllowed({
      origin: 'https://attacker.vercel.app',
      forwardedHost: 'musicscale-preview-abc.vercel.app',
    })).toBe(false);
  });

  it('rejects arbitrary, lookalike, malformed, and credential-bearing origins', () => {
    const blocked = [
      'https://evil.example',
      'https://musicscale.millionsnest.com.evil.example',
      'https://evil.example/musicscale.millionsnest.com',
      'https://user:pass@musicscale.millionsnest.com',
      'javascript:alert(1)',
      'not-a-url',
    ];

    for (const origin of blocked) {
      expect(isMusicScaleRequestOriginAllowed({
        origin,
        host: 'musicscale.millionsnest.com',
      })).toBe(false);
    }
  });

  it('requires an exact host match for same-origin requests', () => {
    expect(isMusicScaleRequestOriginAllowed({
      origin: 'https://localhost.evil.example',
      host: 'localhost:5173',
    })).toBe(false);

    expect(isMusicScaleRequestOriginAllowed({
      origin: 'http://localhost:5173',
      host: 'localhost:5173',
    })).toBe(true);
  });
});
