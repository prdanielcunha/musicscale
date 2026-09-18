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

  it('stores a local Resolume Webserver endpoint without a cloud secret', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-provider-'));
    const path = join(dir, 'providers.json');
    const store = new ProviderConfigStore(path);

    await store.setResolume({
      baseUrl: 'http://192.168.1.50:8080'
    });

    const restored = new ProviderConfigStore(path);
    expect((await restored.getResolume())?.baseUrl).toBe('http://192.168.1.50:8080');
    expect(await readFile(path, 'utf8')).toContain('192.168.1.50:8080');
  });

  it('rejects public internet Resolume endpoints', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'ms-live-provider-'));
    const store = new ProviderConfigStore(join(dir, 'providers.json'));

    await expect(store.setResolume({
      baseUrl: 'https://example.com'
    })).rejects.toThrow('resolume_url_must_be_local');
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
