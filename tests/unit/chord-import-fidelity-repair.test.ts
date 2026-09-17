import { describe, expect, it } from 'vitest';
import { repairChordImportFidelity } from '../../utils/chordImportFidelityRepair';
import { normalizePastedSongText, normalizeSongClipboardPaste } from '../../utils/textNormalizer';
import { transposeChordLinePreserveSpacing, transposeChordDocument } from '../../utils/chordEngine';

describe('source row and column fidelity', () => {
  it('does not delete a repeated chorus or merge its different harmonies', () => {
    const chorus = '[Refrão]\nG#m7    D#m7    E9    B\nLinha repetida\nG#m7    D#m7    F#/A#    E9    B\nLinha repetida';
    expect(repairChordImportFidelity(chorus)).toBe(chorus);
    expect(normalizePastedSongText('[Intro]\n">F#4\n' + chorus).text).toContain(chorus);
  });
  it('does not guess that adjacent chord rows are fragments or invent sections', () => {
    const input = 'G    D\nEm    C\n\n[Verso]\nG\nD\nUma linha\n( G C\nD )';
    expect(repairChordImportFidelity(input)).toBe(input);
  });
  it('prefers preformatted HTML over the mobile clipboard reflow', () => {
    const source = '[Verso]\nG#m7                 E9\n    Uma linha original\n                     B\nOutra linha\nG   D\nRepetida\nEm  C\nRepetida';
    const html = '<pre>' + source.replace('E9', '<b>E9</b>').replace(/\n/g, '<br>') + '</pre>';
    expect(normalizeSongClipboardPaste('texto sem posições', html).text).toBe(source);
  });
  it('retains plain text when HTML has no unambiguous preformatted chart', () => {
    expect(normalizeSongClipboardPaste('G    C\nLetra', '<div>G C Letra</div>').text).toBe('G    C\nLetra');
  });
  it('preserves syllable extender columns even when other paste noise is repaired', () => {
    const input = '[Intro]\n">D\n[Verso]\nG       C\nCan___tar';
    expect(normalizePastedSongText(input).text).toContain('G       C\nCan___tar');
  });
  it('anchors subsequent chords when transposed names change width', () => {
    const source = 'Em7        C9         G        D4';
    const expected = 'G#m7       E9         B        F#4';
    expect(transposeChordLinePreserveSpacing(source, 4)).toBe(expected);
    expect(transposeChordDocument(source, 'Em', 'G#m').chords).toBe(expected);
    expect(transposeChordDocument(expected, 'G#m', 'Em').chords).toBe(source);
  });
});
