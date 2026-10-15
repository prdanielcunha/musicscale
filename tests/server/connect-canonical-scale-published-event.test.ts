import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { publishCanonicalScaleEventToConnect, type MusicScalePublishedSnapshot } from '../../services/server/connect/canonicalScalePublishedEvent.js';

const now = Date.parse('2026-10-15T20:00:00.000Z');
const signingSecret = 'synthetic-musicscale-source-key-over-32-chars';
const snapshot: MusicScalePublishedSnapshot = {
  organizationId: 'org-a',
  status: 'published',
  publishRevision: 7,
  updatedAt: new Date(now - 1000),
};
function options(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    organizationId: 'org-a',
    musicScaleId: 'music-scale-1',
    publishRevision: 7,
    signingSecret,
    targetsJson: JSON.stringify({
      'org-a': { conversationId: 'canonical-connect-thread', recipientUid: 'real-operator' },
    }),
    loadCanonicalScale: vi.fn(async () => snapshot),
    now: () => now,
    fetchImpl: vi.fn(async () => new Response(JSON.stringify({ accepted: true, duplicate: false }), { status: 202 })),
    ...overrides,
  };
}

describe('MusicScale official canonical published event bridge', () => {
  it('is completely off without the explicit production flag', async () => {
    const input = options({ enabled: false });
    expect(await publishCanonicalScaleEventToConnect(input)).toBe('disabled');
    expect(input.fetchImpl).not.toHaveBeenCalled();
    expect(input.loadCanonicalScale).not.toHaveBeenCalled();
  });

  it('fails closed without both source key and server-owned authorized mapping', async () => {
    for (const overrides of [
      { signingSecret: undefined },
      { signingSecret: 'too-short' },
      { targetsJson: undefined },
      { targetsJson: '{}' },
      { targetsJson: '{"org-a":{"recipientUid":"member","conversationId":"../bad"}}' },
      { targetsJson: '{"org-b":{"recipientUid":"operator","conversationId":"thread"}}' },
      { targetsJson: '{"org-a":{"recipientUid":"operator","conversationId":"thread","phone":"private"}}' },
    ]) {
      const input = options(overrides);
      expect(await publishCanonicalScaleEventToConnect(input)).toBe('not_configured');
      expect(input.fetchImpl).not.toHaveBeenCalled();
      expect(input.loadCanonicalScale).not.toHaveBeenCalled();
    }
  });

  it('rejects a noncanonical tenant, unpublished scale, stale revision or time', async () => {
    for (const overrides of [
      { organizationId: 'org-b' }, { status: 'draft' },
      { publishRevision: 8 }, { updatedAt: new Date(now - 8 * 86400000) },
      { updatedAt: new Date(now + 40000) },
    ]) {
      const input = options({ loadCanonicalScale: async () => ({ ...snapshot, ...overrides }) });
      expect(await publishCanonicalScaleEventToConnect(input)).toBe('stale_revision');
      expect(input.fetchImpl).not.toHaveBeenCalled();
    }
    await expect(publishCanonicalScaleEventToConnect(options({ organizationId: 'org-b/evil' })))
      .rejects.toThrow('CONNECT_SCALE_EVENT_INVALID_CANONICAL_INPUT');
  });

  it('sends the exact signed, minimal event for verified scale and stable revision', async () => {
    const calls: Array<{ body: string; timestamp: string }> = [];
    const input = options({ fetchImpl: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe('https://connect.millionsnest.com/api/core/automations/events/musicscale');
      expect(init?.method).toBe('POST');
      expect(init?.redirect).toBe('error');
      const headers = init?.headers as Record<string, string>;
      const raw = String(init?.body);
      const expected = createHmac('sha256', signingSecret)
        .update('musicscale\n' + headers['x-connect-timestamp'] + '\n' + raw).digest('hex');
      expect(headers['x-connect-signature']).toBe(expected);
      const event = JSON.parse(raw);
      expect(Object.keys(event).sort()).toEqual([
        'conversationId','eventId','occurredAt','organizationId',
        'recipientUid','schemaVersion','sourceApp','trigger',
      ].sort());
      expect(event).toMatchObject({
        schemaVersion: 1, sourceApp: 'musicscale', trigger: 'scale.published',
        organizationId: 'org-a', conversationId: 'canonical-connect-thread',
        recipientUid: 'real-operator', occurredAt: snapshot.updatedAt.toISOString(),
      });
      expect(JSON.stringify(event)).not.toContain('phone');
      expect(JSON.stringify(event)).not.toContain('songIds');
      calls.push({ body: raw, timestamp: headers['x-connect-timestamp'] });
      return new Response(JSON.stringify({ accepted: true, duplicate: calls.length > 1 }), { status: 202 });
    }) as typeof fetch });
    expect(await publishCanonicalScaleEventToConnect(input)).toBe('accepted');
    expect(await publishCanonicalScaleEventToConnect(input)).toBe('duplicate');
    expect(calls).toHaveLength(2);
    expect(calls[0].body).toBe(calls[1].body);
    expect(calls[0].timestamp).toBe(calls[1].timestamp);
  });

  it('never retries an ambiguous network or failed upstream response', async () => {
    const lost = vi.fn(async () => { throw new Error('synthetic network timeout'); });
    await expect(publishCanonicalScaleEventToConnect(options({ fetchImpl: lost as typeof fetch })))
      .rejects.toThrow('CONNECT_SCALE_EVENT_TRANSPORT_UNCERTAIN');
    expect(lost).toHaveBeenCalledTimes(1);
    const rejected = vi.fn(async () => new Response('{}', { status: 503 }));
    await expect(publishCanonicalScaleEventToConnect(options({ fetchImpl: rejected as typeof fetch })))
      .rejects.toThrow('CONNECT_SCALE_EVENT_NOT_ACCEPTED');
    expect(rejected).toHaveBeenCalledTimes(1);
  });
});
