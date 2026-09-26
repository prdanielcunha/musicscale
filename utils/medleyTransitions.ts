import { getSignedSemitones, isValidKey } from './chordEngine';

export interface MedleyTransitionHint {
  mode: 'direct' | 'hold' | 'pause' | 'free';
  semitones?: number;
  bpmDelta?: number;
}

/** Advisory only: never changes a chart, key, tempo or playback automatically. */
export function suggestMedleyTransition(from: { key?: string; bpm?: number }, to: { key?: string; bpm?: number }): MedleyTransitionHint {
  const semitones = from.key && to.key && isValidKey(from.key) && isValidKey(to.key)
    ? getSignedSemitones(from.key, to.key).signedSemitones : undefined;
  const bpmDelta = Number.isFinite(from.bpm) && Number.isFinite(to.bpm) && from.bpm! > 0 && to.bpm! > 0
    ? to.bpm! - from.bpm! : undefined;
  const significantTempoChange = bpmDelta !== undefined && Math.abs(bpmDelta) >= 20;
  const significantKeyChange = semitones !== undefined && Math.abs(semitones) > 2;
  return { mode: significantTempoChange ? 'pause' : significantKeyChange ? 'hold' : 'direct',
    ...(semitones !== undefined ? { semitones } : {}), ...(bpmDelta !== undefined ? { bpmDelta } : {}) };
}
