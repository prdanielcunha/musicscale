import { describe, expect, it } from 'vitest';
import {
  extractLyricsFromCanonicalChordDocument,
  isChordOnlyCandidate,
  normalizeChordDocumentStructure,
} from '../../utils/chordDocumentNormalizer';
import { normalizePastedSongText } from '../../utils/textNormalizer';
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

  it('repairs the Promessas production fingerprint before AI processing', () => {
    const corrupted = `Promessas (part. Samuel Messias)
Sarah Beatriz

Tom: G#m (com forma de Em)Capotraste: 4ª casa

[Intro] Em7  C9  G
">D4

        Em7  C9  G

[Primeira Parte]

">D4

[Primeira Parte]

Em7
    Deus de Abraão

">C9

    Deus de Abraão

Sei que nunca quebrará

">G

Sei que nunca quebrará`;

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

  it('builds clean lyrics from the canonical Promessas chord document', () => {
    const corrupted = `[Intro] Em7 C9 G
">D4

[Primeira Parte]

Em7
Deus de Abraão
">C9
Deus de Abraão

Sei que nunca quebrará
">G
Sei que nunca quebrará`;

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
      '[Primeira Parte]\n\n">A9\n\n[Primeira Parte]\n\nMe escutas quando clamo\n">E\nMe escutas quando clamo',
    );

    expect(parsed.filter((line) => line.type === 'section')).toHaveLength(1);
    expect(parsed.some((line) => line.type === 'chord' && line.content === 'A9')).toBe(true);
    expect(parsed.some((line) => line.type === 'chord' && line.content === 'E')).toBe(true);
    expect(parsed.filter((line) => line.content === 'Me escutas quando clamo')).toHaveLength(1);
  });
});
