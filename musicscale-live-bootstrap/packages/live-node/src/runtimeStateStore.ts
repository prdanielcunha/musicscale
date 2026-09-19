import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { LiveNodeRuntimeState } from '@musicscale-live/domain';

export class RuntimeStateStore {
  private state: LiveNodeRuntimeState;
  private loaded = false;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string, private readonly nodeId: string) {
    this.state = this.fresh();
  }

  async load(): Promise<LiveNodeRuntimeState> {
    if (this.loaded) return structuredClone(this.state);
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as LiveNodeRuntimeState;
      this.state = parsed.nodeId === this.nodeId
        ? {
            ...this.fresh(),
            ...parsed,
            providerObservedState: parsed.providerObservedState || {},
            providerLinks: Array.isArray(parsed.providerLinks) ? parsed.providerLinks : [],
            requests: Array.isArray(parsed.requests) ? parsed.requests : [],
            servicePlan: parsed.servicePlan || null
          }
        : this.fresh();
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
    let resolveResult!: (state: LiveNodeRuntimeState) => void;
    let rejectResult!: (error: unknown) => void;
    const result = new Promise<LiveNodeRuntimeState>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    this.writeQueue = this.writeQueue
      .then(async () => {
        await this.load();
        this.state = {
          ...this.state,
          ...patch,
          nodeId: this.nodeId,
          revision: this.state.revision + 1,
          updatedAt: new Date().toISOString()
        };
        await this.persist();
        resolveResult(structuredClone(this.state));
      })
      .catch(error => {
        rejectResult(error);
      });

    return result;
  }

  async mergeProviderObservedState(
    providerId: string,
    observed: Record<string, unknown>
  ): Promise<LiveNodeRuntimeState> {
    let resolveResult!: (state: LiveNodeRuntimeState) => void;
    let rejectResult!: (error: unknown) => void;
    const result = new Promise<LiveNodeRuntimeState>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });

    this.writeQueue = this.writeQueue
      .then(async () => {
        await this.load();
        this.state = {
          ...this.state,
          providerObservedState: {
            ...this.state.providerObservedState,
            [providerId]: {
              ...(this.state.providerObservedState[providerId] || {}),
              ...observed
            }
          },
          nodeId: this.nodeId,
          revision: this.state.revision + 1,
          updatedAt: new Date().toISOString()
        };
        await this.persist();
        resolveResult(structuredClone(this.state));
      })
      .catch(error => {
        rejectResult(error);
      });

    return result;
  }

  private fresh(): LiveNodeRuntimeState {
    return {
      revision: 0,
      nodeId: this.nodeId,
      updatedAt: new Date(0).toISOString(),
      activeLiveSessionId: null,
      activeServiceItemId: null,
      providerObservedState: {},
      servicePlan: null,
      providerLinks: [],
      requests: []
    };
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.tmp`;
    await writeFile(temp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    await rename(temp, this.filePath);
  }
}
