import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScaleSongCard } from '../../components/scales/ScaleSongCard';
import { ScaleReviewRepertoire } from '../../components/scales/ScaleReviewRepertoire';
import { PopulatedSong } from '../../types';
import { applyLocalScaleSongSettingsUpdate, normalizeScaleSongSettings } from '../../utils/scaleSongSettings';
import ModernScaleForm from '../../components/scales/ModernScaleForm';

// Mock translation context
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => {
      if (key === 'scaleModal.emptyScaleTip') return 'Clique + Música';
      return defaultValue || key;
    },
    i18n: { language: 'pt', changeLanguage: vi.fn() },
  }),
}));

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

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({
    songs: mockSongs,
    eventTypes: [{ id: 'et-1', name: 'Culto' }],
    locations: [{ id: 'loc-1', name: 'Templo' }],
    eventNames: [],
    instruments: [],
    tags: [],
    fixedBandScales: [],
    allUsers: [],
    populatedBandScales: [],
    populatedScales: [],
    refreshData: vi.fn(),
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    userProfile: { id: 'u1', name: 'User 1', organizationId: 'org-abc' },
    user: { uid: 'u1' },
    organization: { id: 'org-abc' },
  }),
}));

vi.mock('../../hooks/useSafeAction', () => ({
  useSafeAction: () => ({
    executeSafeAction: vi.fn((fn) => fn()),
  }),
}));

vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({
    hasCapability: () => true,
  }),
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => ({
    updateScaleSongSettings: vi.fn(),
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: () => true,
}));

describe('Scale Local Settings Cleanup Integration & Unit Tests', () => {

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
    const result = applyLocalScaleSongSettingsUpdate(input, 'song-target', 'A', 120);
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

  it('12. Integration CENÁRIO A: apagar apenas o tom, salvar e verificar onSave', async () => {
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();

    const { container } = render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        scaleToEdit={{
          id: 'scale-1',
          date: '2026-07-21',
          eventTypeId: 'et-1',
          locationId: 'loc-1',
          time: '10:00',
          songIds: ['song-target', 'song-other'],
          songSettings: {
            'song-target': { key: 'A', bpm: 85 }
          }
        }}
        preselectedSongIds={['song-target', 'song-other']}
        onSave={onSaveMock}
        onClose={onCloseMock}
        isSubmitting={false}
      />
    );

    // 2. acessar a etapa Revisão
    const reviewTab = screen.getByText('Revisão');
    fireEvent.click(reviewTab);

    // Wait for step transition to complete and show song settings buttons
    await waitFor(() => {
      expect(screen.queryAllByText(/Editar ajustes/i).length).toBeGreaterThan(0);
    });

    // 3. música possui override { key: "A", bpm: 85 }
    // 4. abrir Ajustes
    const editBtns = screen.getAllByText(/Editar ajustes/i);
    // Click edit on the target song card
    fireEvent.click(editBtns[0]);

    // 5. apagar apenas o tom
    const editPanel = document.getElementById('edit-panel-song-target');
    expect(editPanel).toBeInTheDocument();
    const keySelect = editPanel!.querySelector('select');
    expect(keySelect).toBeInTheDocument();
    fireEvent.change(keySelect!, { target: { value: '' } });

    // 6. aplicar
    const applyBtn = screen.getByText(/Aplicar/i);
    fireEvent.click(applyBtn);

    // 7. salvar formulário
    const saveBtn = screen.getByText('Salvar Rascunho');
    fireEvent.click(saveBtn);

    // 8. verificar no onSave real
    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalled();
    });

    const savedPayload = onSaveMock.mock.calls[0][0];
    expect(savedPayload.songIds).toEqual(['song-target', 'song-other']);
    expect(savedPayload.songSettings['song-target']).toEqual({ bpm: 85 });
    expect(savedPayload.songSettings['song-target'].key).toBeUndefined();
    // outras músicas intactas
    expect(savedPayload.songSettings['song-other']).toBeUndefined();
  });

  it('13. Integration CENÁRIO B: apagar apenas BPM, salvar e verificar onSave', async () => {
    const onSaveMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();

    const { container } = render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        scaleToEdit={{
          id: 'scale-1',
          date: '2026-07-21',
          eventTypeId: 'et-1',
          locationId: 'loc-1',
          time: '10:00',
          songIds: ['song-target', 'song-other'],
          songSettings: {
            'song-target': { key: 'A', bpm: 85 }
          }
        }}
        preselectedSongIds={['song-target', 'song-other']}
        onSave={onSaveMock}
        onClose={onCloseMock}
        isSubmitting={false}
      />
    );

    // 2. acessar a etapa Revisão
    const reviewTab = screen.getByText('Revisão');
    fireEvent.click(reviewTab);

    // Wait for step transition to complete and show song settings buttons
    await waitFor(() => {
      expect(screen.queryAllByText(/Editar ajustes/i).length).toBeGreaterThan(0);
    });

    // 3. música possui override { key: "A", bpm: 85 }
    // 4. abrir Ajustes
    const editBtns = screen.getAllByText(/Editar ajustes/i);
    fireEvent.click(editBtns[0]);

    // 5. apagar apenas BPM
    const editPanel = document.getElementById('edit-panel-song-target');
    expect(editPanel).toBeInTheDocument();
    const bpmInput = editPanel!.querySelector('input[type="number"]');
    expect(bpmInput).toBeInTheDocument();
    fireEvent.change(bpmInput!, { target: { value: '' } });

    // 6. aplicar
    const applyBtn = screen.getByText(/Aplicar/i);
    fireEvent.click(applyBtn);

    // 7. salvar formulário
    const saveBtn = screen.getByText('Salvar Rascunho');
    fireEvent.click(saveBtn);

    // 8. verificar no onSave real
    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalled();
    });

    const savedPayload = onSaveMock.mock.calls[0][0];
    expect(savedPayload.songIds).toEqual(['song-target', 'song-other']);
    expect(savedPayload.songSettings['song-target']).toEqual({ key: 'A' });
    expect(savedPayload.songSettings['song-target'].bpm).toBeUndefined();
  });
});
