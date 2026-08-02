import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicRepository } from '../../services/MusicRepository';

// Mock the firebase module to avoid connecting to a real project
vi.mock('../../services/firebase', () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue('mock-token-123')
    }
  },
  db: {}
}));

describe('MusicRepository - Transposition & Tenant Isolation', () => {
  let repository: MusicRepository;
  const currentOrgId = 'org-shaddai-777';
  const alienOrgId = 'org-alien-999';

  beforeEach(() => {
    repository = new MusicRepository(currentOrgId);
    // Mock the inner songs repository methods
    repository.songs.getById = vi.fn();
    repository.songs.update = vi.fn();
  });

  it('deve transpor uma música com sucesso se o organizationId for o mesmo', async () => {
    const songId = 'song-111';
    const originalSong = {
      id: songId,
      title: 'Vitorioso És',
      artist: 'Gabriel Guedes',
      key: 'E',
      chords: 'E   B/D#   C#m   A',
      organizationId: currentOrgId
    };

    vi.mocked(repository.songs.getById).mockResolvedValue(originalSong as any);
    vi.mocked(repository.songs.update).mockResolvedValue(undefined);

    await repository.transposeSong(songId, 'F#');

    expect(repository.songs.getById).toHaveBeenCalledWith(songId);
    expect(repository.songs.update).toHaveBeenCalledWith(
      songId,
      expect.objectContaining({
        key: 'F#',
        chords: expect.stringContaining('F#   C#/E#   D#m   B')
      })
    );
  });

  it('deve lançar erro e bloquear transposição se a música pertencer a outra organização (Isolamento de Organização)', async () => {
    const songId = 'song-222';
    const alienSong = {
      id: songId,
      title: 'O Escudo',
      artist: 'Voz da Verdade',
      key: 'C',
      chords: 'C G Am F',
      organizationId: alienOrgId // Different organization!
    };

    vi.mocked(repository.songs.getById).mockResolvedValue(alienSong as any);

    await expect(repository.transposeSong(songId, 'D')).rejects.toThrow(
      'Operação negada: ID da organização ausente no contexto atual.'
    );

    expect(repository.songs.update).not.toHaveBeenCalled();
  });

  it('deve lançar erro se a música não existir', async () => {
    vi.mocked(repository.songs.getById).mockResolvedValue(null);

    await expect(repository.transposeSong('non-existent', 'D')).rejects.toThrow(
      'Operação negada: ID da organização ausente no contexto atual.'
    );
  });

  it('deve atualizar acordes diretamente se o organizationId for o mesmo', async () => {
    const songId = 'song-333';
    const originalSong = {
      id: songId,
      title: 'Vitorioso És',
      organizationId: currentOrgId
    };

    vi.mocked(repository.songs.getById).mockResolvedValue(originalSong as any);
    vi.mocked(repository.songs.update).mockResolvedValue(undefined);

    const newChords = 'F#   C#/E#   D#m   B';
    await repository.updateSongChords(songId, newChords);

    expect(repository.songs.update).toHaveBeenCalledWith(
      songId,
      expect.objectContaining({
        chords: newChords
      })
    );
  });

  it('deve lançar erro ao atualizar acordes se a música pertencer a outra organização', async () => {
    const songId = 'song-444';
    const alienSong = {
      id: songId,
      title: 'O Escudo',
      organizationId: alienOrgId
    };

    vi.mocked(repository.songs.getById).mockResolvedValue(alienSong as any);

    await expect(repository.updateSongChords(songId, 'C G Am F')).rejects.toThrow(
      'Operação negada: ID da organização ausente no contexto atual.'
    );

    expect(repository.songs.update).not.toHaveBeenCalled();
  });
});
