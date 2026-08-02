import { describe, it, expect } from 'vitest';
import { transposeChordDocument } from '../../utils/chordEngine';

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
