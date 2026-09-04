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
    expect(detail).toContain('song.tabs');
  });

  it('renders imported technical content in a dedicated premium viewer', () => {
    expect(technical).toContain('song?.tabs');
    expect(technical).toContain('original_fingering');
    expect(technical).toContain('<pre');
  });
});
