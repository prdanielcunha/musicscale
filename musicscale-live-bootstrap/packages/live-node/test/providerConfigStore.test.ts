import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ProviderConfigStore } from '../src/providerConfigStore';

describe('ProviderConfigStore', () => {
  it('stores Holyrics configuration only in the local Node state directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-provider-'));
    const path = join(dir, 'providers.json');
    const store = new ProviderConfigStore(path);

    await store.setHolyrics({
      baseUrl: 'http://127.0.0.1:8091',
      token: 'local-token'
    });

    const restored = new ProviderConfigStore(path);
    expect((await restored.getHolyrics())?.token).toBe('local-token');
    expect(await readFile(path, 'utf8')).toContain('local-token');
  });

  it('rejects public internet Holyrics endpoints for local provider setup', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-provider-'));
    const store = new ProviderConfigStore(join(dir, 'providers.json'));

    await expect(store.setHolyrics({
      baseUrl: 'https://example.com',
      token: 'token'
    })).rejects.toThrow('holyrics_url_must_be_local');
  });
});
