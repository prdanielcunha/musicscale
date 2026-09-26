import type { MedleyExcerpt } from '../types';
import { isValidKey, normalizeKey, transposeChordDocument } from './chordEngine';

export function medleyRequiresTransposition(step: Pick<MedleyExcerpt, 'key' | 'sourceKey'>): boolean {
  return Boolean(step.key && step.sourceKey && normalizeKey(step.key) !== normalizeKey(step.sourceKey));
}

/** Transform only the rendered chord excerpt; never overwrite its approved source snapshot. */
export function medleyPerformanceText(step: MedleyExcerpt): string {
  if (!medleyRequiresTransposition(step)) return step.snapshot;
  if (!step.sourceKey || !step.key || !isValidKey(step.sourceKey) || !isValidKey(step.key) ||
      step.sourceKey.endsWith('m') !== step.key.endsWith('m') || step.tabs?.length) {
    throw new Error('Unsafe medley transposition');
  }
  return transposeChordDocument(step.snapshot, step.sourceKey, step.key).chords;
}
