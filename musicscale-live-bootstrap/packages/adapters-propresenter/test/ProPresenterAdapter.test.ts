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
    if (path === '/version') return { version: '21.4', name: 'ProPresenter' } as T;
    if (path === '/v1/status/slide') {
      return {
        current: { text: 'Amazing grace', image_uuid: 'img-current' },
        next: { text: 'How sweet the sound', image_uuid: 'img-next' }
      } as T;
    }
    if (path === '/v1/presentation/slide_index') return { index: 2 } as T;
    if (path === '/v1/presentation/active') {
      return { id: 'presentation-1', name: 'Amazing Grace', cue_count: 8 } as T;
    }
    return {} as T;
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

  async getBinary(): Promise<ProPresenterBinaryResponse> {
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
  it('exposes only the verified neutral capability surface', async () => {
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
    expect(probe.capabilities).not.toContain('songs.search');
  });

  it('maps neutral next navigation to the public trigger endpoint', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();

    const result = await adapter.execute(
      command('presentation.navigation', { action: 'next' })
    );

    expect(result.accepted).toBe(true);
    expect(api.calls.some(call => call.path === '/v1/trigger/next')).toBe(true);
  });

  it('normalizes current and next slide text into the common Live model', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();

    const result = await adapter.execute(command('presentation.preview'));
    const presentation = result.observedState?.currentPresentation as Record<string, unknown>;
    const slides = presentation.slides as Array<Record<string, unknown>>;

    expect(presentation.slide_number).toBe(3);
    expect(slides[0]?.text).toBe('Amazing grace');
    expect(slides[1]?.text).toBe('How sweet the sound');
  });

  it('maps stage messages without exposing ProPresenter semantics to the domain', async () => {
    const api = new FakeApi();
    const adapter = new ProPresenterAdapter({
      id: 'propresenter-1',
      nodeId: 'node-1',
      api
    });
    await adapter.probe();

    await adapter.execute(command('stage.message', {
      text: 'Go to bridge',
      show: true
    }));

    expect(api.calls.some(call =>
      call.method === 'PUT' &&
      call.path === '/v1/stage/message' &&
      call.body === 'Go to bridge'
    )).toBe(true);
  });
});
