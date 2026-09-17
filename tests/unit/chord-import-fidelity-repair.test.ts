import { describe, expect, it } from 'vitest';
import { repairChordImportFidelity } from '../../utils/chordImportFidelityRepair';
import { normalizePastedSongText } from '../../utils/textNormalizer';

const reportedMobilePaste = `Promessas (part. Samuel Messias)Sarah Beatriz

Tom:  G#m

[Intro] G#m7  E9  B
">F#4
        G#m7  E9  B

[Primeira Parte]

">F#4

[Primeira Parte]

G#m7
    Deus de Abraão
">E9
    Deus de Abraão
${' '.repeat(21)}
Sei que nunca quebrará
">B
Sei que nunca quebrará
${' '.repeat(18)}
A aliança que me fez
">F#4
A aliança que me fez

Que o que prometeu
">B
Que o que prometeu

Ele cumprirá

[Pré-Refrão]
">F#4
Ele cumprirá
[Pré-Refrão]

 G#m7    D#m7     E9
Fiel Tu és, Senhor a mim
">B
Fiel Tu és, Senhor a mim
 G#m7    D#m7  F#/A#  E9
Fiel Tu és, Se___nhor a mim
">B
Fiel Tu és, Se___nhor a mim

( G#m7  E9  B
">F# )
( G#m7  E9  B

[Segunda Parte]
">F# )
[Segunda Parte]`;

describe('AI chord import fidelity repair', () => {
  it('repairs the exact CifraClub iPhone corruption before AI processing', () => {
    const { text, transformations } = normalizePastedSongText(reportedMobilePaste);

    expect(transformations).toContain('repaired_chord_import_fidelity');
    expect(text).not.toContain('">');
    expect(text.match(/\[Intro\]/g)).toHaveLength(1);
    expect(text.match(/\[Primeira Parte\]/g)).toHaveLength(1);
    expect(text.match(/\[Pré-Refrão\]/g)).toHaveLength(1);
    expect(text.match(/\[Segunda Parte\]/g)).toHaveLength(1);
    expect(text.match(/Deus de Abraão/g)).toHaveLength(1);
    expect(text.match(/Sei que nunca quebrará/g)).toHaveLength(1);
    expect(text.match(/Ele cumprirá/g)).toHaveLength(1);
    expect(text.match(/Fiel Tu és, Senhor a mim/g)).toHaveLength(1);
    expect(text.match(/Fiel Tu és, Se___nhor a mim/g)).toHaveLength(1);
    expect(text).toContain('G#m7    E9\n    Deus de Abraão');
    expect(text).toContain('                     B\nSei que nunca quebrará');
    expect(text).toContain('G#m7    D#m7     E9    B\nFiel Tu és, Senhor a mim');
    expect(text).toContain('( G#m7  E9  B    F# )');
  });

  it('uses blank spacer width as the original isolated chord column', () => {
    const input = `[Verso]\nG#m7\nLinha A\n">E9\nLinha A\n             \nLinha B\n">B\nLinha B`;
    const repaired = normalizePastedSongText(input).text;
    expect(repaired).toContain('G#m7    E9\nLinha A');
    expect(repaired).toContain('             B\nLinha B');
  });

  it('preserves normal repeated lyrics and adjacent chord rows without a corruption marker', () => {
    const valid = `[Refrão]\nG    D\nSanto\nEm    C\nSanto`;
    expect(repairChordImportFidelity(valid)).toBe(valid);
    expect(normalizePastedSongText(valid).text).toBe(valid);
  });

  it('preserves lyric extenders because they carry chord alignment', () => {
    const input = `[Refrão]\nG#m7\nSe___nhor\n">B\nSe___nhor`;
    expect(normalizePastedSongText(input).text).toContain('G#m7    B\nSe___nhor');
  });
});
