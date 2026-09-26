import { describe, expect, it } from 'vitest';
import { selectMedleyLines, suggestMedleySegments } from '../../utils/medleySegments';

describe('medley source selection', () => {
  it('keeps material before the first section and exact CRLF columns', () => {
    const chart = 'G#m7       E9\r\n  Palavra  aqui\r\n[Refrão] F#4\r\nE|--4--5--|';
    const segments = suggestMedleySegments(chart);
    expect(segments.map(s => [s.startLine, s.endLine])).toEqual([[0, 1], [2, 3]]);
    expect(selectMedleyLines(chart, 0, 1)).toBe('G#m7       E9\r\n  Palavra  aqui');
    expect(selectMedleyLines(chart, 2, 3)).toBe('[Refrão] F#4\r\nE|--4--5--|');
  });

  it('offers manual line ranges even without sections or blank paragraphs', () => {
    const chart = 'C     G\nPrimeira linha\nAm     F\nOutra linha';
    expect(suggestMedleySegments(chart)).toEqual([{ id: 'whole', startLine: 0, endLine: 3, source: 'whole' }]);
    expect(selectMedleyLines(chart, 2, 3)).toBe('Am     F\nOutra linha');
  });

  it('does not merge similar refrains, tabs or repeated occurrences', () => {
    const chart = '[Refrão]\nDeus é fiel\n\n[Refrão]\nDeus foi fiel\nE|--1--2--|';
    expect(suggestMedleySegments(chart)).toHaveLength(2);
    expect(selectMedleyLines(chart, 3, 5)).toContain('E|--1--2--|');
    expect(() => selectMedleyLines(chart, -1, 2)).toThrow(RangeError);
  });
});
