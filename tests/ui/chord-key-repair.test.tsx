import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChordKeyRepairSheet } from '../../components/songs/ChordKeyRepairSheet';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../contexts/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import type { PopulatedSong, ChordKeyRepairDraftSong } from '../../types';

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

const persistedSong: PopulatedSong = {
  id: 'song123',
  title: 'Meu Altar',
  artist: 'Ministerio de Louvor',
  key: 'C',
  chords: 'C G Am F',
  lyrics: 'Minha letra',
  chordsUrl: '',
  videoUrl: '',
  status: 'active',
  tagIds: [],
  tags: [],
  createdAt: '2026-08-01T12:00:00.000Z',
  createdBy: { uid: 'user123', displayName: 'User', photoURL: null },
  lastPlayed: null,
  metadata: {
    chordContentKey: 'C',
    shapeKey: 'C',
  },
  organizationId: 'org123',
  lastModifiedAt: '2026-08-01T12:00:00.000Z',
};

const draftSong: ChordKeyRepairDraftSong = {
  title: 'Meu Altar',
  artist: 'Ministerio de Louvor',
  key: 'C',
  chords: 'C G Am F',
  metadata: {
    chordContentKey: 'C',
    shapeKey: 'C',
  },
};

describe('ChordKeyRepairSheet', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockRepairOrganizationSongChordKey = vi.fn();
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      effectiveOrganizationId: 'org123',
      permissions: {
        'musicscale.songs.edit': true,
      },
      userProfile: { uid: 'user123', displayName: 'User', photoURL: null, organizationRole: 'admin', organizationId: 'org123', email: 'user@test.com' },
    } as ReturnType<typeof useAuth>);

    vi.mocked(useApi).mockReturnValue({
      repairOrganizationSongChordKey: mockRepairOrganizationSongChordKey,
    } as unknown as ReturnType<typeof useApi>);

    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
    } as ReturnType<typeof useToast>);
  });

  it('deve inicializar com o tom de origem de acordo com os metadados', async () => {
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={persistedSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );

    const title = screen.getByText('Ajustar tom da cifra');
    expect(title).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('C');
    expect(selects[1]).toHaveValue('C');
  });

  it('deve executar no modo draft (sem chamada de API, apenas sucesso local)', async () => {
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={draftSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'D' } });

    const applyBtn = screen.getByText('Aplicar correção');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockRepairOrganizationSongChordKey).not.toHaveBeenCalled();
      const updatedSong = mockOnSuccess.mock.calls[0][0];
      expect(updatedSong.metadata.chordContentKey).toBe('D');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('deve executar no modo persisted (com chamada de API e toast de sucesso)', async () => {
    mockRepairOrganizationSongChordKey.mockResolvedValue(persistedSong);

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={persistedSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'E' } });

    const applyBtn = screen.getByText('Aplicar correção');
    fireEvent.click(applyBtn);

    await waitFor(() => {
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
        song={persistedSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('deve exibir banner de conflito e permitir confirmar tom detectado Usar G para habilitar Aplicar', async () => {
    const conflictingSong: ChordKeyRepairDraftSong = {
      ...draftSong,
      chords: 'G D/F# Em7 A',
      metadata: {
        chordContentKey: 'C',
        shapeKey: 'C',
      },
    };

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={conflictingSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    expect(screen.getByText('O tom informado não corresponde aos acordes encontrados')).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
    expect(applyBtn).toBeDisabled();

    const useGBtn = screen.getByText('Usar G');
    fireEvent.click(useGBtn);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'F' } });

    expect(applyBtn).not.toBeDisabled();
    expect(screen.getByText('-2 semitons')).toBeInTheDocument();
    expect(screen.queryByText('-2 2 semitons')).not.toBeInTheDocument();
  });

  it('deve usar shapeKey sem normalização apenas como sugestão e exigir confirmação explícita', async () => {
    const shapeSong: ChordKeyRepairDraftSong = {
      ...draftSong,
      chords: 'C G Am F',
      metadata: {
        shapeKey: 'G',
      },
    };

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={shapeSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('G');

    const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
    expect(applyBtn).toBeDisabled();

    const confirmBtn = screen.getByText('Confirmar uso de G');
    fireEvent.click(confirmBtn);

    fireEvent.change(selects[1], { target: { value: 'D' } });
    expect(applyBtn).not.toBeDisabled();
  });

  it('não deve usar shapeKey com normalizedToConcertKey === true como tom de origem', async () => {
    const normalizedShapeSong: ChordKeyRepairDraftSong = {
      ...draftSong,
      chords: 'C G Am F',
      metadata: {
        shapeKey: 'G',
        normalizedToConcertKey: true,
      },
    };

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={normalizedShapeSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('C');
    const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
    expect(applyBtn).toBeDisabled();
  });

  // --- FOCUS MANAGEMENT TESTS (SECTION 4) ---

  it('1. origem vazia foca origem', async () => {
    const emptySourceSong: PopulatedSong = {
      ...persistedSong,
      key: 'C',
      originalKey: undefined,
      selectedKey: undefined,
      chords: 'Texto sem acordes reconhecidos',
      metadata: {},
    };
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={emptySourceSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(document.activeElement).toBe(selects[0]);
    });
  });

  it('2. origem não confirmada foca confirmação', async () => {
    const unconfirmedSong: PopulatedSong = {
      ...persistedSong,
      metadata: {},
      chords: 'E A B7',
      key: 'C',
    };
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={unconfirmedSong}
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

  it('3. origem confirmada e destino vazio foca destino', async () => {
    const emptyTargetSong: PopulatedSong = {
      ...persistedSong,
      key: undefined,
      originalKey: undefined,
      selectedKey: undefined,
      metadata: { chordContentKey: 'C' },
    };
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={emptyTargetSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(document.activeElement).toBe(selects[1]);
    });
  });

  it('4. origem e destino iguais focam destino', async () => {
    const sameKeySong: PopulatedSong = {
      ...persistedSong,
      key: 'C',
      metadata: { chordContentKey: 'C' },
    };
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={sameKeySong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(document.activeElement).toBe(selects[1]);
    });
  });

  it('5. Aplicar desabilitado nunca recebe foco', async () => {
    const sameKeySong: PopulatedSong = {
      ...persistedSong,
      key: 'C',
      metadata: { chordContentKey: 'C' },
    };
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={sameKeySong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );
    await waitFor(() => {
      const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
      expect(applyBtn).toBeDisabled();
      expect(document.activeElement).not.toBe(applyBtn);
    });
  });

  it('6. origem confirmada e destino válido focam Aplicar', async () => {
    const validTargetSong: PopulatedSong = {
      ...persistedSong,
      key: 'D',
      metadata: { chordContentKey: 'C' },
    };
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={validTargetSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );
    await waitFor(() => {
      const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
      expect(applyBtn).not.toBeDisabled();
      expect(document.activeElement).toBe(applyBtn);
    });
  });

  it('7. document.activeElement permanece dentro do modal', async () => {
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={persistedSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
  });

  it('8. unmount restaura foco', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    expect(document.activeElement).toBe(button);

    const { unmount } = render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={draftSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );

    unmount();
    expect(document.activeElement).toBe(button);
    document.body.removeChild(button);
  });

  it('9. requestAnimationFrame é cancelado no unmount', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={draftSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="draft"
      />
    );
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });

  it('10. nenhum setTimeout é usado para gerenciamento de foco', async () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={persistedSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
        mode="persisted"
      />
    );
    await waitFor(() => {
      expect(screen.getByText('Ajustar tom da cifra')).toBeInTheDocument();
    });

    expect(rafSpy).toHaveBeenCalled();

    // Verify no setTimeout call was used to defer element focus
    const focusInTimeout = setTimeoutSpy.mock.calls.some(([fn]) => {
      return typeof fn === 'function' && fn.toString().includes('focus');
    });
    expect(focusInTimeout).toBe(false);

    setTimeoutSpy.mockRestore();
    rafSpy.mockRestore();
  });
});
