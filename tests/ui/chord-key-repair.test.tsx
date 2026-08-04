import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChordKeyRepairSheet } from '../../components/songs/ChordKeyRepairSheet';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../contexts/ApiContext';
import { useToast } from '../../contexts/ToastContext';

// Mock contexts and hooks
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: vi.fn(),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValueOrOptions?: any, options?: any) => {
      let opts = options;
      let defVal = defaultValueOrOptions;
      if (typeof defaultValueOrOptions === 'object') {
        opts = defaultValueOrOptions;
        defVal = undefined;
      }
      if (key === 'chordKeyRepair.semitone') {
        const count = opts?.count || 0;
        return count === 1 ? 'semitom' : 'semitons';
      }
      if (opts) {
        let result = typeof defVal === 'string' ? defVal : key;
        Object.keys(opts).forEach(p => {
          result = result.replace(`{{${p}}}`, opts[p]);
        });
        return result;
      }
      return typeof defVal === 'string' ? defVal : key;
    },
  }),
}));

const mockSong = {
  id: 'song123',
  title: 'Meu Altar',
  artist: 'Ministerio de Louvor',
  key: 'C',
  chords: 'C G Am F',
  metadata: {
    chordContentKey: 'C',
    shapeKey: 'C',
  },
  organizationId: 'org123',
  lastModifiedAt: '2026-08-01T12:00:00.000Z',
};

describe('ChordKeyRepairSheet', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockRepairOrganizationSongChordKey = vi.fn();
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Auth mock
    (useAuth as any).mockReturnValue({
      effectiveOrganizationId: 'org123',
      permissions: {
        'musicscale.songs.edit': true,
      },
      userProfile: { uid: 'user123', organizationRole: 'admin' },
    });

    // Setup Api mock
    (useApi as any).mockReturnValue({
      repairOrganizationSongChordKey: mockRepairOrganizationSongChordKey,
    });

    // Setup Toast mock
    (useToast as any).mockReturnValue({
      toast: mockToast,
    });
  });

  it('deve inicializar com o tom de origem de acordo com os metadados e focar no botão fechar', async () => {
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={mockSong as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );

    const title = screen.getByText('Ajustar tom da cifra');
    expect(title).toBeInTheDocument();

    // Source select should have 'C'
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('C');
    expect(selects[1]).toHaveValue('C'); // target defaults to song.key ('C')
  });

  it('deve executar no modo draft (sem chamada de API, apenas sucesso local)', async () => {
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={mockSong as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    const selects = screen.getAllByRole('combobox');
    
    // Change target key to D
    fireEvent.change(selects[1], { target: { value: 'D' } });

    // Click Apply
    const applyBtn = screen.getByText('Aplicar correção');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      // onSuccess should be called
      expect(mockOnSuccess).toHaveBeenCalled();
      // No API call
      expect(mockRepairOrganizationSongChordKey).not.toHaveBeenCalled();
      // Check first arg to onSuccess
      const updatedSong = mockOnSuccess.mock.calls[0][0];
      expect(updatedSong.metadata.chordContentKey).toBe('D');
      // onClose called
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('deve executar no modo persisted (com chamada de API e toast de sucesso)', async () => {
    mockRepairOrganizationSongChordKey.mockResolvedValue(mockSong);

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={mockSong as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );

    const selects = screen.getAllByRole('combobox');
    
    // Change target key to E
    fireEvent.change(selects[1], { target: { value: 'E' } });

    // Click Apply
    const applyBtn = screen.getByText('Aplicar correção');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      // API call made with sourceConfirmation
      expect(mockRepairOrganizationSongChordKey).toHaveBeenCalledWith({
        songId: 'song123',
        organizationId: 'org123',
        sourceChordKey: 'C',
        targetChordKey: 'E',
        expectedUpdatedAt: '2026-08-01T12:00:00.000Z',
        sourceConfirmation: {
          type: 'metadata',
          metadataKey: 'C',
        },
      });
      expect(mockToast).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('deve fechar ao pressionar a tecla Escape', () => {
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={mockSong as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('deve exibir banner de conflito e permitir confirmar tom detectado Usar G para habilitar Aplicar', async () => {
    const conflictingSong = {
      ...mockSong,
      chords: 'G D/F# Em7 A', // Detected as G with high confidence
      metadata: {
        chordContentKey: 'C', // Contradicts G!
        shapeKey: 'C',
      },
    };

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={conflictingSong as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    // Check conflict banner is rendered
    expect(screen.getByText('O tom informado não corresponde aos acordes encontrados')).toBeInTheDocument();

    // Check Apply button is disabled due to unconfirmed conflict
    const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
    expect(applyBtn).toBeDisabled();

    // Click "Usar G" button inside conflict banner
    const useGBtn = screen.getByText('Usar G');
    fireEvent.click(useGBtn);

    // Target key set to F
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'F' } });

    // Conflict banner resolves or source is confirmed, Apply button becomes enabled
    expect(applyBtn).not.toBeDisabled();

    // Check signed semitones label shows exact -2 semitons and not duplicate -2 2 semitons
    expect(screen.getByText('-2 semitons')).toBeInTheDocument();
    expect(screen.queryByText('-2 2 semitons')).not.toBeInTheDocument();
  });

  it('deve usar shapeKey sem normalização apenas como sugestão e exigir confirmação explícita', async () => {
    const shapeSong = {
      ...mockSong,
      chords: 'C G Am F', // Detected as C
      metadata: {
        shapeKey: 'G', // Shape key G differs from detected C
        // chordContentKey is absent, normalizedToConcertKey is not true
      },
    };

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={shapeSong as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('G'); // suggested in selector from shapeKey

    const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
    expect(applyBtn).toBeDisabled(); // disabled until user confirms!

    // Confirm override or detected
    const confirmBtn = screen.getByText('Confirmar uso de G');
    fireEvent.click(confirmBtn);

    // Target key to D
    fireEvent.change(selects[1], { target: { value: 'D' } });
    expect(applyBtn).not.toBeDisabled();
  });

  it('não deve usar shapeKey com normalizedToConcertKey === true como tom de origem', async () => {
    const normalizedShapeSong = {
      ...mockSong,
      chords: 'C G Am F', // Detected as C
      metadata: {
        shapeKey: 'G',
        normalizedToConcertKey: true,
      },
    };

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={normalizedShapeSong as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    const selects = screen.getAllByRole('combobox');
    // Source should NOT be initialized to G from normalized shapeKey
    // It uses detected key C
    expect(selects[0]).toHaveValue('C');
    // Apply button disabled because sourceConfirmation is null (detected requires confirmation)
    const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
    expect(applyBtn).toBeDisabled();
  });

  it('deve restaurar o foco ao elemento original no unmount', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    expect(document.activeElement).toBe(button);

    const { unmount } = render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={mockSong as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    unmount();
    expect(document.activeElement).toBe(button);
    document.body.removeChild(button);
  });

  it('deve focar a ação principal (Aplicar) quando origem e destino existem e origem está confirmada', async () => {
    // mockSong has C as source key (metadata) and D as target key (song.key), which enables Apply button
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={{ ...mockSong, key: 'D' } as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    await waitFor(() => {
      const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
      expect(document.activeElement).toBe(applyBtn);
    });
  });

  it('deve focar o controle de confirmação explícita quando origem e destino existem mas origem não está confirmada', async () => {
    // Unconfirmed source: detected candidate is E, metadata is missing, target key is C from mockSong.key
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={{
          ...mockSong,
          metadata: {},
          chords: 'E A B7'
        } as any}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    await waitFor(() => {
      const useEBtn = screen.getByRole('button', { name: /Usar E/i });
      expect(document.activeElement).toBe(useEBtn);
    });
  });
});
