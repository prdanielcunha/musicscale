import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalProvider, useModals } from '../../contexts/ModalContext';

import { MemoryRouter } from 'react-router-dom';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    effectiveOrganizationId: 'org123',
    permissions: { manageSongs: true },
    userProfile: { uid: 'user123' },
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: vi.fn(),
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
  ChordKeyRepairSheet: ({ isOpen, onClose, song, onSuccess, mode }: any) => {
    if (!isOpen) return null;
    return (
      <div data-testid="chord-key-repair-sheet">
        <span>Modo: {mode}</span>
        <button onClick={() => onSuccess({ ...song, chords: 'G' })}>Aplicar Correção Mock</button>
        <button onClick={onClose}>Fechar Mock</button>
      </div>
    );
  },
}));

const TestComponent = () => {
  const { openChordKeyRepair } = useModals();

  return (
    <div>
      <button
        onClick={() => {
          openChordKeyRepair(
            { id: 'song123', chords: 'C' } as any,
            (song) => console.log('success', song.chords),
            'draft'
          );
        }}
      >
        Abrir Modal
      </button>
    </div>
  );
};

describe('ModalContext - ChordKeyRepair', () => {
  it('deve abrir o ChordKeyRepairSheet através do ModalContext', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <ModalProvider>
          <TestComponent />
        </ModalProvider>
      </MemoryRouter>
    );

    // Initial state: not open
    expect(screen.queryByTestId('chord-key-repair-sheet')).not.toBeInTheDocument();

    // Open modal
    fireEvent.click(screen.getByText('Abrir Modal'));
    expect(screen.getByTestId('chord-key-repair-sheet')).toBeInTheDocument();
    expect(screen.getByText('Modo: draft')).toBeInTheDocument();

    // Test success callback
    fireEvent.click(screen.getByText('Aplicar Correção Mock'));
    expect(consoleSpy).toHaveBeenCalledWith('success', 'G');

    // Test close
    fireEvent.click(screen.getByText('Fechar Mock'));
    
    await waitFor(() => {
        expect(screen.queryByTestId('chord-key-repair-sheet')).not.toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });
});
