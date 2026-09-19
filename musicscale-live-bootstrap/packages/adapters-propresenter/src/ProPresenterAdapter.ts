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
  'presentation.take',
  'preview.snapshot',
  'presentation.clear',
  'stage.message',
  'automation.trigger'
];

interface ProPresenterVersion {
  name?: string;
  platform?: string;
  os_version?: string;
  host_description?: string;
  api_version?: string;
}

interface PresentationIdentity {
  uuid?: string;
  name?: string;
  index?: number;
}

interface SlideIndexStatus {
  presentation?: {
    index?: number;
    presentation_id?: PresentationIdentity;
  } | null;
}

interface SlideStatusItem {
  text?: string;
  notes?: string;
  uuid?: string;
}

interface SlideStatus {
  current?: SlideStatusItem | null;
  next?: SlideStatusItem | null;
}

interface PresentationSlide {
  text?: string;
  notes?: string;
  image?: string;
  label?: string;
  enabled?: boolean;
}

interface PresentationDetail {
  id?: PresentationIdentity;
  name?: string;
  groups?: Array<{
    name?: string;
    slides?: PresentationSlide[];
  }>;
}


function sparseSlideList(
  status: SlideStatus,
  index: number
): Array<Record<string, unknown>> {
  const slides: Array<Record<string, unknown>> = [];
  if (status.current) {
    slides[index] = {
      number: index + 1,
      text: String(status.current.text || ''),
      notes: String(status.current.notes || ''),
      providerSlideId: String(status.current.uuid || '')
    };
  }
  if (status.next) {
    slides[index + 1] = {
      number: index + 2,
      text: String(status.next.text || ''),
      notes: String(status.next.notes || ''),
      providerSlideId: String(status.next.uuid || '')
    };
  }
  return slides;
}

function normalizeLightweightPresentation(
  status: SlideStatus,
  indexStatus: SlideIndexStatus
): Record<string, unknown> | null {
  const identity = indexStatus.presentation?.presentation_id;
  const index = Number(indexStatus.presentation?.index ?? 0);
  if (!status.current && !status.next && !identity) return null;

  const slides = sparseSlideList(status, Math.max(0, index));
  return {
    id: String(identity?.uuid || status.current?.uuid || 'propresenter-active'),
    type: 'presentation',
    name: String(identity?.name || 'ProPresenter'),
    slide_number: Math.max(0, index) + 1,
    total_slides: slides.length || undefined,
    slides
  };
}

function normalizeDetailedPresentation(
  presentation: PresentationDetail,
  indexStatus: SlideIndexStatus
): Record<string, unknown> | null {

  const identity = indexStatus.presentation?.presentation_id || presentation.id;
  const index = Math.max(0, Number(indexStatus.presentation?.index ?? 0));
  const slides = (presentation.groups || []).flatMap(group =>
    (group.slides || []).map(slide => ({
      number: 0,
      text: String(slide.text || ''),
      notes: String(slide.notes || ''),
      slide_description: String(slide.label || group.name || ''),
      preview: typeof slide.image === 'string' && slide.image
        ? slide.image.startsWith('data:image/')
          ? slide.image
          : `data:image/jpeg;base64,${slide.image}`
        : undefined
    }))
  ).map((slide, slideIndex) => ({
    ...slide,
    number: slideIndex + 1
  }));

  return {
    id: String(identity?.uuid || presentation.id?.uuid || 'propresenter-active'),
    type: 'presentation',
    name: String(identity?.name || presentation.name || presentation.id?.name || 'ProPresenter'),
    slide_number: index + 1,
    total_slides: slides.length,
    slides
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
  readonly observationIntervalMs = 500;
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

      const versionText = version.host_description || version.api_version || undefined;
      this.descriptor.version = versionText;
      this.lastState = {
        health: 'online',
        updatedAt: new Date().toISOString(),
        observed: {
          product: version.name || 'ProPresenter',
          platform: version.platform || null,
          osVersion: version.os_version || null,
          apiVersion: version.api_version || null,
          hostDescription: version.host_description || null
        }
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
      const [status, indexStatus] = await Promise.all([
        this.api.getInitial<SlideStatus>('/v1/status/slide'),
        this.api.getInitial<SlideIndexStatus>('/v1/presentation/slide_index')
      ]);
      this.lastState = {
        health: 'online',
        updatedAt: new Date().toISOString(),
        observed: {
          ...this.lastState.observed,
          currentPresentation: normalizeLightweightPresentation(status, indexStatus)
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
      const recoverable =
        message.includes('timeout') ||
        message.includes('http_5') ||
        message.includes('http_404');

      return this.result(
        command,
        started,
        false,
        recoverable ? 'provider_timeout' : 'provider_permission_denied',
        recoverable
      );
    }
  }

  private async readDetailedPresentation(): Promise<Record<string, unknown> | null> {
    const indexStatus = await this.api.getInitial<SlideIndexStatus>(
      '/v1/presentation/slide_index'
    );
    const identity = indexStatus.presentation?.presentation_id;
    const uuid = String(identity?.uuid || '');

    if (!uuid) {
      const status = await this.api.getInitial<SlideStatus>('/v1/status/slide');
      return normalizeLightweightPresentation(status, indexStatus);
    }

    const presentation = await this.api.get<PresentationDetail>(
      `/v1/presentation/${encodeURIComponent(uuid)}`
    );
    return normalizeDetailedPresentation(presentation, indexStatus);
  }

  private async executeCapability(
    command: LiveCommand
  ): Promise<Record<string, unknown> | undefined> {
    const payload = command.payload as Record<string, unknown>;

    switch (command.capability) {
      case 'presentation.slides.read':
      case 'presentation.preview':
      case 'preview.snapshot':
        return {
          currentPresentation: await this.readDetailedPresentation()
        };

      case 'presentation.navigation': {
        const action = String(payload.action || '');
        if (action === 'next') {
          await this.api.get('/v1/trigger/next');
        } else if (action === 'previous') {
          await this.api.get('/v1/trigger/previous');
        } else if (action === 'goto') {
          const index = Number(payload.index);
          if (!Number.isInteger(index) || index < 0) {
            throw new Error('invalid_slide_index');
          }
          await this.api.get(`/v1/trigger/cue/${index}`);
        } else {
          throw new Error('invalid_navigation_action');
        }
        return { currentPresentation: await this.readDetailedPresentation() };
      }

      case 'presentation.take': {
        const index = Number(payload.index);
        if (!Number.isInteger(index) || index < 0) {
          throw new Error('invalid_slide_index');
        }
        await this.api.get(`/v1/trigger/cue/${index}`);
        return { currentPresentation: await this.readDetailedPresentation() };
      }

      case 'presentation.clear':
        await this.api.get('/v1/clear/layer/slide');
        return { currentPresentation: null };

      case 'stage.message': {
        const show = payload.show !== false;
        if (!show) {
          await this.api.delete('/v1/stage/message');
          return { stageMessageVisible: false };
        }

        const message = String(payload.text || '');
        await this.api.put('/v1/stage/message', message);
        return {
          stageMessageVisible: true,
          stageMessage: message
        };
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
