import { describe, expect, it } from 'vitest';
import type {
  CommandResult,
  LiveCommand,
  SceneExecutionRequest
} from '@musicscale-live/domain';
import { SceneExecutor } from '../src/sceneExecutor';

function request(): SceneExecutionRequest {
  return {
    id: 'scene-run-1',
    correlationId: 'corr-1',
    organizationId: 'org-1',
    venueId: 'venue-1',
    liveSystemId: 'system-1',
    liveSessionId: 'session-1',
    serviceItemId: 'item-1',
    actorId: 'operator-1',
    origin: 'live-ui',
    idempotencyKey: 'scene-idem-1',
    scene: {
      id: 'scene-1',
      organizationId: 'org-1',
      venueId: 'venue-1',
      liveSystemId: 'system-1',
      name: 'Song + visual',
      actions: [
        {
          id: 'presentation',
          capability: 'songs.present',
          targetProviderIds: ['holyrics-primary'],
          outputTargets: ['main'],
          payload: { id: 'song-44' },
          safetyLevel: 'normal'
        },
        {
          id: 'visual',
          capability: 'visual.clip.trigger',
          targetProviderIds: ['resolume-primary'],
          outputTargets: ['main'],
          payload: { clipId: 'clip-9' },
          safetyLevel: 'normal',
          offsetMs: 120
        }
      ]
    }
  };
}

describe('SceneExecutor', () => {
  it('keeps provider-specific coordination inside neutral commands', async () => {
    const commands: LiveCommand[] = [];
    const sleeps: number[] = [];
    const executor = new SceneExecutor({
      sleep: async ms => { sleeps.push(ms); },
      now: () => new Date('2026-09-18T21:30:00.000Z'),
      executeCommand: async command => {
        commands.push(command);
        return [{
          commandId: command.id,
          providerInstanceId: command.targetProviderIds[0] || 'provider',
          accepted: true,
          latencyMs: 3
        }];
      }
    });

    const result = await executor.execute(request());

    expect(result.status).toBe('completed');
    expect(sleeps).toEqual([0, 120]);
    expect(commands.map(command => command.capability)).toEqual(
      expect.arrayContaining(['songs.present', 'visual.clip.trigger'])
    );
    expect(commands.every(command => command.correlationId === 'corr-1')).toBe(true);
    expect(commands[1]?.idempotencyKey).toBe('scene-idem-1:visual');
  });

  it('reports partial instead of pretending distributed providers are atomic', async () => {
    const executor = new SceneExecutor({
      sleep: async () => {},
      executeCommand: async command => {
        const accepted = command.capability === 'songs.present';
        return [{
          commandId: command.id,
          providerInstanceId: command.targetProviderIds[0] || 'provider',
          accepted,
          latencyMs: 2,
          errorCode: accepted ? undefined : 'provider_timeout',
          recoverable: !accepted
        } satisfies CommandResult];
      }
    });

    const result = await executor.execute(request());
    expect(result.status).toBe('partial');
  });
});
