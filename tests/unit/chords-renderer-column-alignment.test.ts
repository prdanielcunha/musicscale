import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChordsAndLyrics } from '../../components/songs/ChordsRenderer';

describe('ChordsRenderer column alignment', () => {
  it('keeps inline Intro chords aligned with their indented continuation row', () => {
    const chart = [
      '[Intro] G#m7  E9  B  F#4',
      '        G#m7  E9  B  F#4',
      '',
      '[Primeira Parte]',
      'G#m7             E9',
      '    Deus de Abraão',
    ].join('\n');

    const parsed = parseChordsAndLyrics(chart);

    expect(parsed[0]).toEqual({ type: 'section', content: '[Intro]' });
    expect(parsed[1]).toEqual({ type: 'chord', content: '        G#m7  E9  B  F#4' });
    expect(parsed[2]).toEqual({ type: 'chord', content: '        G#m7  E9  B  F#4' });
    expect(parsed.find((line) => line.content.includes('G#m7             E9'))?.content)
      .toBe('G#m7             E9');
  });

  it('preserves exact horizontal chord offsets through the viewer parser', () => {
    const chart = [
      '[Primeira Parte]',
      'G#m7             E9',
      '    Linha um',
      '                     B',
      'Linha dois',
    ].join('\n');

    const parsed = parseChordsAndLyrics(chart);

    expect(parsed.find((line) => line.content.includes('G#m7'))?.content)
      .toBe('G#m7             E9');
    expect(parsed.find((line) => line.content.trim() === 'B')?.content)
      .toBe('                     B');
    expect(parsed.find((line) => line.content.includes('Linha um'))?.content)
      .toBe('    Linha um');
  });

  it('uses the same monospaced column metrics in both reusable and live Performance renderers', () => {
    const reusableRenderer = fs.readFileSync('components/songs/ChordsRenderer.tsx', 'utf8');
    const performanceRenderer = fs.readFileSync('components/songs/ChordsViewerModal.tsx', 'utf8');

    for (const source of [reusableRenderer, performanceRenderer]) {
      expect(source).toContain('className="font-mono font-bold tracking-normal"');
      expect(source).toContain('className="font-mono font-semibold tracking-normal"');
      expect(source).not.toContain('className="font-bold tracking-wider"');
    }
  });
});
