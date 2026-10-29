import { describe, expect, it } from 'vitest';
import { getMusicalKeyOptions } from '../../utils/musicalKeyOptions';
import { areKeysEnharmonicallyEquivalent, isValidKey } from '../../utils/chordEngine';

describe('AI import musical key options', () => {
  it('offers exactly twelve major and twelve minor pitches without equivalent duplicates', () => {
    const options = getMusicalKeyOptions();
    expect(options).toHaveLength(24);
    expect(options.filter(option => option.value.endsWith('m'))).toHaveLength(12);
    options.forEach((option, index) => {
      expect(isValidKey(option.value)).toBe(true);
      options.slice(index + 1).forEach(other => {
        expect(areKeysEnharmonicallyEquivalent(option.value, other.value)).toBe(false);
      });
    });
  });

  it.each(['Db', 'Gb', 'D#', 'G#', 'A#', 'Dbm', 'Gbm', 'D#m', 'Abm', 'A#m', 'D♭', 'F♯m'])(
    'preserves an existing %s selection as a single option with both spellings', selected => {
      const options = getMusicalKeyOptions(selected);
      const matches = options.filter(option => areKeysEnharmonicallyEquivalent(option.value, selected));
      expect(matches).toHaveLength(1);
      expect(matches[0].value).toBe(selected);
      expect(matches[0].label).toContain(' / ');
    },
  );
});
