import { describe, it, expect } from 'vitest';
import { 
  transposeChordDocument, 
  getSignedSemitones, 
  analyzeChordDocumentKeyCandidates, 
  validateTransposedPreview,
  areKeysEnharmonicallyEquivalent
} from '../../utils/chordEngine';

describe('areKeysEnharmonicallyEquivalent', () => {
  it('1. C# equivale a Db', () => {
    expect(areKeysEnharmonicallyEquivalent('C#', 'Db')).toBe(true);
    expect(areKeysEnharmonicallyEquivalent('Db', 'C#')).toBe(true);
  });

  it('2. F# equivale a Gb', () => {
    expect(areKeysEnharmonicallyEquivalent('F#', 'Gb')).toBe(true);
  });

  it('3. C#m equivale a Dbm', () => {
    expect(areKeysEnharmonicallyEquivalent('C#m', 'Dbm')).toBe(true);
  });

  it('4. C não equivale a Cm', () => {
    expect(areKeysEnharmonicallyEquivalent('C', 'Cm')).toBe(false);
  });
});

describe('chordEngine - transposeChordDocument manual repair tool', () => {
  const chordsSample = `[Intro]
E   B/D#   C#m   A

[Verso]
E   B
Quem é esse que vem
C#m   A
Saltando pelos montes`;

  it('1. deve transpor de E para F# corretamente', () => {
    const result = transposeChordDocument(chordsSample, 'E', 'F#');
    expect(result.semitones).toBe(2);
    expect(result.chords).toContain('F#   C#/E#   D#m   B');
    expect(result.chords).toContain('F#   C#');
    expect(result.chords).toContain('D#m   B');
    expect(result.chords).toContain('Quem é esse que vem');
  });

  it('2. deve transpor de C para D corretamente', () => {
    const chords = 'C G Am F';
    const result = transposeChordDocument(chords, 'C', 'D');
    expect(result.semitones).toBe(2);
    expect(result.chords).toBe('D A Bm G');
  });

  it('3. deve transpor de Bb para C corretamente', () => {
    const chords = 'Bb F Gm Eb';
    const result = transposeChordDocument(chords, 'Bb', 'C');
    expect(result.semitones).toBe(2);
    expect(result.chords).toBe('C G Am F');
  });

  it('4. deve transpor de Em para F#m corretamente', () => {
    const chords = 'Em C G D';
    const result = transposeChordDocument(chords, 'Em', 'F#m');
    expect(result.semitones).toBe(2);
    expect(result.chords).toBe('F#m D A E');
  });

  it('5. deve transpor de B/D# para C#/E# corretamente (preferindo sustenidos para F#)', () => {
    const chords = 'B/D#';
    const result = transposeChordDocument(chords, 'E', 'F#'); // E -> F# is +2 semitones
    expect(result.chords).toBe('C#/E#');
  });

  it('6. deve transpor de C#m para D#m corretamente', () => {
    const chords = 'C#m';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('D#m');
  });

  it('7. deve transpor de F#m7 para G#m7 corretamente', () => {
    const chords = 'F#m7';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('G#m7');
  });

  it('8. deve transpor de E7M para F#7M corretamente', () => {
    const chords = 'E7M';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('F#7M');
  });

  it('9. deve transpor de Esus4 para F#sus4 corretamente', () => {
    const chords = 'Esus4';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('F#sus4');
  });

  it('10. deve transpor de Eadd9 para F#add9 corretamente', () => {
    const chords = 'Eadd9';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('F#add9');
  });

  it('11. deve preservar extensões complexas como G7(b9) ao transpor', () => {
    const chords = 'G7(b9)';
    const result = transposeChordDocument(chords, 'C', 'D'); // +2 semitones
    expect(result.chords).toBe('A7(b9)');
  });

  it('12. deve transpor corretamente em linhas com barras de compasso', () => {
    const chords = '| E | B/D# | C#m | A |';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('| F# | C#/E# | D#m | B |');
  });

  it('13. deve transpor linhas de Intro com acordes', () => {
    const chords = 'Intro: E B/D# C#m A';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('Intro: F# C#/E# D#m B');
  });

  it('14. deve transpor linhas de Solo com acordes', () => {
    const chords = 'Solo: E B C#m A';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('Solo: F# C# D#m B'); // B -> C# is +2 semitones
  });

  it('15. deve preservar espaços múltiplos entre acordes', () => {
    const chords = 'E      B/D#      C#m';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('F#      C#/E#      D#m');
  });

  it('16. deve preservar quebras de linha', () => {
    const chords = 'E\n\nB/D#\nC#m';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('F#\n\nC#/E#\nD#m');
  });

  it('17. deve manter a letra intacta', () => {
    const chords = 'E\nQuem é esse que vem';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('F#\nQuem é esse que vem');
  });

  it('18. deve manter cabeçalhos de seção intactos', () => {
    const chords = '[Verso]\nE';
    const result = transposeChordDocument(chords, 'E', 'F#');
    expect(result.chords).toBe('[Verso]\nF#');
  });

  it('19. deve suportar caracteres Unicode ♯ e ♭ na entrada do tom', () => {
    const result = transposeChordDocument('E', 'E', 'F♯');
    expect(result.semitones).toBe(2);
    expect(result.chords).toBe('F#');
    
    const resultFlat = transposeChordDocument('Bb', 'B♭', 'C');
    expect(resultFlat.semitones).toBe(2);
    expect(resultFlat.chords).toBe('C');
  });

  it('20. origem e destino iguais não devem modificar', () => {
    const result = transposeChordDocument(chordsSample, 'E', 'E');
    expect(result.semitones).toBe(0);
    expect(result.chords).toBe(chordsSample);
    expect(result.changedChordCount).toBe(0);
  });

  it('21. aplicação repetida com mesma origem e destino não deve alterar', () => {
    const step1 = transposeChordDocument(chordsSample, 'E', 'F#');
    const step2 = transposeChordDocument(step1.chords, 'F#', 'F#');
    expect(step2.semitones).toBe(0);
    expect(step2.chords).toBe(step1.chords);
  });

  it('22. deve rejeitar conteúdo vazio', () => {
    expect(() => transposeChordDocument('', 'E', 'F#')).toThrow('Conteúdo vazio');
    expect(() => transposeChordDocument('   ', 'E', 'F#')).toThrow('Conteúdo vazio');
  });

  it('23. deve rejeitar tom inválido', () => {
    expect(() => transposeChordDocument('E', 'InvalidKey', 'F#')).toThrow('Tom inválido');
    expect(() => transposeChordDocument('E', 'E', 'X#')).toThrow('Tom inválido');
  });
});

describe('getSignedSemitones', () => {
  it('deve calcular G -> F como -2 semitons', () => {
    const res = getSignedSemitones('G', 'F');
    expect(res.signedSemitones).toBe(-2);
    expect(res.normalizedSemitones).toBe(10);
  });

  it('deve calcular C -> F como +5 semitons', () => {
    const res = getSignedSemitones('C', 'F');
    expect(res.signedSemitones).toBe(5);
    expect(res.normalizedSemitones).toBe(5);
  });

  it('deve calcular F -> C como -5 semitons', () => {
    const res = getSignedSemitones('F', 'C');
    expect(res.signedSemitones).toBe(-5);
    expect(res.normalizedSemitones).toBe(7);
  });

  it('deve calcular C -> B como -1 semitom', () => {
    const res = getSignedSemitones('C', 'B');
    expect(res.signedSemitones).toBe(-1);
    expect(res.normalizedSemitones).toBe(11);
  });
});

describe('analyzeChordDocumentKeyCandidates', () => {
  it('deve detectar G como candidato de alta confiança em cifra escrita com G, D/F#, Em7, A', () => {
    const chords = `[Intro]
G   D/F#
Em7   A`;
    const res = analyzeChordDocumentKeyCandidates(chords);
    expect(res.candidates.length).toBeGreaterThan(0);
    expect(res.candidates[0].key).toBe('G');
    expect(['high', 'medium']).toContain(res.candidates[0].confidence);
  });

  it('Caso Real da Captura: deve transpor C, G/B, Am7, D, D/F#, G/D de G para F resultando em Bb, F/A, Gm7, C, C/E, F/C', () => {
    const chords = 'C G/B Am7 D D/F# G/D';
    const res = transposeChordDocument(chords, 'G', 'F');
    expect(res.chords).toBe('Bb F/A Gm7 C C/E F/C');
  });

  it('slash chord ignora baixo na detecção do centro tonal', () => {
    const chords = 'G/B D/F# C/E';
    const res = analyzeChordDocumentKeyCandidates(chords);
    expect(res.candidates.length).toBeGreaterThan(0);
  });
});

describe('validateTransposedPreview', () => {
  it('deve validar transposição válida preservando letra, barras de compasso e extensão', () => {
    const original = 'C G/B Am7 D\nSanto, Santo é o Senhor';
    const transposed = transposeChordDocument(original, 'G', 'F').chords;
    const val = validateTransposedPreview(original, transposed, 'G', 'F');
    expect(val.valid).toBe(true);
  });

  it('deve rejeitar transposição se a letra for alterada', () => {
    const original = 'C G/B Am7 D\nSanto, Santo é o Senhor';
    const invalidTransposed = 'Bb F/A Gm7 C\nSanto, Santo é o Deus';
    const val = validateTransposedPreview(original, invalidTransposed, 'G', 'F');
    expect(val.valid).toBe(false);
    expect(val.error).toContain('letra foi alterada');
  });
});

import { validateChordContentKeyConsistency } from '../../utils/chordEngine';

describe('validateChordContentKeyConsistency', () => {
  it('identifies a MATCH in F#', () => {
    const res = validateChordContentKeyConsistency("F# C#/E# D#m B", "F#");
    expect(res.status).toBe('MATCH');
    expect(res.expectedKey).toBe('F#');
    expect(res.detectedKey).toBe('F#'); // or Gb depending on the engine
    expect(res.totalChordTokens).toBe(4);
  });

  it('identifies a MATCH enharmonic', () => {
    const res = validateChordContentKeyConsistency("F# C#/E# D#m B", "Gb");
    expect(res.status).toBe('MATCH');
  });

  it('identifies a clear MISMATCH', () => {
    const res = validateChordContentKeyConsistency("G D/F# Em C", "F#");
    expect(res.status).toBe('MISMATCH');
    expect(res.scoreGap).toBeGreaterThanOrEqual(3);
  });

  it('identifies an INDETERMINATE relative', () => {
    const res = validateChordContentKeyConsistency("C G Am F", "Am");
    expect(res.status).toBe('INDETERMINATE');
  });

  it('identifies NO_CHORDS', () => {
    const res = validateChordContentKeyConsistency("Grande é o Senhor e digno de louvor", "G");
    expect(res.status).toBe('NO_CHORDS');
    expect(res.totalChordTokens).toBe(0);
  });
});
