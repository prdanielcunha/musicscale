import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SongForm from '../../components/songs/SongForm';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../contexts/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import { useModals } from '../../contexts/ModalContext';

const mockOpenChordKeyRepair = vi.fn();

vi.mock('../../contexts/ModalContext', () => ({
  useModals: () => ({
    openChordKeyRepair: mockOpenChordKeyRepair,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

describe('SongForm + ChordKeyRepair Integration', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useAuth as any).mockReturnValue({
      effectiveOrganizationId: 'org123',
      permissions: {
        'musicscale.songs.edit': true,
        manageSongs: true,
      },
      userProfile: { uid: 'user123', organizationRole: 'admin' },
    });

    (useApi as any).mockReturnValue({
      repairOrganizationSongChordKey: vi.fn(),
    });

    (useToast as any).mockReturnValue({
      toast: vi.fn(),
    });
  });

  it('deve abrir a ferramenta de ajuste de tom a partir do SongForm, atualizar a cifra e metadata em modo draft e manter o tom declarativo (campo key) intacto', async () => {
    const existingSong = {
      id: 'song123',
      title: 'Quão Grande É o Meu Deus',
      artist: 'Soraya Moraes',
      key: 'C',
      chords: 'C   G   Am   F',
      bpm: 120,
      organizationId: 'org123',
      metadata: {
        chordContentKey: 'C',
      },
    };

    mockOpenChordKeyRepair.mockImplementation((songToRepair, onSuccess, mode) => {
      expect(mode).toBe('draft');
      expect(songToRepair.id).toBe('song123'); // Uses real ID, not temp-form-song
      // Simulate applying draft key repair to D
      onSuccess({
        ...songToRepair,
        chords: 'D   A   Bm   G',
        metadata: {
          ...songToRepair.metadata,
          chordContentKey: 'D',
          chordKeyCorrection: {
            version: 1,
            previousContentKey: 'C',
            correctedContentKey: 'D',
            signedSemitones: 2,
            normalizedSemitones: 2,
            method: 'manual'
          }
        }
      });
    });

    const { container } = render(
      <SongForm
        songToEdit={existingSong as any}
        onSave={mockOnSave}
        onClose={mockOnClose}
        isSubmitting={false}
        tags={[]}
      />
    );

    // Verify key input is initially C
    const keyInput = screen.getByLabelText(/Tom/i) as HTMLInputElement;
    expect(keyInput.value).toBe('C');

    // Click "Ajustar tom da cifra" button
    const repairBtn = screen.getByText('Ajustar tom da cifra');
    fireEvent.click(repairBtn);

    expect(mockOpenChordKeyRepair).toHaveBeenCalled();

    // Check that declarative key input is STILL "C"
    expect(keyInput.value).toBe('C');

    // Check that chords textarea now contains "D" transposed chords
    const chordsTextarea = container.querySelector('#chords') as HTMLTextAreaElement;
    expect(chordsTextarea.value).toBe('D   A   Bm   G');

    // Submit SongForm
    const saveBtn = screen.getByRole('button', { name: /Salvar/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
      const savedSong = mockOnSave.mock.calls[0][0];
      expect(savedSong.key).toBe('C'); // Declarative key preserved as C!
      expect(savedSong.chords).toBe('D   A   Bm   G'); // Chords updated
      expect(savedSong.metadata.chordContentKey).toBe('D'); // Metadata updated
    });
  });
});
