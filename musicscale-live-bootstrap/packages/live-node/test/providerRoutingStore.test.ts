import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProviderRoutingStore } from '../src/providerRoutingStore';

describe('ProviderRoutingStore', () => {
  it('persists explicit provider choices per neutral route group', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-routing-'));
    const path = join(dir, 'routing.json');
    const store = new ProviderRoutingStore(path);

    await store.set('presentation', 'holyrics-primary');
    await store.set('visual', 'resolume-primary');

    const restored = new ProviderRoutingStore(path);
    expect(await restored.get('presentation')).toBe('holyrics-primary');
    expect(await restored.get('visual')).toBe('resolume-primary');
  });

  it('can clear a route without changing other groups', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-routing-'));
    const store = new ProviderRoutingStore(join(dir, 'routing.json'));

    await store.set('presentation', 'propresenter-primary');
    await store.set('stage', 'holyrics-primary');
    await store.set('presentation', null);

    expect(await store.get('presentation')).toBeNull();
    expect(await store.get('stage')).toBe('holyrics-primary');
  });
});
