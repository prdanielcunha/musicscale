import { describe, expect, it } from 'vitest';
import type { LiveWorshipMedleyTarget, ScaleMedley } from '../../types';
import { resolveMedleyDirection } from '../../utils/medleyDirection';

const medley: ScaleMedley = { id: 'm', anchorSongId: 'a', revision: 1, steps: [
  { id: 'a1', songId: 'a', sourceRevision: '1', startLine: 0, endLine: 0, title: 'A', repetitions: 2, snapshot: 'Am' },
  { id: 'b1', songId: 'b', sourceRevision: '1', startLine: 0, endLine: 0, title: 'B', repetitions: 1, snapshot: 'C' },
] };
const target: LiveWorshipMedleyTarget = { medleyId: 'm', stepId: 'a1', round: 2, publishRevision: 3,
  sequence: 8, commandId: 'c', timestamp: 1, actorId: 'leader' };

describe('medley direction recovery', () => {
  it('follows only a newer command for the exact published revision', () => {
    expect(resolveMedleyDirection(medley, 3, target, 7, true)).toEqual({ index: 0, round: 2, sequence: 8 });
    expect(resolveMedleyDirection(medley, 3, target, 8, true)).toBeNull();
    expect(resolveMedleyDirection(medley, 4, target, 0, true)).toBeNull();
    expect(resolveMedleyDirection(medley, 3, target, 0, false)).toBeNull();
  });
  it('rejects a missing step and an out-of-range repeat', () => {
    expect(resolveMedleyDirection(medley, 3, { ...target, stepId: 'missing' }, 0, true)).toBeNull();
    expect(resolveMedleyDirection(medley, 3, { ...target, round: 3 }, 0, true)).toBeNull();
  });
});
