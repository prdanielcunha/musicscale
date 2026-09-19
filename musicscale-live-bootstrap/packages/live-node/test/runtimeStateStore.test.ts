import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RuntimeStateStore } from '../src/runtimeStateStore';

describe('RuntimeStateStore', () => {
  it('persists a crash-recovery snapshot with monotonic revision', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-state-'));
    const path = join(dir, 'runtime.json');
    const store = new RuntimeStateStore(path, 'node_1');

    const first = await store.patch({ activeLiveSessionId: 'session_1' });
    const second = await store.patch({ activeServiceItemId: 'item_7' });

    expect(first.revision).toBe(1);
    expect(second.revision).toBe(2);

    const restored = await new RuntimeStateStore(path, 'node_1').load();
    expect(restored.activeLiveSessionId).toBe('session_1');
    expect(restored.activeServiceItemId).toBe('item_7');
    expect(restored.revision).toBe(2);
  });
  it('serializes concurrent patches without losing revision or state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-state-'));
    const path = join(dir, 'runtime.json');
    const store = new RuntimeStateStore(path, 'node_1');

    const [a, b, c] = await Promise.all([
      store.patch({ activeLiveSessionId: 'session_parallel' }),
      store.patch({ activeServiceItemId: 'item_parallel' }),
      store.patch({ providerObservedState: { visual: { clip: 'A' } } })
    ]);

    expect([a.revision, b.revision, c.revision].sort((x, y) => x - y)).toEqual([1, 2, 3]);

    const restored = await new RuntimeStateStore(path, 'node_1').load();
    expect(restored.revision).toBe(3);
    expect(restored.activeLiveSessionId).toBe('session_parallel');
    expect(restored.activeServiceItemId).toBe('item_parallel');
    expect(restored.providerObservedState.visual).toEqual({ clip: 'A' });
  });

  it('persists cached service plans and provider links for recovery', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-state-'));
    const path = join(dir, 'runtime.json');
    const store = new RuntimeStateStore(path, 'node_1');

    await store.patch({
      servicePlan: {
        id: 'plan_1',
        organizationId: 'org_1',
        venueId: 'venue_1',
        liveSystemId: 'system_1',
        title: 'Sunday',
        scheduledAt: '2026-09-20T19:00:00',
        items: [{
          id: 'song:s1',
          type: 'song',
          title: 'Song',
          sourceEntityId: 's1',
          providerLinkId: 'link_1',
          state: 'prepared'
        }],
        revision: 1
      },
      providerLinks: [{
        id: 'link_1',
        organizationId: 'org_1',
        venueId: 'venue_1',
        providerInstanceId: 'holyrics-primary',
        entityType: 'song',
        musicScaleEntityId: 's1',
        externalId: 'h1'
      }]
    });

    const restored = await new RuntimeStateStore(path, 'node_1').load();
    expect(restored.servicePlan?.id).toBe('plan_1');
    expect(restored.providerLinks[0]?.externalId).toBe('h1');
  });
  it('persists local Live requests for operator recovery', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-state-'));
    const path = join(dir, 'runtime.json');
    const store = new RuntimeStateStore(path, 'node_1');

    await store.patch({
      requests: [{
        id: 'req_1',
        organizationId: 'org_1',
        venueId: 'venue_1',
        liveSessionId: 'session_1',
        actorId: 'pastor_1',
        kind: 'bible',
        payload: { reference: 'João 3:16' },
        status: 'pending',
        createdAt: '2026-09-19T00:00:00.000Z'
      }]
    });

    const restored = await new RuntimeStateStore(path, 'node_1').load();
    expect(restored.requests).toHaveLength(1);
    expect(restored.requests[0]?.kind).toBe('bible');
    expect(restored.requests[0]?.status).toBe('pending');
  });

  it('serializes independent provider state merges without losing another provider', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-state-'));
    const path = join(dir, 'runtime.json');
    const store = new RuntimeStateStore(path, 'node_1');

    await Promise.all([
      store.mergeProviderObservedState('holyrics-primary', {
        currentPresentation: { id: 'song-1', slide_number: 2 }
      }),
      store.mergeProviderObservedState('resolume-primary', {
        composition: { id: 'comp-1' }
      }),
      store.mergeProviderObservedState('propresenter-primary', {
        currentPresentation: { id: 'presentation-1', slide_number: 4 }
      })
    ]);

    const state = await store.load();
    expect(state.providerObservedState['holyrics-primary']).toBeTruthy();
    expect(state.providerObservedState['resolume-primary']).toBeTruthy();
    expect(state.providerObservedState['propresenter-primary']).toBeTruthy();
  });
});
