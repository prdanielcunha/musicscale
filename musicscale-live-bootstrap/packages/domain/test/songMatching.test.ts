import { describe, expect, it } from 'vitest';
import { matchExternalSong, normalizeSongIdentity } from '../src/songMatching';

describe('song matching', () => {
  it('normalizes accents, punctuation and featured-artist suffixes', () => {
    expect(normalizeSongIdentity('Promessas (part. Samuel Messias)')).toBe('promessas');
    expect(normalizeSongIdentity('Águas — Vivas!')).toBe('aguas vivas');
  });

  it('auto-matches only one strict title-and-artist result', () => {
    const result = matchExternalSong(
      { title: 'Promessas', artist: 'Sarah Beatriz' },
      [
        { id: 'h1', title: 'Promessas', artist: 'Sarah Beatriz' },
        { id: 'h2', title: 'Promessas', artist: 'Outro Artista' }
      ]
    );
    expect(result.status).toBe('matched');
    if (result.status === 'matched') expect(result.candidate.id).toBe('h1');
  });

  it('refuses to auto-pick duplicated exact candidates', () => {
    const result = matchExternalSong(
      { title: 'Santo', artist: 'Banda A' },
      [
        { id: 'h1', title: 'Santo', artist: 'Banda A' },
        { id: 'h2', title: 'Santo', artist: 'Banda A' }
      ]
    );
    expect(result.status).toBe('ambiguous');
  });

  it('marks unrelated results as missing', () => {
    const result = matchExternalSong(
      { title: 'Canção Inexistente', artist: 'Artista X' },
      [{ id: 'h1', title: 'Outra Música', artist: 'Artista Y' }]
    );
    expect(result.status).toBe('missing');
  });
});
