import { describe, expect, it } from 'vitest';
import {
  extractLyricsFromCanonicalChordDocument,
  isChordOnlyCandidate,
  normalizeChordDocumentStructure,
} from '../../utils/chordDocumentNormalizer';
import { transposeChordDocument } from '../../utils/chordEngine';
import { normalizePastedSongText } from '../../utils/textNormalizer';
import { parseChordsAndLyrics } from '../../components/songs/ChordsRenderer';

describe('chord document formatting repair', () => {
  it('repairs the Creio Que Tu És a Cura corruption fingerprint without inventing content', () => {
    const corrupted = `[Primeira Parte]\n\n\">A9\n\n[Primeira Parte]\n\nMe escutas quando clamo\n\">E\nMe escutas quando clamo\n\nA9      B4\nE acalma o meu pensar\n\">E\nE acalma o meu pensar\n\nB4\nMe levas pelo fogo\n\">C#m7\nMe levas pelo fogo\n\nA9\nCurando todo meu ser\n\">B4\nCurando todo meu ser`;

    const repaired = normalizeChordDocumentStructure(corrupted);

    expect(repaired).not.toContain('\">');
    expect(repaired.match(/\[Primeira Parte\]/g)).toHaveLength(1);
    expect(repaired).toContain('A9      B4');
    expect(repaired).toContain('E\nMe escutas quando clamo');
    expect(repaired).toContain('C#m7\nMe levas pelo fogo');
    expect(repaired).toContain('B4\nCurando todo meu ser');
    expect(repaired.match(/Me escutas quando clamo/g)).toHaveLength(1);
    expect(repaired.match(/E acalma o meu pensar/g)).toHaveLength(1);
    expect(repaired.match(/Me levas pelo fogo/g)).toHaveLength(1);
    expect(repaired.match(/Curando todo meu ser/g)).toHaveLength(1);
  });

  it('repairs the Promessas production fingerprint before AI processing', () => {
    const corrupted = `Promessas (part. Samuel Messias)\nSarah Beatriz\n\nTom: G#m (com forma de Em)Capotraste: 4ª casa\n\n[Intro] Em7  C9  G\n\">D4\n\n        Em7  C9  G\n\n[Primeira Parte]\n\n\">D4\n\n[Primeira Parte]\n\nEm7\n    Deus de Abraão\n\n\">C9\n\n    Deus de Abraão\n\nSei que nunca quebrará\n\n\">G\n\nSei que nunca quebrará`;

    const { text, wasDecoded, transformations } = normalizePastedSongText(corrupted);

    expect(wasDecoded).toBe(true);
    expect(transformations).toContain('normalized_chord_structure');
    expect(text).not.toContain('\">');
    expect(text).toContain('[Intro]\nEm7  C9  G');
    expect(text.match(/\[Primeira Parte\]/g)).toHaveLength(1);
    expect(text.match(/Deus de Abraão/g)).toHaveLength(1);
    expect(text.match(/Sei que nunca quebrará/g)).toHaveLength(1);
    expect(text).toContain('C9\n    Deus de Abraão');
    expect(text).toContain('G\nSei que nunca quebrará');
  });

  it('keeps stranded recovered content before section boundaries and preserves exact chord tokens', () => {
    const corrupted = `Teste de Integridade\nEquipe Teste\n\nTom: G#m (com forma de Em)Capotraste: 4ª casa\n\n[Intro] Em7  C9  G\n\">D4\n\n        Em7  C9  G\n\n[Primeira Parte]\n\">D4\n[Primeira Parte]\n\nEm7\nLinha sintética um\n\n[Pré-Refrão]\nG\nLinha sintética dois\n\n[Refrão]\n\">D4\nVai acontecer\n[Refrão]\n\nEm7  Bm7  D/F#  C9  G\nCan___tar sem ruído`;

    const { text, transformations } = normalizePastedSongText(corrupted);
    expect(transformations).toContain('normalized_chord_structure');
    expect(text).not.toContain('___');
    expect(text).toContain('Cantar sem ruído');

    const repairedLines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const firstPartIndex = repairedLines.indexOf('[Primeira Parte]');
    expect(firstPartIndex).toBeGreaterThan(0);
    expect(repairedLines.slice(0, firstPartIndex).filter((line) => line === 'D4')).toHaveLength(2);
    expect(text.match(/\[Primeira Parte\]/g)).toHaveLength(1);

    const chorusIndex = repairedLines.indexOf('[Refrão]');
    expect(chorusIndex).toBeGreaterThan(1);
    expect(repairedLines[chorusIndex - 2]).toBe('D4');
    expect(repairedLines[chorusIndex - 1]).toBe('Vai acontecer');
    expect(text.match(/\[Refrão\]/g)).toHaveLength(1);
    expect(text).toContain('Em7  Bm7  D/F#  C9  G');

    const transposed = transposeChordDocument('Em7  Bm7  D/F#  C9  G', 'Em', 'G#m');
    expect(transposed.chords).toBe('G#m7  D#m7  F#/A#  E9  B');
  });

  it('preserves an already concert-key corrupted chart without changing chord spelling or order', () => {
    const corrupted = `Teste Concert\nEquipe Teste\n\nTom: G#m\n\n[Intro] G#m7  E9  B\n\">F#4\n\n        G#m7  E9  B\n\n[Primeira Parte]\n\">F#4\n[Primeira Parte]\n\nG#m7  D#m7  F#/A#  E9  B\nLinha sintética`;

    const { text, transformations } = normalizePastedSongText(corrupted);
    expect(transformations).toContain('normalized_chord_structure');

    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const introIndex = lines.indexOf('[Intro]');
    const firstPartIndex = lines.indexOf('[Primeira Parte]');
    expect(introIndex).toBeGreaterThanOrEqual(0);
    expect(firstPartIndex).toBeGreaterThan(introIndex);
    expect(lines.slice(introIndex + 1, firstPartIndex)).toEqual([
      'G#m7  E9  B',
      'F#4',
      'G#m7  E9  B',
      'F#4',
    ]);
    expect(text.match(/\[Primeira Parte\]/g)).toHaveLength(1);
    expect(text).toContain('G#m7  D#m7  F#/A#  E9  B');
  });

  it('builds clean lyrics from the canonical Promessas chord document', () => {
    const corrupted = `[Intro] Em7 C9 G\n\">D4\n\n[Primeira Parte]\n\nEm7\nDeus de Abraão\n\">C9\nDeus de Abraão\n\nSei que nunca quebrará\n\">G\nSei que nunca quebrará`;

    const lyrics = extractLyricsFromCanonicalChordDocument(corrupted);

    expect(lyrics).not.toContain('\">');
    expect(lyrics).not.toMatch(/^\s*(?:Em7|C9|G|D4)\s*$/m);
    expect(lyrics.match(/Deus de Abraão/g)).toHaveLength(1);
    expect(lyrics.match(/Sei que nunca quebrará/g)).toHaveLength(1);
    expect(lyrics).toContain('[Primeira Parte]');
  });

  it('preserves valid horizontal chord alignment', () => {
    const valid = '[Verso]\nE      B/D#      C#m\nQuem é esse que vem';
    const repaired = normalizeChordDocumentStructure(valid);

    expect(repaired).toContain('E      B/D#      C#m');
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

  it('recognizes the recovered chord forms from the reported screens', () => {
    expect(isChordOnlyCandidate('A9')).toBe(true);
    expect(isChordOnlyCandidate('E')).toBe(true);
    expect(isChordOnlyCandidate('C#m7')).toBe(true);
    expect(isChordOnlyCandidate('B4')).toBe(true);
    expect(isChordOnlyCandidate('D4')).toBe(true);
    expect(isChordOnlyCandidate('C9')).toBe(true);
    expect(isChordOnlyCandidate('G')).toBe(true);
  });

  it('feeds the repaired legacy chart to the renderer parser', () => {
    const parsed = parseChordsAndLyrics(
      '[Primeira Parte]\n\n\">A9\n\n[Primeira Parte]\n\nMe escutas quando clamo\n\">E\nMe escutas quando clamo',
    );

    expect(parsed.filter((line) => line.type === 'section')).toHaveLength(1);
    expect(parsed.some((line) => line.type === 'chord' && line.content === 'A9')).toBe(true);
    expect(parsed.some((line) => line.type === 'chord' && line.content === 'E')).toBe(true);
    expect(parsed.filter((line) => line.content === 'Me escutas quando clamo')).toHaveLength(1);
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
});
