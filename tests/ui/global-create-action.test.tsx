import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GlobalCreateAction } from '../../components/layout/GlobalCreateAction';
import * as CapabilityHook from '../../hooks/useCapability';
import * as AuthContext from '../../contexts/AuthContext';
import * as EntitlementsHook from '../../hooks/useMusicScaleEntitlements';
import * as ModalContext from '../../contexts/ModalContext';
import * as MusicContext from '../../contexts/MusicDataContext';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultLabel: string) => defaultLabel,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' })
  };
});

const mockOpenScaleForm = vi.fn();
const mockOpenBandScaleForm = vi.fn();
const mockOpenSongForm = vi.fn();
const mockOpenAiSongImport = vi.fn();

afterEach(() => { cleanup(); });

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ organization: { id: 'org_1' } } as any);
  vi.spyOn(MusicContext, 'useMusic').mockReturnValue({ songs: [] } as any);
  vi.spyOn(AuthContext, 'useLimits').mockReturnValue({ limits: { maxSongs: 50 } } as any);
  
  vi.spyOn(ModalContext, 'useModals').mockReturnValue({
    openScaleForm: mockOpenScaleForm,
    openBandScaleForm: mockOpenBandScaleForm,
    openSongForm: mockOpenSongForm,
    openAiSongImport: mockOpenAiSongImport,
  } as any);
  document.body.style.overflow = 'auto';
});

describe('GlobalCreateAction UI', () => {
  it('shows all actions when authorized and opens them', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => true } as any);
    vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(true);

    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    
    // Open menu
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    
    await waitFor(() => {
      expect(screen.getByText('Criar ou importar')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Músicas')).toBeInTheDocument();
    expect(screen.getByText('Escalas')).toBeInTheDocument();
    expect(screen.getByText('Importar com IA')).toBeInTheDocument();
    expect(screen.getByText('Rápido')).toBeInTheDocument();
    expect(screen.getByText('Buscar na Biblioteca Viva')).toBeInTheDocument();
    expect(screen.getByText('Adicionar manualmente')).toBeInTheDocument();
    
    // Click AI
    fireEvent.click(screen.getByText('Importar com IA'));
    
    await waitFor(() => {
      expect(mockOpenAiSongImport).toHaveBeenCalled();
    });
  });

  it('navigates to library intent', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => true } as any);
    vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(true);

    render(<MemoryRouter><GlobalCreateAction variant="mobile" /></MemoryRouter>);
    
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    
    await waitFor(() => {
      expect(screen.getByText('Buscar na Biblioteca Viva')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Buscar na Biblioteca Viva'));
    
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/library?intent=import', { replace: true });
    });
  });
  
  it('hides items without capability', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => false });
    vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => true } as any);
    vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(true);

    const { container } = render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });

  it('omits locked state items for plan limit in this phase', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => false } as any);
    vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(false);

    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    
    await waitFor(() => {
      // Library and AI import should not be in the document
      expect(screen.queryByText('Importar com IA')).not.toBeInTheDocument();
      expect(screen.queryByText('Buscar na Biblioteca Viva')).not.toBeInTheDocument();
      // Manual add should still be there
      expect(screen.getByText('Adicionar manualmente')).toBeInTheDocument();
    });
  });
});
