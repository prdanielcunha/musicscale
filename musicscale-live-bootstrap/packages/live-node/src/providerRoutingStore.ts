import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ProviderRouteGroup } from '@musicscale-live/domain';

interface RoutingFile {
  version: 1;
  routes: Partial<Record<ProviderRouteGroup, string>>;
}

const GROUPS: ProviderRouteGroup[] = [
  'presentation',
  'songs',
  'bible',
  'media',
  'stage',
  'visual',
  'audio',
  'automation'
];

export class ProviderRoutingStore {
  private loaded = false;
  private file: RoutingFile = { version: 1, routes: {} };
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as RoutingFile;
      this.file = parsed.version === 1 && parsed.routes
        ? { version: 1, routes: { ...parsed.routes } }
        : { version: 1, routes: {} };
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      this.file = { version: 1, routes: {} };
    }
    this.loaded = true;
  }

  async all(): Promise<Partial<Record<ProviderRouteGroup, string>>> {
    await this.load();
    return structuredClone(this.file.routes);
  }

  async get(group: ProviderRouteGroup): Promise<string | null> {
    await this.load();
    return this.file.routes[group] || null;
  }

  async set(group: ProviderRouteGroup, providerId: string | null): Promise<void> {
    await this.load();
    if (!GROUPS.includes(group)) throw new Error('invalid_route_group');
    const normalized = providerId?.trim() || null;

    this.writeQueue = this.writeQueue.then(async () => {
      if (normalized) this.file.routes[group] = normalized;
      else delete this.file.routes[group];
      await this.persist();
    });
    await this.writeQueue;
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    await writeFile(temp, JSON.stringify(this.file, null, 2), { mode: 0o600 });
    await rename(temp, this.filePath);
  }
}
