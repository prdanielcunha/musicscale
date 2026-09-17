import { describe, expect, it } from 'vitest';
import { normalizeChordDocumentStructure } from '../../utils/chordDocumentNormalizer';

describe('chord source preservation regression', () => {
  it('preserves repeated verses and their independent chord rows', () => {
    const source = 'C        G\nSanto, santo\n\nAm       F\nSanto, santo';
    expect(normalizeChordDocumentStructure(source)).toBe(source);
  });

  it('preserves underscore prolongations and exact horizontal columns', () => {
    const source = 'C             G\nSe___nhor eu te amo';
    expect(normalizeChordDocumentStructure(source)).toBe(source);
  });

  it('repairs only proven corrupt rich-copy chord prefixes', () => {
    expect(normalizeChordDocumentStructure('&gt; C   G\nSenhor')).toBe('C   G\nSenhor');
  });
});
