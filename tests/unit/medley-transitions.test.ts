import { describe, expect, it } from 'vitest';
import { suggestMedleyTransition } from '../../utils/medleyTransitions';

describe('medley transition hints', () => {
  it('stays conservative when metadata is absent', () => {
    expect(suggestMedleyTransition({}, {})).toEqual({ mode: 'direct' });
  });
  it('suggests a pause for a substantial tempo change without changing playback', () => {
    expect(suggestMedleyTransition({ key: 'C', bpm: 70 }, { key: 'D', bpm: 104 })).toEqual({ mode: 'pause', semitones: 2, bpmDelta: 34 });
  });
  it('suggests holding a distant key change', () => {
    expect(suggestMedleyTransition({ key: 'C', bpm: 80 }, { key: 'F', bpm: 85 })).toEqual({ mode: 'hold', semitones: 5, bpmDelta: 5 });
  });
});
