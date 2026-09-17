import { describe, expect, it } from 'vitest';
import { transposeChordDocument } from '../../utils/chordEngine';
import { normalizePastedSongText } from '../../utils/textNormalizer';

describe('AI chord import source fidelity regression', () => {
  it('keeps recovered intro content before a duplicated section boundary', () => {
    const corrupted = `Teste de Integridade
Equipe Teste

Tom: G#m (com forma de Em)Capotraste: 4ª casa

[Intro] Em7  C9  G
\">D4

        Em7  C9  G

[Primeira Parte]
\">D4
[Primeira Parte]

Em7
Linha sintética um

[Refrão]
\">D4
Vai acontecer
[Refrão]

Em7  Bm7  D/F#  C9  G
Can___tar sem ruído`;

    const { text, transformations } = normalizePastedSongText(corrupted);

    expect(transformations).toContain('normalized_chord_structure');

    const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
    const introIndex = lines.indexOf('[Intro]');
    const firstPartIndex = lines.indexOf('[Primeira Parte]');

    expect(introIndex).toBeGreaterThanOrEqual(0);
    expect(firstPartIndex).toBeGreaterThan(introIndex);
    expect(lines.slice(introIndex + 1, firstPartIndex)).toEqual([
      'Em7  C9  G',
      'D4',
      'Em7  C9  G',
      'D4',
    ]);
    expect(text.match(/\[Primeira Parte\]/g)).toHaveLength(1);
    expect(text.match(/\[Refrão\]/g)).toHaveLength(1);
    expect(text).toContain('Cantar sem ruído');
    expect(text).toContain('Em7  Bm7  D/F#  C9  G');

    const transposed = transposeChordDocument('Em7  Bm7  D/F#  C9  G', 'Em', 'G#m');
    expect(transposed.chords).toBe('G#m7  D#m7  F#/A#  E9  B');
  });
});
