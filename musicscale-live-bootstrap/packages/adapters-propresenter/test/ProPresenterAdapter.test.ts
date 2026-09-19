import { describe, expect, it } from 'vitest';
import type { LiveCommand } from '@musicscale-live/domain';
import { ProPresenterAdapter } from '../src/ProPresenterAdapter';
import type {
  ProPresenterApi,
  ProPresenterBinaryResponse
} from '../src/ProPresenterHttpClient';

class FakeApi implements ProPresenterApi {
  calls: Array<{ method: string; path: string; body?: unknown }> = [];

  async get<T>(path: string): Promise<T> {
    this.calls.push({ method: 'GET', path });

    if (path === '/version') {
      return {
        name: 'Main sanctuary ProPresenter',
        platform: 'win',
        os_version: '11',
        host_description: 'ProPresenter',
        api_version: 'v1'
      } as T;
    }
    if (path === '/v1/libraries') {
      return [{
        id: { uuid: 'library-1', name: 'Worship', index: 0 }
      }] as T;
    }
    if (path === '/v1/library/library-1') {
      return {
        updateType: 'all',
        items: [
          { uuid: 'presentation-1', name: 'Amazing Grace', index: 0 },
          { uuid: 'presentation-2', name: 'Holy Forever', index: 1 }
        ]
      } as T;
    }
    if (path === '/v1/status/slide') {
      return {
        current: { text: 'Amazing grace', notes: 'quiet', uuid: 'slide-current' },
        next: { text: 'How sweet the sound', notes: 'build', uuid: 'slide-next' }
      } as T;
    }
    if (path === '/v1/presentation/slide_index') {
      return {
        presentation: {
          index: 2,
          presentation_id: {
            uuid: 'presentation-1',
            name: 'Amazing Grace',
            index: 0
          }
        }
      } as T;
    }
    if (path === '/v1/presentation/presentation-1') {
      return {
        id: { uuid: 'presentation-1', name: 'Amazing Grace' },
        name: 'Amazing Grace',
        groups: [{
          name: 'Verse 1',
          slides: [
            { text: 'Slide 1', label: 'Verse 1', image: '/9j/a' },
            { text: 'Slide 2', label: 'Verse 1', image: '/9j/b' },
            { text: 'Amazing grace', label: 'Verse 1', image: '/9j/c' },
            { text: 'How sweet the sound', label: 'Verse 1', image: '/9j/d' }
          ]
        }]
      } as T;
    }
    return undefined as T;
  }

  async getInitial<T>(path: string): Promise<T> {
    return this.get<T>(path);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    this.calls.push({ method: 'PUT', path, body });
    return undefined as T;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    this.calls.push({ method: 'POST', path, body });
    return undefined as T;
  }

  async delete<T>(path: string): Promise<T> {
    this.calls.push({ method: 'DELETE', path });
    return undefined as T;
  }

  async getBinary(_path: string): Promise<ProPresenterBinaryResponse> {
    return { contentType: 'image/jpeg', body: new Uint8Array([1]) };
  }
}

function command(
  capability: LiveCommand['capability'],
  payload: Record<string, unknown> = {}
): LiveCommand {
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
    targetProviderIds: ['propresenter-1'],
    outputTargets: ['main'],
    payload,
    idempotencyKey: 'idem-1',
    createdAt: new Date(0).toISOString(),
    safetyLevel: 'normal'
  };
}

describe('ProPresenterAdapter', () => {
  it('probes the local API and exposes only verified neutral capabilities', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });

    const probe = await adapter.probe();

    expect(probe.reachable).toBe(true);
    expect(probe.capabilities).toContain('presentation.navigation');
    expect(probe.capabilities).toContain('presentation.preview');
    expect(probe.capabilities).toContain('stage.message');
    expect(probe.capabilities).toContain('songs.search');
    expect(probe.capabilities).toContain('songs.present');
  });

  it('keeps lightweight state aligned to the actual slide index', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();

    const state = await adapter.getState();
    const presentation = state.observed.currentPresentation as any;

    expect(presentation.slide_number).toBe(3);
    expect(presentation.slides[2].text).toBe('Amazing grace');
    expect(presentation.slides[3].text).toBe('How sweet the sound');
    expect(api.calls.some(call => call.path === '/v1/presentation/active')).toBe(false);
  });

  it('uses /v1/trigger/cue/{index} for neutral goto', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();

    const result = await adapter.execute(
      command('presentation.navigation', { action: 'goto', index: 5 })
    );

    expect(result.accepted).toBe(true);
    expect(api.calls.some(call => call.path === '/v1/trigger/cue/5')).toBe(true);
  });

  it('returns detailed current and next preview images in the common Live shape', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();

    const result = await adapter.execute(command('preview.snapshot'));
    const presentation = result.observedState?.currentPresentation as any;

    expect(presentation.name).toBe('Amazing Grace');
    expect(presentation.slide_number).toBe(3);
    expect(presentation.slides[2].text).toBe('Amazing grace');
    expect(presentation.slides[2].preview).toContain('data:image/jpeg;base64,');
    expect(presentation.slides[3].text).toBe('How sweet the sound');
    expect(api.calls.some(call => call.path === '/v1/presentation/current')).toBe(false);
    expect(api.calls.some(call =>
      call.path === '/v1/presentation/presentation-1'
    )).toBe(true);
  });

  it('does not call the streaming presentation/current endpoint', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();
    await adapter.execute(command('preview.snapshot'));

    expect(api.calls.some(call => call.path === '/v1/presentation/current')).toBe(false);
  });

  it('indexes presentations from local libraries for MusicScale song matching', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();

    const result = await adapter.execute(command('songs.search', {
      text: 'amazing'
    }));

    expect(result.accepted).toBe(true);
    const results = result.observedState?.results as Array<any>;
    expect(results).toEqual([
      expect.objectContaining({
        id: 'presentation-1',
        title: 'Amazing Grace'
      })
    ]);
    expect(api.calls.some(call => call.path === '/v1/libraries')).toBe(true);
    expect(api.calls.some(call => call.path === '/v1/library/library-1')).toBe(true);
  });

  it('presents a matched MusicScale song through its stable presentation UUID', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();

    const result = await adapter.execute(command('songs.present', {
      id: 'presentation-1'
    }));

    expect(result.accepted).toBe(true);
    expect(api.calls.some(call =>
      call.path === '/v1/presentation/presentation-1/trigger'
    )).toBe(true);
  });

  it('maps stage messaging to PUT and DELETE', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();

    await adapter.execute(command('stage.message', {
      text: 'Bridge after chorus',
      show: true
    }));
    await adapter.execute(command('stage.message', {
      text: '',
      show: false
    }));

    expect(api.calls.some(call =>
      call.method === 'PUT' &&
      call.path === '/v1/stage/message' &&
      call.body === 'Bridge after chorus'
    )).toBe(true);
    expect(api.calls.some(call =>
      call.method === 'DELETE' &&
      call.path === '/v1/stage/message'
    )).toBe(true);
  });
});
