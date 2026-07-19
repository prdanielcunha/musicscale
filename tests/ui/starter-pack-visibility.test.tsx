import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import SongsPage from '../../pages/SongsPage';

// Mocks
vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  useLimits: vi.fn(),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModals: vi.fn(),
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('../../hooks/useMusicScaleEntitlements', () => ({
  useMusicScaleFeature: vi.fn(),
}));

vi.mock('../../hooks/useStarterPackAllowance', () => ({
  useStarterPackAllowance: vi.fn(),
}));

// We need to mock the StarterRepertoireModal because we just want to verify its prop "isOpen" and "onCancel".
// Actually, it's easier to assert that it is rendered and we can trigger onCancel from it, or we can just find it if it renders a specific DOM element.
// Let's mock it to make testing easier.
vi.mock('../../components/onboarding/StarterRepertoireModal', () => ({
  StarterRepertoireModal: ({ isOpen, onCancel, onCompleted }: any) => (
    isOpen ? (
      <div data-testid="mock-starter-modal">
        <button data-testid="mock-modal-cancel" onClick={onCancel}>Cancel</button>
        <button data-testid="mock-modal-complete" onClick={onCompleted}>Complete</button>
      </div>
    ) : null
  ),
}));

// Import mocks to configure them
import { useMusic } from '../../contexts/MusicDataContext';
import { useAuth, useLimits } from '../../contexts/AuthContext';
import { useModals } from '../../contexts/ModalContext';
import { useApi } from '../../contexts/ApiContext';
import { useMusicScaleFeature } from '../../hooks/useMusicScaleEntitlements';
import { useStarterPackAllowance } from '../../hooks/useStarterPackAllowance';

describe('SongsPage Starter Pack Visibility', () => {
  const mockRefreshAllowance = vi.fn();
  const mockRefreshData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (useAuth as any).mockReturnValue({
      user: { uid: '123' },
      organization: { id: 'org1' },
      permissions: { manageSongs: true },
    });
    
    (useLimits as any).mockReturnValue({
      limits: { maxSongs: 100 },
    });
    
    (useMusic as any).mockReturnValue({
      songs: [],
      tags: [],
      starterPack: [],
      loading: false,
      error: null,
      refreshData: mockRefreshData,
    });
    
    (useModals as any).mockReturnValue({
      openSongForm: vi.fn(),
    });
    
    (useApi as any).mockReturnValue({});
    
    (useMusicScaleFeature as any).mockReturnValue(true);
    
    (useStarterPackAllowance as any).mockReturnValue({
      allowance: { remaining: 10, limit: 10, completed: false, started: false, used: 0 },
      starterPack: [],
      loading: false,
      error: null,
      refreshAllowance: mockRefreshAllowance,
    });
  });

  const renderWithRouter = (initialEntries = ['/songs']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/songs" element={<SongsPage />} />
          <Route path="/library" element={<div data-testid="mock-library">Library</div>} />
          <Route path="/" element={<div data-testid="mock-home">Home</div>} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('Cenário 1 e 2: Repertório vazio, saldo 10, autorizado', () => {
    const { container } = renderWithRouter();
    
    const emptyCard = screen.getByTestId('starter-pack-empty-card');
    expect(emptyCard).toBeInTheDocument();
    
    // Verify text
    expect(emptyCard).toHaveTextContent('10 de 10 músicas iniciais disponíveis');
    
    // Test order (Cenário 2: appears before other ways to start)
    const otherWaysTitle = container.querySelector('#other-ways-to-start');
    expect(otherWaysTitle).toBeInTheDocument();
    
    // Compare document position
    expect(
      emptyCard.compareDocumentPosition(otherWaysTitle!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('Cenário 3 e 4: Clique em starter-pack-open-action e cancelar modal', async () => {
    renderWithRouter();
    
    const openBtn = screen.getByTestId('starter-pack-open-action');
    fireEvent.click(openBtn);
    
    // Modal should be open
    const modal = screen.getByTestId('mock-starter-modal');
    expect(modal).toBeInTheDocument();
    
    // Should not have navigated
    expect(screen.queryByTestId('mock-library')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-home')).not.toBeInTheDocument();
    
    // Cenário 4: Cancel modal
    const cancelBtn = screen.getByTestId('mock-modal-cancel');
    fireEvent.click(cancelBtn);
    
    // Modal should be closed
    expect(screen.queryByTestId('mock-starter-modal')).not.toBeInTheDocument();
    // Still in /songs
    expect(screen.getByTestId('starter-pack-empty-card')).toBeInTheDocument();
  });

  it('Cenário 5: Saldo loading', () => {
    (useStarterPackAllowance as any).mockReturnValue({
      allowance: null,
      starterPack: [],
      loading: true,
      error: null,
      refreshAllowance: mockRefreshAllowance,
    });
    
    renderWithRouter();
    
    expect(screen.getByTestId('starter-pack-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('starter-pack-empty-card')).not.toBeInTheDocument();
  });

  it('Cenário 6: Erro no saldo', () => {
    (useStarterPackAllowance as any).mockReturnValue({
      allowance: null,
      starterPack: [],
      loading: false,
      error: 'Failed to fetch',
      refreshAllowance: mockRefreshAllowance,
    });
    
    renderWithRouter();
    
    expect(screen.getByTestId('starter-pack-error')).toBeInTheDocument();
    
    const retryBtn = screen.getByTestId('starter-pack-retry');
    expect(retryBtn).toBeInTheDocument();
    
    fireEvent.click(retryBtn);
    expect(mockRefreshAllowance).toHaveBeenCalled();
  });

  it('Cenário 7: Saldo completed (Repertório vazio)', () => {
    (useStarterPackAllowance as any).mockReturnValue({
      allowance: { remaining: 0, limit: 10, completed: true, started: true, used: 10 },
      starterPack: [],
      loading: false,
      error: null,
      refreshAllowance: mockRefreshAllowance,
    });
    
    renderWithRouter();
    
    expect(screen.queryByTestId('starter-pack-empty-card')).not.toBeInTheDocument();
    // Secondary options should remain (we can check one of them, e.g. Importar da Biblioteca)
    expect(screen.getByText('Biblioteca Viva')).toBeInTheDocument();
  });

  it('Cenário 8: Usuário sem permissão', () => {
    (useAuth as any).mockReturnValue({
      user: { uid: '123' },
      organization: { id: 'org1' },
      permissions: { manageSongs: false }, // NO PERMISSION
    });
    
    renderWithRouter();
    
    expect(screen.queryByTestId('starter-pack-empty-card')).not.toBeInTheDocument();
    // We shouldn't see it
  });

  it('Cenário 9: Repertório preenchido com remaining > 0', () => {
    (useMusic as any).mockReturnValue({
      songs: [{ id: '1', title: 'Song 1' }],
      tags: [],
      starterPack: [],
      loading: false,
      error: null,
      refreshData: mockRefreshData,
    });
    
    const { container } = renderWithRouter();
    
    const compactCard = screen.getByTestId('starter-pack-compact-card');
    expect(compactCard).toBeInTheDocument();
    
    // Check it appears before search/filters
    const searchInput = screen.getByPlaceholderText('Buscar por título ou artista...');
    expect(
      compactCard.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('Cenário 10: Repertório preenchido com completed', () => {
    (useMusic as any).mockReturnValue({
      songs: [{ id: '1', title: 'Song 1' }],
      tags: [],
      starterPack: [],
      loading: false,
      error: null,
      refreshData: mockRefreshData,
    });
    
    (useStarterPackAllowance as any).mockReturnValue({
      allowance: { remaining: 0, limit: 10, completed: true, started: true, used: 10 },
      starterPack: [],
      loading: false,
      error: null,
      refreshAllowance: mockRefreshAllowance,
    });
    
    renderWithRouter();
    
    expect(screen.queryByTestId('starter-pack-compact-card')).not.toBeInTheDocument();
  });

  it('Cenário 11: Troca de organização', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/songs']}>
        <Routes>
          <Route path="/songs" element={<SongsPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    expect(screen.getByTestId('starter-pack-empty-card')).toBeInTheDocument();
    
    // Simulate org change making allowance load
    (useAuth as any).mockReturnValue({
      user: { uid: '123' },
      organization: { id: 'org2' },
      permissions: { manageSongs: true },
    });
    
    (useStarterPackAllowance as any).mockReturnValue({
      allowance: null,
      starterPack: [],
      loading: true,
      error: null,
      refreshAllowance: mockRefreshAllowance,
    });
    
    rerender(
      <MemoryRouter initialEntries={['/songs']}>
        <Routes>
          <Route path="/songs" element={<SongsPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    expect(screen.queryByTestId('starter-pack-empty-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('starter-pack-loading')).toBeInTheDocument();
  });
});

