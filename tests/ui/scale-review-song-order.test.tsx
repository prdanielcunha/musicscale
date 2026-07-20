import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScaleSongCard } from '../../components/scales/ScaleSongCard';
import { PopulatedSong } from '../../types';
import { moveSongId } from '../../utils/scaleSongSettings';

// Mock translation context
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => {
      if (key === 'scaleModal.moveUp') return 'Subir música';
      if (key === 'scaleModal.moveDown') return 'Descer música';
      return defaultValue;
    },
  }),
}));

describe('Scale Review Stage Song Reordering Integration Tests', () => {
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
    },
  ];

  const TestWrapper = () => {
    const [songIds, setSongIds] = useState<string[]>(['song-1', 'song-2']);
    const [songSettings, setSongSettings] = useState<Record<string, { key: string; bpm: number }>>({
      'song-1': { key: 'A', bpm: 85 }, // local adjustments
      'song-2': { key: 'F', bpm: 72 }, // local adjustments
    });

    const moveSongReview = (index: number, direction: 'up' | 'down') => {
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === songIds.length - 1)
      ) return;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const newIds = moveSongId(songIds, index, targetIndex);
      setSongIds(newIds);
    };

    return (
      <div className="space-y-4">
        {songIds.map((id, index) => {
          const song = mockSongs.find((s) => s.id === id);
          if (!song) return null;
          return (
            <ScaleSongCard
              key={song.id}
              song={song}
              isSelected={true}
              mode="review"
              index={index}
              tags={[]}
              localSettings={songSettings[song.id]}
              onSettingsChange={async () => ({ status: 'success' })}
              onMoveUp={() => moveSongReview(index, 'up')}
              onMoveDown={() => moveSongReview(index, 'down')}
              isFirst={index === 0}
              isLast={index === songIds.length - 1}
            />
          );
        })}
      </div>
    );
  };

  it('verifies accessibility aria-labels on movement buttons', () => {
    render(<TestWrapper />);

    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });

    expect(upButtons[0]).toHaveAttribute('aria-label', 'Subir música - Amazing Grace');
    expect(downButtons[0]).toHaveAttribute('aria-label', 'Descer música - Amazing Grace');
    expect(upButtons[1]).toHaveAttribute('aria-label', 'Subir música - How Great Is Our God');
    expect(downButtons[1]).toHaveAttribute('aria-label', 'Descer música - How Great Is Our God');
  });

  it('disables Subir on first song and Descer on last song', () => {
    render(<TestWrapper />);

    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });

    // First song: Amazing Grace
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[0]).not.toBeDisabled();

    // Last song: How Great Is Our God
    expect(upButtons[1]).not.toBeDisabled();
    expect(downButtons[1]).toBeDisabled();
  });

  it('reorders list on button click and preserves local songSettings intactly', async () => {
    render(<TestWrapper />);

    // Verify initial layout order
    let songCards = screen.getAllByText(/(Amazing Grace|How Great Is Our God)/);
    expect(songCards[0]).toHaveTextContent('Amazing Grace');
    expect(songCards[1]).toHaveTextContent('How Great Is Our God');

    // Verify initial keys displayed
    expect(screen.getByText('Tom A')).toBeInTheDocument();
    expect(screen.getByText('Tom F')).toBeInTheDocument();

    // Trigger Move Down on the first song
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    fireEvent.click(downButtons[0]);

    // Verify list reordered
    await waitFor(() => {
      const reorderedCards = screen.getAllByText(/(Amazing Grace|How Great Is Our God)/);
      expect(reorderedCards[0]).toHaveTextContent('How Great Is Our God');
      expect(reorderedCards[1]).toHaveTextContent('Amazing Grace');
    });

    // Verify local settings remain fully intact and linked correctly
    expect(screen.getByText('Tom A')).toBeInTheDocument();
    expect(screen.getByText('Tom F')).toBeInTheDocument();
  });
});
