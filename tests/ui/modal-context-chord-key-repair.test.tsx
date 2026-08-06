import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalProvider, useModals } from '../../contexts/ModalContext';
import { MemoryRouter } from 'react-router-dom';
import type { PopulatedSong, ChordKeyRepairDraftSong } from '../../types';
import type { ChordKeyRepairSheetProps } from '../../components/songs/ChordKeyRepairSheet';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    effectiveOrganizationId: 'org123',
    permissions: { manageSongs: true },
    userProfile: { uid: 'user123' },
  }),
}));

const mockToast = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => ({}),
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({}),
}));

vi.mock('../../contexts/SuggestionContext', () => ({
  useSuggestionsContext: () => ({}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../components/songs/ChordKeyRepairSheet', () => ({
  ChordKeyRepairSheet: ({ isOpen, onClose, song, onSuccess, mode }: ChordKeyRepairSheetProps) => {
    if (!isOpen) return null;
    return (
      <div data-testid="chord-key-repair-sheet">
        <span>Modo: {mode}</span>
        <button onClick={() => onSuccess({ ...(song as any), chords: 'G' })}>Aplicar Correção Mock</button>
        <button onClick={onClose}>Fechar Mock</button>
      </div>
    );
  },
}));

const fullPersistedSong: PopulatedSong = {
  id: 'song123',
  organizationId: 'org123',
  title: 'Persisted Song',
  artist: 'Artist',
  key: 'C',
  chords: 'C',
  lyrics: '',
  chordsUrl: '',
  videoUrl: '',
  status: 'active',
  tagIds: [],
  tags: [],
  createdAt: '2026-08-01T12:00:00.000Z',
  createdBy: { uid: 'user123', displayName: 'User', photoURL: null },
  lastPlayed: null,
};

const fullDraftSong: ChordKeyRepairDraftSong = {
  title: 'Draft Song',
  chords: 'C',
  key: 'C',
};

const TestComponent = () => {
  const { openDraftChordKeyRepair, openPersistedChordKeyRepair } = useModals();

  return (
    <div>
      <button
        onClick={() => {
          openDraftChordKeyRepair(
            fullDraftSong,
            (song) => console.log('success draft', song.title)
          );
        }}
      >
        Abrir Draft
      </button>
      <button
        onClick={() => {
          openPersistedChordKeyRepair(
            fullPersistedSong,
            (song) => console.log('success persisted', song.title)
          );
        }}
      >
        Abrir Persisted
      </button>
      <button
        onClick={() => {
          // Attempting persisted without id
          openPersistedChordKeyRepair(
            { organizationId: 'org123', chords: 'C' } as unknown as PopulatedSong,
            () => {}
          );
        }}
      >
        Abrir Persisted Sem ID
      </button>
      <button
        onClick={() => {
          // Attempting persisted without organizationId
          openPersistedChordKeyRepair(
            { id: 'song123', chords: 'C' } as unknown as PopulatedSong,
            () => {}
          );
        }}
      >
        Abrir Persisted Sem Org
      </button>
    </div>
  );
};

describe('ModalContext - ChordKeyRepair', () => {
  it('deve rejeitar persisted sem id', async () => {
    mockToast.mockClear();
    render(
      <MemoryRouter>
        <ModalProvider>
          <TestComponent />
        </ModalProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Abrir Persisted Sem ID'));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro' }));
    expect(screen.queryByTestId('chord-key-repair-sheet')).not.toBeInTheDocument();
  });

  it('deve rejeitar persisted sem organizationId', async () => {
    mockToast.mockClear();
    render(
      <MemoryRouter>
        <ModalProvider>
          <TestComponent />
        </ModalProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Abrir Persisted Sem Org'));
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro' }));
    expect(screen.queryByTestId('chord-key-repair-sheet')).not.toBeInTheDocument();
  });

  it('deve abrir draft sem exigir id ou organizationId e tipagem correta', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <MemoryRouter>
        <ModalProvider>
          <TestComponent />
        </ModalProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Abrir Draft'));
    expect(screen.getByTestId('chord-key-repair-sheet')).toBeInTheDocument();
    expect(screen.getByText('Modo: draft')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Aplicar Correção Mock'));
    expect(consoleSpy).toHaveBeenCalledWith('success draft', 'Draft Song');
  });

  it('deve abrir persisted com id e organizationId', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    render(
      <MemoryRouter>
        <ModalProvider>
          <TestComponent />
        </ModalProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Abrir Persisted'));
    expect(screen.getByTestId('chord-key-repair-sheet')).toBeInTheDocument();
    expect(screen.getByText('Modo: persisted')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Aplicar Correção Mock'));
    expect(consoleSpy).toHaveBeenCalledWith('success persisted', 'Persisted Song');
  });
});
