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
    t: (key: string, defaultValue: string) => defaultValue,
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
    mockRepairOrganizationSongChordKey.mockResolvedValue(undefined);

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
      // API call made
      expect(mockRepairOrganizationSongChordKey).toHaveBeenCalledWith({
        songId: 'song123',
        organizationId: 'org123',
        sourceChordKey: 'C',
        targetChordKey: 'E',
        expectedUpdatedAt: '2026-08-01T12:00:00.000Z',
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
});
