import { describe, expect, it } from 'vitest';
import {
  isChordOnlyCandidate,
  normalizeChordDocumentStructure,
} from '../../utils/chordDocumentNormalizer';
import { transposeChordDocument } from '../../utils/chordEngine';
import { normalizePastedSongText } from '../../utils/textNormalizer';

describe('chord document source-fidelity normalization', () => {
  it('removes proven rich-copy corruption without deduplicating repeated sections or lyrics', () => {
    const source = `[Primeira Parte]\n\n\">A9\n\n[Primeira Parte]\n\nMe escutas quando clamo\n\">E\nMe escutas quando clamo`;
    const repaired = normalizeChordDocumentStructure(source);
    expect(repaired).not.toContain('\">');
    expect(repaired.match(/\[Primeira Parte\]/g)).toHaveLength(2);
    expect(repaired.match(/Me escutas quando clamo/g)).toHaveLength(2);
    expect(repaired).toContain('A9');
    expect(repaired).toContain('E');
  });

  it('keeps inline section/chord rows and horizontal spacing exactly as supplied', () => {
    const source = `[Intro] Em7  C9  G\n\">D4\n\n        Em7  C9  G\n\n[Primeira Parte]\nEm7    C9\n    Deus de Abraão`;
    const { text, transformations } = normalizePastedSongText(source);
    expect(transformations).toContain('normalized_chord_structure');
    expect(text).toContain('[Intro] Em7  C9  G');
    expect(text).toContain('        Em7  C9  G');
    expect(text).toContain('Em7    C9');
    expect(text).toContain('    Deus de Abraão');
    expect(text).not.toContain('\">');
  });

  it('preserves lyric prolongation underscores because they are musical source content', () => {
    const source = '[Refrão]\nEm7  Bm7  D/F#  C9  G\nCan___tar sem ruído';
    expect(normalizeChordDocumentStructure(source)).toBe(source);
  });

  it('preserves valid horizontal chord alignment', () => {
    const valid = '[Verso]\nE      B/D#      C#m\nQuem é esse que vem';
    expect(normalizeChordDocumentStructure(valid)).toBe(valid);
  });

  it('does not remove a normal lyric beginning with a blockquote marker', () => {
    const lyric = '[Verso]\n> Eu te seguirei por onde fores';
    expect(normalizeChordDocumentStructure(lyric)).toContain('> Eu te seguirei por onde fores');
  });

  it('does not deduplicate intentional repeated lyrics without the corruption marker', () => {
    const repeated = '[Refrão]\nSanto\nSanto';
    const repaired = normalizeChordDocumentStructure(repeated);
    expect(repaired.match(/Santo/g)).toHaveLength(2);
  });

  it('recognizes common worship chord forms', () => {
    for (const chord of ['A9', 'E', 'C#m7', 'B4', 'D4', 'C9', 'G']) {
      expect(isChordOnlyCandidate(chord)).toBe(true);
    }
  });

  it('removes invisible clipboard noise without moving horizontal chord alignment', () => {
    const dirty = '\uFEFF[Verso]\r\nE\u00A0\u00A0\u00A0\u00A0B/D#\u200B\r\nQuem\u2060 é esse que vem\u0007';
    const { text, wasDecoded, transformations } = normalizePastedSongText(dirty);
    expect(wasDecoded).toBe(true);
    expect(text).toBe('[Verso]\nE    B/D#\nQuem é esse que vem');
    expect(transformations).toContain('normalized_line_breaks');
    expect(transformations).toContain('normalized_unicode_spaces');
    expect(transformations).toContain('removed_invisible_characters');
    expect(transformations).toContain('removed_control_characters');
  });

  it('preserves intentional repeated lyrics while sanitizing paste noise', () => {
    const dirty = '[Refrão]\nSanto\u200B\nSanto';
    const { text } = normalizePastedSongText(dirty);
    expect(text).toBe('[Refrão]\nSanto\nSanto');
    expect(text.match(/Santo/g)).toHaveLength(2);
  });

  it('transposes chord rows without changing their spacing', () => {
    const transposed = transposeChordDocument('Em7  Bm7  D/F#  C9  G', 'Em', 'G#m');
    expect(transposed.chords).toBe('G#m7  D#m7  F#/A#  E9  B');
  });
});
