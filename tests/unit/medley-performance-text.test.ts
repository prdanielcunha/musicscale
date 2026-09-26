import { describe, expect, it } from 'vitest';
import type { MedleyExcerpt } from '../../types';
import { medleyPerformanceText } from '../../utils/medleyPerformanceText';

const excerpt = (patch: Partial<MedleyExcerpt> = {}): MedleyExcerpt => ({
  id: 'step', songId: 'song', sourceRevision: 'hash', startLine: 0, endLine: 1,
  title: 'Song', repetitions: 1, sourceKey: 'G', key: 'A', snapshot: 'G   D/F#   Em   C\nPromessa', ...patch,
});

describe('medley performance text', () => {
  it('transposes the rendered chord excerpt and preserves the approved source', () => {
    const step = excerpt();
    expect(medleyPerformanceText(step)).toContain('A   E/G#   F#m   D');
    expect(step.snapshot).toBe('G   D/F#   Em   C\nPromessa');
  });
  it('does not silently transpose tabs or change major/minor mode', () => {
    expect(() => medleyPerformanceText(excerpt({ tabs: [{ section: 'Solo', content: 'e|--3--' }] }))).toThrow('Unsafe');
    expect(() => medleyPerformanceText(excerpt({ key: 'Am' }))).toThrow('Unsafe');
  });
  it('keeps legacy excerpts unchanged', () => {
    expect(medleyPerformanceText(excerpt({ sourceKey: undefined, key: 'G' }))).toBe(excerpt().snapshot);
  });
});
