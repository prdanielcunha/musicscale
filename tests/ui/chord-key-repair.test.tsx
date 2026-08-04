import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  organizationId: 'org123',
  title: 'Meu Altar',
  artist: 'Ministerio de Louvor',
  key: 'C',
  originalKey: 'C',
  selectedKey: 'C',
  status: 'active',
  tagIds: [],
  tags: [],
  lyrics: 'Letra da musica',
  chords: 'C G Am F',
  chordsUrl: '',
  videoUrl: '',
  createdAt: '2026-08-01T12:00:00.000Z',
  lastPlayed: null,
  createdBy: {
    uid: 'user123',
    displayName: 'User Test',
    photoURL: null,
  },
  lastModifiedAt: '2026-08-01T12:00:00.000Z',
  metadata: {
    chordContentKey: 'C',
    shapeKey: 'C',
  },
};

const draftSong: ChordKeyRepairDraftSong = {
  title: 'Meu Altar Draft',
  artist: 'Ministerio de Louvor',
  key: 'C',
  originalKey: 'C',
  selectedKey: 'C',
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
      userProfile: { uid: 'user123', organizationRole: 'admin' },
    } as any);

    vi.mocked(useApi).mockReturnValue({
      repairOrganizationSongChordKey: mockRepairOrganizationSongChordKey,
    } as any);

    vi.mocked(useToast).mockReturnValue({
      toast: mockToast,
    } as any);
  });

  it('deve inicializar e executar no modo draft com draftSong tipada', async () => {
    const mockOnSuccessDraft = vi.fn((updatedSong: ChordKeyRepairDraftSong) => {});
    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={draftSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccessDraft}
        mode="draft"
      />
    );

    const title = screen.getByText('Ajustar tom da cifra');
    expect(title).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('C');
    expect(selects[1]).toHaveValue('C');

    fireEvent.change(selects[1], { target: { value: 'D' } });

    const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockOnSuccessDraft).toHaveBeenCalled();
      expect(mockRepairOrganizationSongChordKey).not.toHaveBeenCalled();
      const updated = mockOnSuccessDraft.mock.calls[0][0];
      expect(updated.metadata.chordContentKey).toBe('D');
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('deve executar no modo persisted com persistedSong tipada e chamada de API', async () => {
    mockRepairOrganizationSongChordKey.mockResolvedValue(persistedSong);
    const mockOnSuccessPersisted = vi.fn((updatedSong: PopulatedSong) => {});

    render(
      <ChordKeyRepairSheet
        isOpen={true}
        song={persistedSong}
        onClose={mockOnClose}
        onSuccess={mockOnSuccessPersisted}
        mode="persisted"
      />
    );

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'E' } });

    const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
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
      expect(mockOnSuccessPersisted).toHaveBeenCalledWith(persistedSong);
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

  describe('Focus Trap & Accessibility Required Tests', () => {
    it('1. origem vazia foca origem', async () => {
      const emptySourceSong: ChordKeyRepairDraftSong = {
        ...draftSong,
        key: '',
        originalKey: '',
        selectedKey: '',
        chords: 'Palavras sem acordes',
        metadata: {},
      };

      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={emptySourceSong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(document.activeElement).toBe(selects[0]);
      });
    });

    it('2. origem não confirmada foca confirmação', async () => {
      const unconfirmedSong: ChordKeyRepairDraftSong = {
        ...draftSong,
        chords: 'E A B7',
        metadata: {},
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

    it('3. destino vazio foca destino', async () => {
      const emptyTargetSong: ChordKeyRepairDraftSong = {
        ...draftSong,
        key: '',
        originalKey: '',
        selectedKey: '',
        metadata: {
          chordContentKey: 'C',
        },
      };

      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={emptyTargetSong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(document.activeElement).toBe(selects[1]);
      });
    });

    it('4. origem e destino iguais focam destino', async () => {
      const sameKeySong: ChordKeyRepairDraftSong = {
        ...draftSong,
        key: 'C',
        metadata: {
          chordContentKey: 'C',
        },
      };

      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={sameKeySong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(document.activeElement).toBe(selects[1]);
      });
    });

    it('5. preview inválido foca destino', async () => {
      const invalidPreviewSong: ChordKeyRepairDraftSong = {
        ...draftSong,
        key: 'D',
        chords: 'X9_INVALID_CHORD',
        metadata: {
          chordContentKey: 'C',
        },
      };

      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={invalidPreviewSong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(document.activeElement).toBe(selects[1]);
      });
    });

    it('6. Aplicar disabled nunca recebe foco', async () => {
      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={draftSong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      await waitFor(() => {
        const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
        expect(applyBtn).toBeDisabled();
        expect(document.activeElement).not.toBe(applyBtn);
      });
    });

    it('7. Aplicar habilitado recebe foco', async () => {
      const validApplySong: ChordKeyRepairDraftSong = {
        ...draftSong,
        key: 'D',
        originalKey: 'D',
        selectedKey: 'D',
        metadata: {
          chordContentKey: 'C',
        },
      };

      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={validApplySong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      await waitFor(() => {
        const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
        expect(applyBtn).not.toBeDisabled();
        expect(document.activeElement).toBe(applyBtn);
      });
    });

    it('8. usuário sem capability vê Aplicar disabled', async () => {
      vi.mocked(useAuth).mockReturnValue({
        effectiveOrganizationId: 'org123',
        permissions: {
          'musicscale.songs.edit': false,
          manageSongs: false,
        },
        userProfile: { uid: 'user123', organizationRole: 'member' },
      } as any);

      const validSong: PopulatedSong = {
        ...persistedSong,
        key: 'D',
        metadata: {
          chordContentKey: 'C',
        },
      };

      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={validSong}
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

    it('9. foco inicial fica dentro da modal', async () => {
      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={draftSong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      const dialog = screen.getByRole('dialog');
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });
    });

    it('10. Tab no último retorna ao primeiro', async () => {
      const user = userEvent.setup();
      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={{ ...draftSong, key: 'D' }}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      const dialog = screen.getByRole('dialog');
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled') && !(el as HTMLButtonElement).disabled);

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      last.focus();
      expect(document.activeElement).toBe(last);

      await user.tab();

      expect(document.activeElement).toBe(first);
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('11. Shift+Tab no primeiro retorna ao último', async () => {
      const user = userEvent.setup();
      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={{ ...draftSong, key: 'D' }}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      const dialog = screen.getByRole('dialog');
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled') && !(el as HTMLButtonElement).disabled);

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      first.focus();
      expect(document.activeElement).toBe(first);

      await user.tab({ shift: true });

      expect(document.activeElement).toBe(last);
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('12. foco externo + Tab retorna à modal', async () => {
      const externalBtn = document.createElement('button');
      externalBtn.textContent = 'External';
      document.body.appendChild(externalBtn);
      externalBtn.focus();

      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={draftSong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      const dialog = screen.getByRole('dialog');
      externalBtn.focus();
      expect(document.activeElement).toBe(externalBtn);

      fireEvent.keyDown(window, { key: 'Tab' });

      expect(dialog.contains(document.activeElement)).toBe(true);
      document.body.removeChild(externalBtn);
    });

    it('13. disabled não entra no ciclo', async () => {
      const user = userEvent.setup();
      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={draftSong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      const dialog = screen.getByRole('dialog');
      const applyBtn = screen.getByRole('button', { name: /Aplicar correção/i });
      expect(applyBtn).toBeDisabled();

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled') && !(el as HTMLButtonElement).disabled);

      const last = focusables[focusables.length - 1];
      last.focus();

      await user.tab();

      expect(document.activeElement).not.toBe(applyBtn);
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('14. hidden não entra no ciclo', async () => {
      const user = userEvent.setup();
      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={draftSong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      const dialog = screen.getByRole('dialog');
      const hiddenBtn = document.createElement('button');
      hiddenBtn.setAttribute('hidden', 'true');
      hiddenBtn.textContent = 'Hidden Button';
      dialog.appendChild(hiddenBtn);

      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => !el.hasAttribute('disabled') && !el.hasAttribute('hidden'));

      const last = focusables[focusables.length - 1];
      last.focus();

      await user.tab();

      expect(document.activeElement).not.toBe(hiddenBtn);
      expect(dialog.contains(document.activeElement)).toBe(true);

      dialog.removeChild(hiddenBtn);
    });

    it('15. listener é removido no unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
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

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });

    it('16. requestAnimationFrame é cancelado', () => {
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

    it('17. nenhum setTimeout é usado', async () => {
      const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

      render(
        <ChordKeyRepairSheet
          isOpen={true}
          song={draftSong}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
          mode="draft"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Ajustar tom da cifra')).toBeInTheDocument();
      });

      const setTimeoutForFocus = setTimeoutSpy.mock.calls.some(([fn]) => {
        return typeof fn === 'function' && fn.toString().includes('focus');
      });
      expect(setTimeoutForFocus).toBe(false);

      setTimeoutSpy.mockRestore();
    });

    it('18. foco original é restaurado no unmount', () => {
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
  });
});
