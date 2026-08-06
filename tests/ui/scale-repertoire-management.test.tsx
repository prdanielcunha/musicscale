import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PopulatedSong } from '../../types';
import { ScaleReviewRepertoire } from '../../components/scales/ScaleReviewRepertoire';

// Mock translation context
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg2?: any) => {
      let songName = '';
      if (arg2 && typeof arg2 === 'object') {
        songName = arg2.song || '';
      }
      if (key === 'scaleModal.removeSong') return `Remover ${songName}`.trim();
      if (key === 'scaleModal.minimumOneSong') return 'Não é permitido criar ou atualizar uma escala de músicas sem nenhuma música selecionada.';
      if (key === 'scaleModal.songRemovedSuccess') return 'Música removida da escala com sucesso!';
      if (key === 'scaleModal.songAddedSuccess') return 'Música adicionada à escala com sucesso!';
      if (key === 'scaleModal.noSongsSelected') return 'Nenhuma música';
      if (key === 'scaleModal.addSong') return 'Adicionar música';
      
      const defaultValue = typeof arg2 === 'string' ? arg2 : '';
      return defaultValue || key;
    },
  }),
}));

describe('Scale Repertoire Management Integration Tests', () => {
  const mockSongs: PopulatedSong[] = [
    {
      id: 'song-1',
      organizationId: 'org-abc',
      title: 'Amazing Grace',
      artist: 'John Newton',
      key: 'G',
      originalKey: 'G',
      selectedKey: 'G',
      bpm: 80,
      status: 'active',
      tagIds: [],
      lyrics: 'Lyrics 1',
      chords: 'Chords 1',
      chordsUrl: '',
      videoUrl: '',
      createdAt: '2026-01-01T00:00:00Z',
      lastPlayed: null,
      createdBy: { uid: 'u1' } as any,
      tags: [],
    },
    {
      id: 'song-2',
      organizationId: 'org-abc',
      title: 'How Great Is Our God',
      artist: 'Chris Tomlin',
      key: 'C',
      originalKey: 'C',
      selectedKey: 'C',
      bpm: 76,
      status: 'active',
      tagIds: [],
      lyrics: 'Lyrics 2',
      chords: 'Chords 2',
      chordsUrl: '',
      videoUrl: '',
      createdAt: '2026-01-01T00:00:00Z',
      lastPlayed: null,
      createdBy: { uid: 'u1' } as any,
      tags: [],
    }
  ];

  it('renders song removal button on ScaleReviewRepertoire', () => {
    const mockOnSongIdsChange = vi.fn();
    render(
      <ScaleReviewRepertoire
        songIds={['song-1', 'song-2']}
        songs={mockSongs}
        tags={[]}
        songSettings={{}}
        onUpdateSongSettings={async () => ({ status: 'success' })}
        onSongIdsChange={mockOnSongIdsChange}
        goToStep={vi.fn()}
      />
    );

    // Get removal buttons
    const removeButtons = screen.getAllByRole('button', { name: /Remover/i });
    expect(removeButtons).toHaveLength(2);
    expect(removeButtons[0]).toHaveAttribute('aria-label', 'Remover Amazing Grace');
  });

  it('triggers onSongIdsChange when song removal button is clicked', () => {
    const mockOnSongIdsChange = vi.fn();
    render(
      <ScaleReviewRepertoire
        songIds={['song-1', 'song-2']}
        songs={mockSongs}
        tags={[]}
        songSettings={{}}
        onUpdateSongSettings={async () => ({ status: 'success' })}
        onSongIdsChange={mockOnSongIdsChange}
        goToStep={vi.fn()}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: /Remover/i });
    fireEvent.click(removeButtons[0]);

    expect(mockOnSongIdsChange).toHaveBeenCalledWith(['song-2']);
  });

  it('shows empty state when no songs are selected during review stage', () => {
    render(
      <ScaleReviewRepertoire
        songIds={[]}
        songs={mockSongs}
        tags={[]}
        songSettings={{}}
        onUpdateSongSettings={async () => ({ status: 'success' })}
        onSongIdsChange={vi.fn()}
        goToStep={vi.fn()}
      />
    );

    expect(screen.getByText('Nenhuma música')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar músicas' })).toBeInTheDocument();
  });
});
