import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChordsAndLyrics } from '../../components/songs/ChordsRenderer';

describe('ChordsRenderer column alignment', () => {
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

  it('uses the same monospaced column metrics for chord and lyric lines', () => {
    const source = fs.readFileSync('components/songs/ChordsRenderer.tsx', 'utf8');

    expect(source).toContain('className="font-mono font-bold tracking-normal"');
    expect(source).toContain('className="font-mono font-semibold tracking-normal"');
    expect(source).not.toContain('className="font-bold tracking-wider"');
  });
});
