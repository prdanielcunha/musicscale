import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const detail = fs.readFileSync(
  path.join(process.cwd(), 'components/songs/SongDetailModal.tsx'),
  'utf8',
);
const technical = fs.readFileSync(
  path.join(process.cwd(), 'components/songs/TechnicalPartsModal.tsx'),
  'utf8',
);

describe('Technical parts UI contract', () => {
  it('adds technical parts without replacing chord, lyric, or performance actions', () => {
    expect(detail).toContain('Abrir Performance');
    expect(detail).toContain('> Cifra');
    expect(detail).toContain('> Letra');
    expect(detail).toContain('TechnicalPartsModal');
    expect(detail).toContain('buildSongParts');
    expect(detail).toContain('songParts.length > 0');
  });

  it('renders imported technical content in a dedicated premium viewer', () => {
    expect(technical).toContain('buildSongParts(song)');
    expect(technical).toContain('transposeChordDocument');
    expect(technical).toContain('preservesFingering');
    expect(technical).toContain('open_full_performance');
    expect(technical).toContain('<pre');
  });
});
