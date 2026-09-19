import type {
  Capability,
  CommandResult,
  LiveCommand,
  ProviderAdapter,
  ProviderAsset,
  ProviderAssetRequest,
  ProviderDescriptor,
  ProviderState
} from '@musicscale-live/domain';
import type { ResolumeRestApi } from './ResolumeRestClient';

const RESOLUME_CAPABILITIES: Capability[] = [
  'visual.composition.read',
  'visual.clip.trigger',
  'visual.layer.clear',
  'visual.composition.clear',
  'visual.outputs.read',
  'visual.output.snapshot'
];

interface ProductInfo {
  name?: string;
  version?: string;
  product?: string;
  [key: string]: unknown;
}

export interface ResolumeAdapterOptions {
  id: string;
  nodeId: string;
  api: ResolumeRestApi;
  displayName?: string;
}

export class ResolumeAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor;
  readonly observationIntervalMs = 800;
  private readonly api: ResolumeRestApi;
  private readonly supported = new Set<Capability>();
  private lastState: ProviderState = {
    health: 'offline',
    updatedAt: new Date(0).toISOString(),
    observed: {}
  };

  constructor(options: ResolumeAdapterOptions) {
    this.api = options.api;
    this.descriptor = {
      id: options.id,
      nodeId: options.nodeId,
      kind: 'visual',
      displayName: options.displayName || 'Resolume Arena',
      providerKey: 'resolume'
    };
  }

  async probe() {
    try {
      const product = await this.api.get<ProductInfo>('/product');
      this.supported.clear();
      for (const capability of RESOLUME_CAPABILITIES) this.supported.add(capability);

      const version = product?.version ? String(product.version) : undefined;
      this.descriptor.version = version;
      this.lastState = {
        health: 'online',
        updatedAt: new Date().toISOString(),
        observed: { product }
      };

      return {
        reachable: true,
        version,
        capabilities: [...this.supported]
      };
    } catch (error) {
      this.supported.clear();
      this.lastState = {
        health: 'offline',
        updatedAt: new Date().toISOString(),
        observed: {
          error: error instanceof Error ? error.message : 'resolume_probe_failed'
        }
      };
      return {
        reachable: false,
        capabilities: [] as Capability[],
        reason: error instanceof Error ? error.message : 'resolume_probe_failed'
      };
    }
  }

  capabilities(): ReadonlySet<Capability> {
    return this.supported;
  }

  peekState(): ProviderState {
    return {
      health: this.lastState.health,
      updatedAt: this.lastState.updatedAt,
      observed: { ...this.lastState.observed }
    };
  }

  async getState(): Promise<ProviderState> {
    if (!this.supported.has('visual.composition.read')) return this.lastState;
    try {
      const composition = await this.api.get<Record<string, unknown>>('/composition');
      this.lastState = {
        health: 'online',
        updatedAt: new Date().toISOString(),
        observed: {
          ...this.lastState.observed,
          composition
        }
      };
    } catch (error) {
      this.lastState = {
        health: 'degraded',
        updatedAt: new Date().toISOString(),
        observed: {
          ...this.lastState.observed,
          error: error instanceof Error ? error.message : 'resolume_state_failed'
        }
      };
    }
    return this.peekState();
  }

  async fetchAsset(request: ProviderAssetRequest): Promise<ProviderAsset> {
    if (request.kind !== 'output.snapshot') {
      throw new Error('capability_not_supported');
    }
    if (!this.supported.has('visual.output.snapshot')) {
      throw new Error('capability_not_supported');
    }

    const targetId = String(request.targetId || '');
    if (!targetId) throw new Error('resolume_monitor_id_required');
    const extension = request.format === 'png' ? 'png' : 'jpg';
    const response = await this.api.getBinary(
      `/composition/monitors/${encodeURIComponent(targetId)}/snapshot.${extension}`
    );
    return {
      contentType: response.contentType,
      body: response.body,
      cacheControl: 'no-store'
    };
  }

  async execute(command: LiveCommand): Promise<CommandResult> {
    const started = performance.now();
    try {
      if (!this.supported.has(command.capability)) {
        return this.result(command, started, false, 'capability_not_supported', true);
      }

      const observedState = await this.executeCapability(command);
      return {
        commandId: command.id,
        providerInstanceId: this.descriptor.id,
        accepted: true,
        latencyMs: Math.max(0, Math.round(performance.now() - started)),
        observedState
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'resolume_command_failed';
      const recoverable = message.includes('timeout') || message.includes('http_5');
      return this.result(
        command,
        started,
        false,
        recoverable ? 'provider_timeout' : 'provider_permission_denied',
        recoverable
      );
    }
  }

  private async executeCapability(
    command: LiveCommand
  ): Promise<Record<string, unknown> | undefined> {
    const payload = command.payload as Record<string, unknown>;

    switch (command.capability) {
      case 'visual.composition.read': {
        const composition = await this.api.get<Record<string, unknown>>('/composition');
        this.lastState = {
          health: 'online',
          updatedAt: new Date().toISOString(),
          observed: { ...this.lastState.observed, composition }
        };
        return { composition };
      }

      case 'visual.clip.trigger': {
        const clipId = String(payload.clipId || '');
        if (!clipId) throw new Error('resolume_clip_id_required');
        await this.api.post(`/composition/clips/by-id/${encodeURIComponent(clipId)}/connect`);
        return { activeClipId: clipId };
      }

      case 'visual.layer.clear': {
        const layerId = String(payload.layerId || '');
        if (!layerId) throw new Error('resolume_layer_id_required');
        await this.api.post(`/composition/layers/by-id/${encodeURIComponent(layerId)}/clear`);
        return { clearedLayerId: layerId };
      }

      case 'visual.composition.clear':
        await this.api.post('/composition/disconnect-all');
        return { compositionCleared: true };

      case 'visual.outputs.read': {
        const outputs = await this.api.get<unknown[]>('/composition/monitors');
        return { outputs: Array.isArray(outputs) ? outputs : [] };
      }

      case 'visual.output.snapshot':
        return { assetRequired: true };

      default:
        throw new Error('capability_not_supported');
    }
  }

  private result(
    command: LiveCommand,
    started: number,
    accepted: boolean,
    errorCode: string,
    recoverable: boolean
  ): CommandResult {
    return {
      commandId: command.id,
      providerInstanceId: this.descriptor.id,
      accepted,
      latencyMs: Math.max(0, Math.round(performance.now() - started)),
      errorCode,
      recoverable
    };
  }
}
