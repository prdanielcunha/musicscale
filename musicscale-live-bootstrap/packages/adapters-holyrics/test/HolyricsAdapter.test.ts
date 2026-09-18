import { describe, expect, it } from 'vitest';
import type { LiveCommand } from '@musicscale-live/domain';
import { HolyricsAdapter } from '../src/HolyricsAdapter';
import type { HolyricsApi } from '../src/HolyricsHttpClient';

class FakeApi implements HolyricsApi {
  calls: Array<{ action: string; input: Record<string, unknown> }> = [];

  async request<T>(action: string, input: Record<string, unknown> = {}): Promise<T> {
    this.calls.push({ action, input });
    if (action === 'GetTokenInfo') {
      return {
        version: '2.30.0',
        permissions: [
          'GetCurrentPresentation',
          'ActionNext',
          'ActionPrevious',
          'ActionGoToIndex',
          'CloseCurrentPresentation',
          'IdentifyVerseReferences',
          'ShowVerse',
          'SearchLyrics',
          'ShowLyrics',
          'AddLyricsToPlaylist',
          'SetTextCommunicationPanel'
        ].join(',')
      } as T;
    }
    if (action === 'GetCurrentPresentation') {
      return { id: 'p1', type: 'song', slide_number: 2, total_slides: 5 } as T;
    }
    return undefined as T;
  }
}

function command(capability: LiveCommand['capability'], payload: Record<string, unknown>): LiveCommand {
  return {
    id: 'cmd-1',
    correlationId: 'corr-1',
    organizationId: 'org-1',
    venueId: 'venue-1',
    liveSystemId: 'system-1',
    liveSessionId: 'session-1',
    actorId: 'user-1',
    origin: 'live-ui',
    capability,
    targetProviderIds: ['holyrics-1'],
    outputTargets: ['main'],
    payload,
    idempotencyKey: 'idem-1',
    createdAt: new Date(0).toISOString(),
    safetyLevel: 'normal'
  };
}

describe('HolyricsAdapter', () => {
  it('derives capabilities from token permissions', async () => {
    const api = new FakeApi();
    const adapter = new HolyricsAdapter({ id: 'holyrics-1', nodeId: 'node-1', api });
    const probe = await adapter.probe();

    expect(probe.reachable).toBe(true);
    expect(probe.capabilities).toContain('presentation.navigation');
    expect(probe.capabilities).toContain('bible.search');
    expect(probe.capabilities).toContain('bible.present');
    expect(probe.capabilities).toContain('songs.present');
    expect(probe.capabilities).toContain('playlist.write');
  });

  it('maps neutral next navigation to the documented Holyrics ActionNext action', async () => {
    const api = new FakeApi();
    const adapter = new HolyricsAdapter({ id: 'holyrics-1', nodeId: 'node-1', api });
    await adapter.probe();
    const result = await adapter.execute(command('presentation.navigation', { action: 'next' }));

    expect(result.accepted).toBe(true);
    expect(api.calls.some(call => call.action === 'ActionNext')).toBe(true);
  });

  it('maps song presentation to ShowLyrics', async () => {
    const api = new FakeApi();
    const adapter = new HolyricsAdapter({ id: 'holyrics-1', nodeId: 'node-1', api });
    await adapter.probe();
    const result = await adapter.execute(command('songs.present', { id: 'song-44' }));

    expect(result.accepted).toBe(true);
    expect(api.calls.some(call => call.action === 'ShowLyrics' && call.input.id === 'song-44')).toBe(true);
  });

  it('maps Bible presentation to ShowVerse without leaking Holyrics into the command schema', async () => {
    const api = new FakeApi();
    const adapter = new HolyricsAdapter({ id: 'holyrics-1', nodeId: 'node-1', api });
    await adapter.probe();
    const result = await adapter.execute(command('bible.present', { references: 'Jo 3:16' }));

    expect(result.accepted).toBe(true);
    expect(api.calls.some(call => call.action === 'ShowVerse')).toBe(true);
  });
});
