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
      expect((songToRepair as any).id).toBeUndefined(); // ChordKeyRepairDraftSong never includes ID!
      expect((songToRepair as any).organizationId).toBeUndefined();
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
    const saveBtn = screen.getByRole('button', { name: /Salvar Alterações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
      const savedSong = mockOnSave.mock.calls[0][0];
      expect(savedSong.key).toBe('C'); // Declarative key preserved as C!
      expect(savedSong.chords).toBe('D   A   Bm   G'); // Chords updated
      expect(savedSong.metadata.chordContentKey).toBe('D'); // Metadata updated
    });
  });

  it('música nova envia ChordKeyRepairDraftSong sem id, sem organizationId, sem createdAt e sem createdBy', async () => {
    mockOpenChordKeyRepair.mockImplementation((draftSong, onSuccess, mode) => {
      expect(mode).toBe('draft');
      expect((draftSong as any).id).toBeUndefined();
      expect((draftSong as any).organizationId).toBeUndefined();
      expect((draftSong as any).createdAt).toBeUndefined();
      expect((draftSong as any).createdBy).toBeUndefined();
      expect(draftSong.title).toBe('Nova Música em Rascunho');
      expect(draftSong.artist).toBe('Artista Teste');
      expect(draftSong.key).toBe('G');
      expect(draftSong.chords).toBe('G D Em C');

      // Simulate applying draft repair to A
      onSuccess({
        ...draftSong,
        chords: 'A E F#m D',
        metadata: {
          ...draftSong.metadata,
          chordContentKey: 'A',
          chordKeyCorrection: {
            version: 1,
            previousContentKey: 'G',
            correctedContentKey: 'A',
            signedSemitones: 2,
            normalizedSemitones: 2,
            method: 'manual',
            correctedAt: new Date().toISOString(),
            correctedBy: 'user123'
          }
        }
      });
    });

    const { container } = render(
      <SongForm
        songToEdit={null}
        onSave={mockOnSave}
        onClose={mockOnClose}
        isSubmitting={false}
        tags={[]}
      />
    );

    // Fill form fields
    fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: 'Nova Música em Rascunho' } });
    fireEvent.change(screen.getByLabelText(/Artista/i), { target: { value: 'Artista Teste' } });
    fireEvent.change(screen.getByLabelText(/Tom/i), { target: { value: 'G' } });
    fireEvent.change(container.querySelector('#bpm')!, { target: { value: '120' } });
    
    const chordsTextarea = container.querySelector('#chords') as HTMLTextAreaElement;
    fireEvent.change(chordsTextarea, { target: { value: 'G D Em C' } });

    // Click "Ajustar tom da cifra"
    const repairBtn = screen.getByText('Ajustar tom da cifra');
    fireEvent.click(repairBtn);

    expect(mockOpenChordKeyRepair).toHaveBeenCalled();

    // Check key input remains G
    expect((screen.getByLabelText(/Tom/i) as HTMLInputElement).value).toBe('G');
    // Check chords updated to A
    expect(chordsTextarea.value).toBe('A E F#m D');

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Adicionar Música/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
      const savedSong = mockOnSave.mock.calls[0][0];
      expect(savedSong.title).toBe('Nova Música em Rascunho');
      expect(savedSong.key).toBe('G');
      expect(savedSong.chords).toBe('A E F#m D');
      expect(savedSong.metadata.chordContentKey).toBe('A');
    });
  });
});
