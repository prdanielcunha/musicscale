import { describe, expect, it } from 'vitest';
import {
  isChordOnlyCandidate,
  normalizeChordDocumentStructure,
} from '../../utils/chordDocumentNormalizer';
import { parseChordsAndLyrics } from '../../components/songs/ChordsRenderer';

describe('chord document formatting repair', () => {
  it('repairs the Creio Que Tu És a Cura corruption fingerprint without inventing content', () => {
    const corrupted = `[Primeira Parte]

">A9

[Primeira Parte]

Me escutas quando clamo
">E
Me escutas quando clamo

A9      B4
E acalma o meu pensar
">E
E acalma o meu pensar

B4
Me levas pelo fogo
">C#m7
Me levas pelo fogo

A9
Curando todo meu ser
">B4
Curando todo meu ser`;

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

  it('recognizes the recovered chord forms from the reported screen', () => {
    expect(isChordOnlyCandidate('A9')).toBe(true);
    expect(isChordOnlyCandidate('E')).toBe(true);
    expect(isChordOnlyCandidate('C#m7')).toBe(true);
    expect(isChordOnlyCandidate('B4')).toBe(true);
  });

  it('feeds the repaired legacy chart to the renderer parser', () => {
    const parsed = parseChordsAndLyrics(
      '[Primeira Parte]\n\n">A9\n\n[Primeira Parte]\n\nMe escutas quando clamo\n">E\nMe escutas quando clamo',
    );

    expect(parsed.filter((line) => line.type === 'section')).toHaveLength(1);
    expect(parsed.some((line) => line.type === 'chord' && line.content === 'A9')).toBe(true);
    expect(parsed.some((line) => line.type === 'chord' && line.content === 'E')).toBe(true);
    expect(parsed.filter((line) => line.content === 'Me escutas quando clamo')).toHaveLength(1);
  });
});
