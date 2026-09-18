import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { LiveNodeRuntimeState } from '@musicscale-live/domain';

export class RuntimeStateStore {
  private state: LiveNodeRuntimeState;
  private loaded = false;

  constructor(private readonly filePath: string, private readonly nodeId: string) {
    this.state = this.fresh();
  }

  async load(): Promise<LiveNodeRuntimeState> {
    if (this.loaded) return structuredClone(this.state);
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as LiveNodeRuntimeState;
      this.state = parsed.nodeId === this.nodeId ? parsed : this.fresh();
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
      this.state = this.fresh();
    }
    this.loaded = true;
    return structuredClone(this.state);
  }

  async patch(
    patch: Partial<Omit<LiveNodeRuntimeState, 'nodeId' | 'revision' | 'updatedAt'>>
  ): Promise<LiveNodeRuntimeState> {
    await this.load();
    this.state = {
      ...this.state,
      ...patch,
      nodeId: this.nodeId,
      revision: this.state.revision + 1,
      updatedAt: new Date().toISOString()
    };
    await this.persist();
    return structuredClone(this.state);
  }

  private fresh(): LiveNodeRuntimeState {
    return {
      revision: 0,
      nodeId: this.nodeId,
      updatedAt: new Date(0).toISOString(),
      activeLiveSessionId: null,
      activeServiceItemId: null,
      providerObservedState: {}
    };
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    await writeFile(temp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    await rename(temp, this.filePath);
  }
}
