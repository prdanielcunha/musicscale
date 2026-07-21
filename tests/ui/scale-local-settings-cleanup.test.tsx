import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScaleSongCard } from '../../components/scales/ScaleSongCard';
import { PopulatedSong } from '../../types';

// Mock translation context
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('Scale Local Settings Cleanup Integration Tests', () => {
  const mockSongs: PopulatedSong[] = [
    {
      id: 'song-target',
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
      id: 'song-other',
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

  // A test harness component that uses the exact production handler logic
  const TestHarness = ({
    initialSettings,
    onStateChange
  }: {
    initialSettings: Record<string, any>;
    onStateChange: (state: Record<string, any>) => void;
  }) => {
    const [songSettings, setSongSettings] = useState<Record<string, any>>(initialSettings);

    // Exact replica of the production handler for local song settings
    const handleUpdateSongSettings = async (
      songId: string,
      key: string | null,
      bpm: number | null,
      isGlobal: boolean
    ) => {
      if (!isGlobal) {
        let updatedState: any = null;
        setSongSettings((prev: any) => {
          const newSettings = { ...(prev || {}) };
          const nextSettings: any = {};
          if (key) {
            nextSettings.key = key;
          }
          if (bpm !== null && bpm >= 20 && bpm <= 300) {
            nextSettings.bpm = bpm;
          }

          if (Object.keys(nextSettings).length === 0) {
            delete newSettings[songId];
          } else {
            newSettings[songId] = nextSettings;
          }
          updatedState = newSettings;
          return newSettings;
        });

        // Let the test assert the synchronous next state
        setTimeout(() => {
          if (updatedState) {
            onStateChange(updatedState);
          }
        }, 0);
      }
      return { status: 'success' as const };
    };

    return (
      <div className="space-y-4">
        {mockSongs.map((song, index) => (
          <ScaleSongCard
            key={song.id}
            song={song}
            isSelected={true}
            mode="review"
            index={index}
            tags={[]}
            localSettings={songSettings[song.id]}
            onSettingsChange={(key, bpm, isGlobal) => handleUpdateSongSettings(song.id, key, bpm, isGlobal)}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            isFirst={index === 0}
            isLast={index === mockSongs.length - 1}
          />
        ))}
      </div>
    );
  };

  // 1. { key: "A", bpm: 85 } e usuário apaga somente o tom: resultado { bpm: 85 }
  it('Scenario 1: removes key from settings but preserves BPM when only key is deleted', async () => {
    const handleStateChange = vi.fn();
    const { container } = render(
      <TestHarness
        initialSettings={{
          'song-target': { key: 'A', bpm: 85 },
          'song-other': { key: 'C', bpm: 100 },
        }}
        onStateChange={handleStateChange}
      />
    );

    // Click Edit on target song card
    const editBtns = screen.getAllByText(/Editar/i);
    fireEvent.click(editBtns[0]); // target song card edit

    // Change Key to empty (original key or none)
    const keySelect = container.querySelector('select');
    expect(keySelect).toBeInTheDocument();
    fireEvent.change(keySelect!, { target: { value: '' } });

    // Click Apply
    const applyBtn = screen.getByText(/Aplicar/i);
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(handleStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          'song-target': { bpm: 85 },
          'song-other': { key: 'C', bpm: 100 },
        })
      );
    });
  });

  // 2. { key: "A", bpm: 85 } e usuário apaga somente o BPM: resultado { key: "A" }
  it('Scenario 2: removes BPM from settings but preserves key when only BPM is cleared', async () => {
    const handleStateChange = vi.fn();
    const { container } = render(
      <TestHarness
        initialSettings={{
          'song-target': { key: 'A', bpm: 85 },
          'song-other': { key: 'C', bpm: 100 },
        }}
        onStateChange={handleStateChange}
      />
    );

    // Click Edit on target song card
    const editBtns = screen.getAllByText(/Editar/i);
    fireEvent.click(editBtns[0]);

    // Change BPM to empty input
    const bpmInput = container.querySelector('input[type="number"]');
    expect(bpmInput).toBeInTheDocument();
    fireEvent.change(bpmInput!, { target: { value: '' } });

    // Click Apply
    const applyBtn = screen.getByText(/Aplicar/i);
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(handleStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          'song-target': { key: 'A' },
          'song-other': { key: 'C', bpm: 100 },
        })
      );
    });
  });

  // 3. Usuário apaga ambos: remover completamente a entrada do songId
  it('Scenario 3: completely deletes target songId entry if both key and BPM are cleared', async () => {
    const handleStateChange = vi.fn();
    const { container } = render(
      <TestHarness
        initialSettings={{
          'song-target': { key: 'A', bpm: 85 },
          'song-other': { key: 'C', bpm: 100 },
        }}
        onStateChange={handleStateChange}
      />
    );

    // Click Edit on target song card
    const editBtns = screen.getAllByText(/Editar/i);
    fireEvent.click(editBtns[0]);

    // Clear Key select
    const keySelect = container.querySelector('select');
    expect(keySelect).toBeInTheDocument();
    fireEvent.change(keySelect!, { target: { value: '' } });

    // Clear BPM input
    const bpmInput = container.querySelector('input[type="number"]');
    expect(bpmInput).toBeInTheDocument();
    fireEvent.change(bpmInput!, { target: { value: '' } });

    // Click Apply
    const applyBtn = screen.getByText(/Aplicar/i);
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(handleStateChange).not.toHaveBeenCalledWith(
        expect.objectContaining({
          'song-target': expect.any(Object),
        })
      );
      // Wait for it to be called with only other song remaining
      expect(handleStateChange).toHaveBeenCalledWith({
        'song-other': { key: 'C', bpm: 100 }
      });
    });
  });

  // 4. Salvar um novo tom e BPM: substituir pelos novos valores
  it('Scenario 4: replaces previous settings with newly applied key and BPM values', async () => {
    const handleStateChange = vi.fn();
    const { container } = render(
      <TestHarness
        initialSettings={{
          'song-target': { key: 'A', bpm: 85 },
          'song-other': { key: 'C', bpm: 100 },
        }}
        onStateChange={handleStateChange}
      />
    );

    // Click Edit on target song card
    const editBtns = screen.getAllByText(/Editar/i);
    fireEvent.click(editBtns[0]);

    // Change key to Bb
    const keySelect = container.querySelector('select');
    expect(keySelect).toBeInTheDocument();
    fireEvent.change(keySelect!, { target: { value: 'Bb' } });

    // Change BPM to 140
    const bpmInput = container.querySelector('input[type="number"]');
    expect(bpmInput).toBeInTheDocument();
    fireEvent.change(bpmInput!, { target: { value: '140' } });

    // Click Apply
    const applyBtn = screen.getByText(/Aplicar/i);
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(handleStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          'song-target': { key: 'Bb', bpm: 140 },
          'song-other': { key: 'C', bpm: 100 },
        })
      );
    });
  });

  // 5. Não alterar configurações de outras músicas
  it('Scenario 5: isolates target song changes and preserves configurations of other songs completely intact', async () => {
    const handleStateChange = vi.fn();
    const { container } = render(
      <TestHarness
        initialSettings={{
          'song-target': { key: 'A', bpm: 85 },
          'song-other': { key: 'C', bpm: 100 },
        }}
        onStateChange={handleStateChange}
      />
    );

    // Edit only the target song to Bb
    const editBtns = screen.getAllByText(/Editar/i);
    fireEvent.click(editBtns[0]);

    const keySelect = container.querySelector('select');
    fireEvent.change(keySelect!, { target: { value: 'Bb' } });

    const applyBtn = screen.getByText(/Aplicar/i);
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(handleStateChange).toHaveBeenCalledWith(
        expect.objectContaining({
          'song-other': { key: 'C', bpm: 100 } // absolutely unmodified
        })
      );
    });
  });
});
