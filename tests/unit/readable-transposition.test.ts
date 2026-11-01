import { describe, expect, it } from 'vitest';
import { NOTES, FLAT_NOTES, getNotePitchClass, transposeChordDocument, transposeChordWithPreference } from '../../utils/chordEngine';

describe('stage-readable transposition', () => {
  it('transposes A to Db with flats, retaining chord quality and inversion', () => {
    expect(transposeChordDocument('A E/G# F#m7 D A7(b9)', 'A', 'Db').chords)
      .toBe('Db Ab/C Bbm7 Gb Db7(b9)');
  });
  it('repairs old theoretical spellings even without changing key', () => {
    expect(transposeChordDocument('B#m E#m C##7/B# Fb Cb\nTeu nome é sobre todos', 'C', 'C').chords)
      .toBe('Cm Fm D7/C E B\nTeu nome é sobre todos');
  });
  it('reads Unicode roots and basses without changing altered extensions', () => {
    expect(transposeChordWithPreference('C♯m7(♭5)/E♯', 2, false)).toBe('D#m7(b5)/G');
    expect(transposeChordWithPreference('C7(#11)/E', 2, false)).toBe('D7(#11)/F#');
  });
  it('keeps every root and bass at the exact interval for every pair of keys', () => {
    const roots = [...new Set([...NOTES, ...FLAT_NOTES, 'B#', 'E#', 'Cb', 'Fb', 'C##', 'Bbb'])];
    for (let from = 0; from < 12; from++) {
      for (let to = 0; to < 12; to++) {
        for (const root of roots) {
          const result = transposeChordDocument(`${root}m7/G#`, NOTES[from], FLAT_NOTES[to]).chords;
          const match = result.match(/^([A-G][#b]?)m7\/([A-G][#b]?)$/);
          expect(match, result).not.toBeNull();
          expect(getNotePitchClass(match![1])).toBe((getNotePitchClass(root) + to - from + 12) % 12);
          expect(getNotePitchClass(match![2])).toBe((8 + to - from + 12) % 12);
        }
      }
    }
  });
});
