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
});
