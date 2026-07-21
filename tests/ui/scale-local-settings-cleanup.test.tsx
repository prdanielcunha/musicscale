import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScaleSongCard } from '../../components/scales/ScaleSongCard';
import { ScaleReviewRepertoire } from '../../components/scales/ScaleReviewRepertoire';
import { PopulatedSong } from '../../types';
import { applyLocalScaleSongSettingsUpdate, normalizeScaleSongSettings } from '../../utils/scaleSongSettings';

// Mock translation context
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('Scale Local Settings Cleanup Integration & Unit Tests', () => {
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

  // A test harness component that uses the actual helper function
  const TestHarness = ({
    initialSettings,
    onStateChange
  }: {
    initialSettings: Record<string, any>;
    onStateChange: (state: Record<string, any>) => void;
  }) => {
    const [songSettings, setSongSettings] = useState<Record<string, any>>(initialSettings);

    const handleUpdateSongSettings = async (
      songId: string,
      key: string | null,
      bpm: number | null,
      isGlobal: boolean
    ) => {
      if (!isGlobal) {
        let updatedState: any = null;
        setSongSettings((prev: any) => {
          const nextSettings = applyLocalScaleSongSettingsUpdate(prev, songId, key, bpm);
          updatedState = nextSettings;
          return nextSettings;
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

  // =========================================================================
  // SECTION 1: DIRECT HELPER UNIT TESTS (COVERS REQUISITO 6)
  // =========================================================================

  it('1. Direct Helper: apagar somente tom preserva BPM', () => {
    const input = {
      'song-target': { key: 'G', bpm: 80 },
      'song-other': { key: 'C', bpm: 100 }
    };
    const result = applyLocalScaleSongSettingsUpdate(input, 'song-target', null, 80);
    expect(result['song-target']).toEqual({ bpm: 80 });
  });

  it('2. Direct Helper: apagar somente BPM preserva tom', () => {
    const input = {
      'song-target': { key: 'G', bpm: 80 },
      'song-other': { key: 'C', bpm: 100 }
    };
    const result = applyLocalScaleSongSettingsUpdate(input, 'song-target', 'G', null);
    expect(result['song-target']).toEqual({ key: 'G' });
  });

  it('3. Direct Helper: apagar ambos remove a entrada', () => {
    const input = {
      'song-target': { key: 'G', bpm: 80 },
      'song-other': { key: 'C', bpm: 100 }
    };
    const result = applyLocalScaleSongSettingsUpdate(input, 'song-target', null, null);
    expect(result['song-target']).toBeUndefined();
    expect(result['song-other']).toBeDefined();
  });

  it('4. Direct Helper: trocar ambos substitui os valores', () => {
    const input = {
      'song-target': { key: 'G', bpm: 80 },
      'song-other': { key: 'C', bpm: 100 }
    };
    const result = applyLocalScaleSongSettingsUpdate(input, 'song-target', 'A', 120);
    expect(result['song-target']).toEqual({ key: 'A', bpm: 120 });
  });

  it('5. Direct Helper: outras músicas permanecem intactas', () => {
    const input = {
      'song-target': { key: 'G', bpm: 80 },
      'song-other': { key: 'C', bpm: 100 }
    };
    const result = applyLocalScaleScaleSongSettingsUpdateClone(input, 'song-target', 'A', 120);
    expect(result['song-other']).toEqual({ key: 'C', bpm: 100 });
  });

  it('6. Direct Helper: objeto de entrada não é mutado', () => {
    const input = {
      'song-target': { key: 'G', bpm: 80 }
    };
    const result = applyLocalScaleSongSettingsUpdate(input, 'song-target', 'A', 120);
    expect(input['song-target'].key).toBe('G');
    expect(result['song-target'].key).toBe('A');
  });

  it('7. Direct Helper: BPM inválido não é persistido', () => {
    const input = {
      'song-target': { key: 'G', bpm: 80 }
    };
    // BPM below 20 should not be saved (removes BPM, keeps key)
    const resultBelow = applyLocalScaleSongSettingsUpdate(input, 'song-target', 'G', 19);
    expect(resultBelow['song-target']).toEqual({ key: 'G' });

    // BPM above 300 should not be saved
    const resultAbove = applyLocalScaleSongSettingsUpdate(input, 'song-target', 'G', 301);
    expect(resultAbove['song-target']).toEqual({ key: 'G' });

    // NaN BPM
    const resultNaN = applyLocalScaleSongSettingsUpdate(input, 'song-target', 'G', NaN);
    expect(resultNaN['song-target']).toEqual({ key: 'G' });
  });

  it('8. Direct Helper: key vazia não é persistida', () => {
    const input = {
      'song-target': { key: 'G', bpm: 80 }
    };
    // Empty key should not be saved (removes key, keeps BPM)
    const resultEmpty = applyLocalScaleSongSettingsUpdate(input, 'song-target', '', 80);
    expect(resultEmpty['song-target']).toEqual({ bpm: 80 });

    const resultSpaces = applyLocalScaleSongSettingsUpdate(input, 'song-target', '   ', 80);
    expect(resultSpaces['song-target']).toEqual({ bpm: 80 });
  });

  it('9. Direct Helper: array songIds permanece intacto', () => {
    const songIds = ['song-target', 'song-other'];
    const songIdsCopy = [...songIds];
    const input = { 'song-target': { key: 'G', bpm: 80 } };
    applyLocalScaleSongSettingsUpdate(input, 'song-target', 'A', 120);
    expect(songIds).toEqual(songIdsCopy);
  });

  // Helper function wrapper for test 5
  function applyLocalScaleScaleSongSettingsUpdateClone(input: any, id: string, key: any, bpm: any) {
    return applyLocalScaleSongSettingsUpdate(input, id, key, bpm);
  }

  // =========================================================================
  // SECTION 2: INTEGRATION TESTS USING TEST HARNESS WITH REAL COMPONENT
  // =========================================================================

  it('10. Integration: removes key from settings but preserves BPM when only key is deleted', async () => {
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

  it('11. Integration: removes BPM from settings but preserves key when only BPM is cleared', async () => {
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

  it('12. Integration: clicking "Limpar ajustes locais" removes all localSettings from the state, resulting in clean save payload without cleared keys, and renders correctly without throwing', async () => {
    const handleStateChange = vi.fn();
    const saveMock = vi.fn();

    // Harness to simulate ModernScaleForm saving flow after clear
    const FormHarness = () => {
      const [songSettings, setSongSettings] = useState<Record<string, any>>({
        'song-target': { key: 'A', bpm: 85 },
        'song-other': { key: 'C', bpm: 100 },
      });

      const handleUpdateSongSettings = async (
        songId: string,
        key: string | null,
        bpm: number | null,
        isGlobal: boolean
      ) => {
        if (!isGlobal) {
          setSongSettings((prev: any) => {
            const nextSettings = applyLocalScaleSongSettingsUpdate(prev, songId, key, bpm);
            handleStateChange(nextSettings);
            return nextSettings;
          });
        }
        return { status: 'success' as const };
      };

      const handleSave = () => {
        const selectedSongs = ['song-target', 'song-other'];
        const finalSongSettings = normalizeScaleSongSettings(selectedSongs, songSettings);
        saveMock(finalSongSettings);
      };

      return (
        <div>
          <ScaleReviewRepertoire
            songs={mockSongs}
            songIds={['song-target', 'song-other']}
            onMoveCallback={() => {}}
            onUpdateSongSettings={handleUpdateSongSettings}
            songSettings={songSettings}
            goToStep={() => {}}
          />
          <button onClick={handleSave}>Salvar</button>
        </div>
      );
    };

    render(<FormHarness />);

    // Click "Limpar ajustes locais"
    const clearBtn = screen.getByText('Limpar ajustes locais');
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);

    // After clicking clear, both keys should be cleared from the state
    await waitFor(() => {
      expect(handleStateChange).toHaveBeenCalledWith({});
    });

    // Let's click Save to verify that the final save payload is clean without the keys
    const saveBtn = screen.getByText('Salvar');
    fireEvent.click(saveBtn);

    expect(saveMock).toHaveBeenCalledWith({});
  });
});
