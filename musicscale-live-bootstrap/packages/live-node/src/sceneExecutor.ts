import type {
  CommandResult,
  LiveCommand,
  SceneExecutionRequest,
  SceneExecutionResult
} from '@musicscale-live/domain';

export interface SceneExecutorOptions {
  executeCommand: (command: LiveCommand) => Promise<CommandResult[]>;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
}

function defaultSleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function normalizeOffset(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(60_000, Math.round(value || 0)));
}

function sceneCommand(
  request: SceneExecutionRequest,
  action: SceneExecutionRequest['scene']['actions'][number]
): LiveCommand {
  return {
    id: `${request.id}:${action.id}`,
    correlationId: request.correlationId,
    organizationId: request.organizationId,
    venueId: request.venueId,
    liveSystemId: request.liveSystemId,
    liveSessionId: request.liveSessionId,
    serviceItemId: request.serviceItemId,
    actorId: request.actorId,
    origin: request.origin,
    capability: action.capability,
    targetProviderIds: action.targetProviderIds,
    outputTargets: action.outputTargets,
    payload: action.payload,
    idempotencyKey: `${request.idempotencyKey}:${action.id}`,
    createdAt: new Date().toISOString(),
    safetyLevel: action.safetyLevel
  };
}

/**
 * Executes every scene action against the same scene-start clock.
 *
 * This deliberately does not pretend providers are transactional. Live systems
 * are physically distributed, so the result reports completed/partial/failed
 * from observed command acknowledgements instead of claiming atomicity.
 */
export class SceneExecutor {
  private readonly executeCommand: SceneExecutorOptions['executeCommand'];
  private readonly sleep: NonNullable<SceneExecutorOptions['sleep']>;
  private readonly now: NonNullable<SceneExecutorOptions['now']>;

  constructor(options: SceneExecutorOptions) {
    this.executeCommand = options.executeCommand;
    this.sleep = options.sleep || defaultSleep;
    this.now = options.now || (() => new Date());
  }

  async execute(request: SceneExecutionRequest): Promise<SceneExecutionResult> {
    const startedAt = this.now().toISOString();

    const actions = await Promise.all(
      request.scene.actions.map(async action => {
        const offsetMs = normalizeOffset(action.offsetMs);
        await this.sleep(offsetMs);
        const results = await this.executeCommand(sceneCommand(request, action));
        return {
          actionId: action.id,
          offsetMs,
          results
        };
      })
    );

    const flatResults = actions.flatMap(action => action.results);
    const accepted = flatResults.filter(result => result.accepted).length;
    const rejected = flatResults.length - accepted;

    const status: SceneExecutionResult['status'] =
      accepted === 0
        ? 'failed'
        : rejected === 0
          ? 'completed'
          : 'partial';

    return {
      sceneId: request.scene.id,
      correlationId: request.correlationId,
      status,
      startedAt,
      completedAt: this.now().toISOString(),
      actions
    };
  }
}
