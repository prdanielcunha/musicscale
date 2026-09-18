import type {
  Capability,
  CommandResult,
  LiveCommand,
  ProviderAdapter,
  ProviderDescriptor,
  ProviderState
} from '@musicscale-live/domain';
import type { ProPresenterApi } from './ProPresenterHttpClient';

const PROPRESENTER_CAPABILITIES: Capability[] = [
  'presentation.slides.read',
  'presentation.navigation',
  'presentation.preview',
  'preview.snapshot',
  'presentation.clear',
  'stage.message',
  'automation.trigger'
];

interface ProPresenterVersion {
  version?: string;
  name?: string;
  platform?: string;
  [key: string]: unknown;
}

function extractIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  for (const key of ['index', 'slide_index', 'slideIndex']) {
    if (typeof candidate[key] === 'number' && Number.isInteger(candidate[key])) {
      return Number(candidate[key]);
    }
  }
  return undefined;
}

function normalizedPresentation(
  status: unknown,
  slideIndex?: number,
  active?: Record<string, unknown> | null
): Record<string, unknown> {
  const source = status && typeof status === 'object'
    ? status as Record<string, unknown>
    : {};
  const activeId = active
    ? String(active.id || active.uuid || active.presentation_id || '')
    : '';

  const current =
    (source.current && typeof source.current === 'object'
      ? source.current as Record<string, unknown>
      : null) ||
    (source.slide && typeof source.slide === 'object'
      ? source.slide as Record<string, unknown>
      : null);
  const next =
    source.next && typeof source.next === 'object'
      ? source.next as Record<string, unknown>
      : null;

  const currentText = current
    ? String(current.text || current.label || current.name || '')
    : String(source.current_text || source.text || '');
  const nextText = next
    ? String(next.text || next.label || next.name || '')
    : String(source.next_text || '');

  const currentNumber = slideIndex != null ? slideIndex + 1 : 1;
  return {
    id: activeId || 'propresenter-active',
    type: 'presentation',
    name: String(
      active?.name ||
      active?.title ||
      source.presentation_name ||
      'ProPresenter'
    ),
    slide_number: currentNumber,
    total_slides: Number(
      active?.slide_count ||
      active?.cue_count ||
      source.total_slides ||
      0
    ) || undefined,
    slides: [
      {
        number: currentNumber,
        text: currentText,
        image_uuid: current?.image_uuid || current?.image || source.current_image_uuid
      },
      {
        number: currentNumber + 1,
        text: nextText,
        image_uuid: next?.image_uuid || next?.image || source.next_image_uuid
      }
    ],
    rawStatus: source
  };
}

export interface ProPresenterAdapterOptions {
  id: string;
  nodeId: string;
  api: ProPresenterApi;
  displayName?: string;
}

export class ProPresenterAdapter implements ProviderAdapter {
  readonly descriptor: ProviderDescriptor;
  private readonly api: ProPresenterApi;
  private readonly supported = new Set<Capability>();
  private lastState: ProviderState = {
    health: 'offline',
    updatedAt: new Date(0).toISOString(),
    observed: {}
  };

  constructor(options: ProPresenterAdapterOptions) {
    this.api = options.api;
    this.descriptor = {
      id: options.id,
      nodeId: options.nodeId,
      kind: 'presentation',
      displayName: options.displayName || 'ProPresenter',
      providerKey: 'propresenter'
    };
  }

  async probe() {
    try {
      const version = await this.api.get<ProPresenterVersion>('/version');
      this.supported.clear();
      for (const capability of PROPRESENTER_CAPABILITIES) {
        this.supported.add(capability);
      }

      const versionText = version?.version ? String(version.version) : undefined;
      this.descriptor.version = versionText;
      this.lastState = {
        health: 'online',
        updatedAt: new Date().toISOString(),
        observed: { version }
      };

      return {
        reachable: true,
        version: versionText,
        capabilities: [...this.supported]
      };
    } catch (error) {
      this.supported.clear();
      this.lastState = {
        health: 'offline',
        updatedAt: new Date().toISOString(),
        observed: {
          error: error instanceof Error ? error.message : 'propresenter_probe_failed'
        }
      };
      return {
        reachable: false,
        capabilities: [] as Capability[],
        reason: error instanceof Error ? error.message : 'propresenter_probe_failed'
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
    if (!this.supported.has('presentation.slides.read')) return this.lastState;

    try {
      const [status, index, active] = await Promise.all([
        this.api.get<Record<string, unknown>>('/v1/status/slide'),
        this.api.get<unknown>('/v1/presentation/slide_index'),
        this.api.get<Record<string, unknown> | null>('/v1/presentation/active')
      ]);
      this.lastState = {
        health: 'online',
        updatedAt: new Date().toISOString(),
        observed: {
          ...this.lastState.observed,
          currentPresentation: normalizedPresentation(
            status,
            extractIndex(index),
            active
          )
        }
      };
    } catch (error) {
      this.lastState = {
        health: 'degraded',
        updatedAt: new Date().toISOString(),
        observed: {
          ...this.lastState.observed,
          error: error instanceof Error ? error.message : 'propresenter_state_failed'
        }
      };
    }
    return this.peekState();
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
      const message = error instanceof Error ? error.message : 'propresenter_command_failed';
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
      case 'presentation.slides.read':
      case 'presentation.preview':
      case 'preview.snapshot': {
        const [status, index, active] = await Promise.all([
          this.api.get<Record<string, unknown>>('/v1/status/slide'),
          this.api.get<unknown>('/v1/presentation/slide_index'),
          this.api.get<Record<string, unknown> | null>('/v1/presentation/active')
        ]);
        return {
          currentPresentation: normalizedPresentation(
            status,
            extractIndex(index),
            active
          )
        };
      }

      case 'presentation.navigation': {
        const action = String(payload.action || '');
        if (action === 'next') {
          await this.api.get('/v1/trigger/next');
        } else if (action === 'previous') {
          await this.api.get('/v1/trigger/previous');
        } else if (action === 'goto') {
          const active = await this.api.get<Record<string, unknown> | null>(
            '/v1/presentation/active'
          );
          const uuid = String(active?.id || active?.uuid || '');
          const index = Number(payload.index);
          if (!uuid || !Number.isInteger(index) || index < 0) {
            throw new Error('invalid_slide_index');
          }
          await this.api.get(
            `/v1/presentation/${encodeURIComponent(uuid)}/${index}/trigger`
          );
        } else {
          throw new Error('invalid_navigation_action');
        }

        const state = await this.getState();
        return { currentPresentation: state.observed.currentPresentation };
      }

      case 'presentation.clear':
        await this.api.get('/v1/clear/layer/slide');
        return { currentPresentation: null };

      case 'stage.message': {
        const show = payload.show !== false;
        if (show) {
          await this.api.put('/v1/stage/message', String(payload.text || ''));
        } else {
          await this.api.delete('/v1/stage/message');
        }
        return { stageMessageVisible: show };
      }

      case 'automation.trigger': {
        const macroId = String(payload.macroId || payload.id || '');
        if (!macroId) throw new Error('macro_id_required');
        await this.api.get(`/v1/macro/${encodeURIComponent(macroId)}/trigger`);
        return { macroId, triggered: true };
      }

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
