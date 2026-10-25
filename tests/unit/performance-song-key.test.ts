import { describe, it, expect } from 'vitest';
import { applyScaleSongSettings } from '../../utils/scaleSongSettings';
import { buildPerformanceSongKeyPatch } from '../../utils/performanceSongKey';
import { transposeChordDocument, validateTransposedPreview, validateChordContentKeyConsistency } from '../../utils/chordEngine';

const song = {
  id: 's1', organizationId: 'org', selectedKey: 'Bb', key: 'Bb', originalKey: 'G',
  chords: '[Intro] C9  D6(11)\nC9  D6(11) G/B\nPalavras preservadas\nC9 D11 G',
  metadata: { chordContentKey: 'G', shapeKey: 'G', capo: 3, normalizedToConcertKey: false },
} as any;

describe('written key vs selected performance key', () => {
  it('preserves lyric A/E/Em and handles attached ChordPro separately from lyrics', () => {
    const source = '[Intro] C9\nC G Am F\nA tua presença\nE eu te amo\nEm teus braços\n[C]A tua [G]presença';
    const result = transposeChordDocument(source, 'C', 'D').chords;
    expect(result).toBe('[Intro] D9\nD A Bm G\nA tua presença\nE eu te amo\nEm teus braços\n[D]A tua [A]presença');
    expect(validateTransposedPreview(source, result, 'C', 'D').valid).toBe(true);
    expect(validateTransposedPreview(source, result.replace('A tua presença', 'B tua presença'), 'C', 'D').valid).toBe(false);
  });
  it('uses the written source, including extended chords and slash bass, without changing the original', () => {
    const before = JSON.stringify(song);
    const display = applyScaleSongSettings(song, { key: 'Bb' });
    expect(display.chords).toContain('Eb9  F6(11)');
    expect(display.chords).toContain('Bb/D');
    expect(display.chords).toContain('Palavras preservadas');
    expect(display.metadata.chordContentKey).toBe('Bb');
    expect(JSON.stringify(song)).toBe(before);
  });
  it('is idempotent when populated scales are adapted a second time', () => {
    const once = applyScaleSongSettings(song, { key: 'Bb', bpm: 85 });
    expect(applyScaleSongSettings(once, { key: 'Bb', bpm: 85 })).toEqual(once);
  });
  it('normalizes a repertoire viewer even with no schedule override', () => {
    expect(applyScaleSongSettings(song).chords).toContain('Eb9  F6(11)');
  });
  it('keeps original/import provenance while saving a coherent repertoire chart', () => {
    const patch = buildPerformanceSongKeyPatch(song, 'A');
    expect(patch.key).toBe('A');
    expect(patch.selectedKey).toBe('A');
    expect(patch.chords).toContain('D9  E6(11)');
    expect(patch.chords).toContain('A/C#');
    expect(patch).not.toHaveProperty('originalKey');
    expect(patch.metadata).toMatchObject({ chordContentKey: 'A', shapeKey: 'G', capo: 3, normalizedToConcertKey: true });
  });
  it('does not apply capo twice after content has been normalized', () => {
    const saved = { ...song, ...buildPerformanceSongKeyPatch(song, 'A') };
    expect(applyScaleSongSettings(saved).chords).toBe(saved.chords);
  });
  it('requires review before storing an unconfirmed capo shape or a strong source mismatch', () => {
    expect(() => buildPerformanceSongKeyPatch({ ...song, metadata: { shapeKey: 'G', capo: 3 } }, 'A')).toThrow('CHORD_KEY_REVIEW_REQUIRED');
    expect(() => buildPerformanceSongKeyPatch({ ...song, key: 'F#', selectedKey: 'F#', metadata: {}, chords: 'C G Am F C G Am F' }, 'G')).toThrow('CHORD_KEY_REVIEW_REQUIRED');
  });
  it('preserves minor quality through storage and rejects invalid keys', () => {
    const minor = { ...song, selectedKey: 'Em', metadata: { chordContentKey: 'Em' }, chords: 'Em Am B7 Em' };
    expect(buildPerformanceSongKeyPatch(minor, 'F#m').chords).toBe('F#m Bm C#7 F#m');
    expect(() => buildPerformanceSongKeyPatch(song, 'unknown')).toThrow('INVALID_CHORD_KEY');
  });
  it('flags a strong legacy mismatch without claiming chromatic harmony is invalid', () => {
    expect(validateChordContentKeyConsistency('C G Am F C G Am F', 'F#').status).toBe('MISMATCH');
    expect(validateChordContentKeyConsistency('C F D7 G C', 'C').status).not.toBe('MISMATCH');
  });
});
