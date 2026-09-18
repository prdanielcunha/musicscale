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
});
