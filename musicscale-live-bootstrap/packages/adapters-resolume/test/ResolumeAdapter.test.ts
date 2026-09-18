import { describe, expect, it } from 'vitest';
import type { LiveCommand } from '@musicscale-live/domain';
import { ResolumeAdapter } from '../src/ResolumeAdapter';
import type { ResolumeRestApi } from '../src/ResolumeRestClient';

class FakeApi implements ResolumeRestApi {
  calls: Array<{ method: string; path: string; body?: unknown }> = [];

  async get<T>(path: string): Promise<T> {
    this.calls.push({ method: 'GET', path });
    if (path === '/product') return { name: 'Arena', version: '7.22' } as T;
    if (path === '/composition') return { id: 'composition-1', name: 'Sunday' } as T;
    return {} as T;
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    this.calls.push({ method: 'POST', path, body });
    return undefined as T;
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
    targetProviderIds: ['resolume-1'],
    outputTargets: ['main'],
    payload,
    idempotencyKey: 'idem-1',
    createdAt: new Date(0).toISOString(),
    safetyLevel: 'normal'
  };
}

describe('ResolumeAdapter', () => {
  it('exposes visual capabilities after a successful product probe', async () => {
    const api = new FakeApi();
    const adapter = new ResolumeAdapter({ id: 'resolume-1', nodeId: 'node-1', api });
    const probe = await adapter.probe();

    expect(probe.reachable).toBe(true);
    expect(probe.capabilities).toContain('visual.composition.read');
    expect(probe.capabilities).toContain('visual.clip.trigger');
    expect(probe.capabilities).toContain('visual.layer.clear');
    expect(probe.capabilities).toContain('visual.composition.clear');
  });

  it('triggers clips by stable id', async () => {
    const api = new FakeApi();
    const adapter = new ResolumeAdapter({ id: 'resolume-1', nodeId: 'node-1', api });
    await adapter.probe();

    const result = await adapter.execute(command('visual.clip.trigger', {
      clipId: '1658311521181'
    }));

    expect(result.accepted).toBe(true);
    expect(api.calls.some(call =>
      call.method === 'POST' &&
      call.path === '/composition/clips/by-id/1658311521181/connect'
    )).toBe(true);
  });

  it('clears layers by stable id', async () => {
    const api = new FakeApi();
    const adapter = new ResolumeAdapter({ id: 'resolume-1', nodeId: 'node-1', api });
    await adapter.probe();

    await adapter.execute(command('visual.layer.clear', { layerId: 'layer-44' }));
    expect(api.calls.some(call =>
      call.path === '/composition/layers/by-id/layer-44/clear'
    )).toBe(true);
  });
});
