import type { LiveWorshipMedleyTarget, ScaleMedley } from '../types';

export function resolveMedleyDirection(medley: ScaleMedley, publishRevision: number | undefined,
  target: LiveWorshipMedleyTarget | null | undefined, lastSequence: number,
  isFollowing: boolean): { index: number; round: number; sequence: number } | null {
  if (!isFollowing || !target || target.medleyId !== medley.id ||
      target.publishRevision !== publishRevision || !Number.isInteger(target.sequence) ||
      target.sequence <= lastSequence) return null;
  const index = medley.steps.findIndex(step => step.id === target.stepId);
  if (index < 0 || !Number.isInteger(target.round) || target.round < 1 || target.round > medley.steps[index].repetitions) return null;
  return { index, round: target.round, sequence: target.sequence };
}
