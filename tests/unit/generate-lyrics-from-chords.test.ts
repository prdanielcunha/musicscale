import { describe, expect, it } from 'vitest';
import { generateLyricsFromChords } from '../../utils/generateLyricsFromChords';

describe('generate lyrics from a chart without changing the music', () => {
  it('removes chord rows, inline chords, instrumental cues and tablature, keeping words', () => {
    const chords = [
      'Tom: G',
      '[Intro]',
      'G#m7   E9   B4   D/F#',
      '',
      '[Primeira Parte]',
      'G             D',
      'A Deus toda glória',
      'Amor que não falha',
      '',
      '[Refrão]',
      '[G]Eu te adoro [D/F#]Senhor',
      'Em7  C9',
      'Em',
      '',
      '[Solo]',
      'e|---3---2---0--',
      'B|---1---0---0--',
    ].join('\n');
    const original = chords;
    const result = generateLyricsFromChords(chords);
    expect(result.hasSungContent).toBe(true);
    expect(result.lyrics).toContain('[Primeira Parte]');
    expect(result.lyrics).toContain('A Deus toda glória');
    expect(result.lyrics).toContain('Amor que não falha');
    expect(result.lyrics).toContain('Eu te adoro Senhor');
    expect(result.lyrics).not.toContain('G#m7');
    expect(result.lyrics).not.toContain('D/F#');
    expect(result.lyrics).not.toContain('[Solo]');
    expect(result.lyrics).not.toContain('e|---3---2');
    expect(chords).toBe(original);
  });

  it('keeps repeated sung parts and does not silently deduplicate a medley', () => {
    const repeated = 'G D\nEu te amo\n\nG D\nEu te amo';
    expect(generateLyricsFromChords(repeated).lyrics).toBe('Eu te amo\n\nEu te amo');
  });

  it('does not claim lyrics when a chart contains only harmonies', () => {
    const generated = generateLyricsFromChords('[Intro]\nAm7  D/F#  Gsus4\nC9  G');
    expect(generated.hasSungContent).toBe(false);
    expect(generated.lyrics).toBe('');
  });

  it('preserves unknown medley part titles and never generates outside words', () => {
    const source = '[Música A · Ponte]\nAm  F\nVem Senhor\n\n[Música B]\nG D\nFiel és tu';
    const output = generateLyricsFromChords(source);
    expect(output.lyrics).toContain('[Música A · Ponte]');
    expect(output.lyrics).toContain('Vem Senhor');
    expect(output.lyrics).toContain('Fiel és tu');
  });
});
