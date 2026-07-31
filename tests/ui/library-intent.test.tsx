import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LibraryPage from '../../pages/LibraryPage';
import * as AuthContext from '../../contexts/AuthContext';
import * as MusicDataContext from '../../contexts/MusicDataContext';
import * as CapabilityHook from '../../hooks/useCapability';
import * as ApiContext from '../../contexts/ApiContext';
import * as StarterPackHook from '../../hooks/useStarterPackAllowance';
import * as ToastContext from '../../contexts/ToastContext';
import * as ModalContext from '../../contexts/ModalContext';
vi.mock('../../contexts/ModalContext', () => ({
  useModals: () => ({ openSongForm: vi.fn(), openAiSongImport: vi.fn() })
}));


vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ toast: vi.fn(), showToast: vi.fn(), hideToast: vi.fn() }),
  ToastProvider: ({ children }: any) => <div>{children}</div>
}));


vi.mock('../../hooks/useStarterPackAllowance', () => ({
  useStarterPackAllowance: () => ({ allowance: null, loading: false, error: null, refreshAllowance: vi.fn(), starterPack: [] })
}));


vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultLabel: string) => defaultLabel,
  }),
}));

const mockSetSearchParams = vi.fn();
let searchParamsMock = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [searchParamsMock, mockSetSearchParams]
  };
});

afterEach(() => { cleanup(); });

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  searchParamsMock = new URLSearchParams();
  
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ organization: { id: 'org_1' } } as any);
  vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => true } as any);
  vi.spyOn(MusicDataContext, 'useMusic').mockReturnValue({ localSongs: [] } as any);
  vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
  
  // mock window.scrollTo
  window.scrollTo = vi.fn();

  vi.spyOn(ApiContext, 'useApi').mockReturnValue({} as any);
  vi.spyOn(StarterPackHook, 'useStarterPackAllowance').mockReturnValue({ allowance: null, loading: false, error: null, refreshAllowance: vi.fn(), starterPack: [] });

});

describe('LibraryPage intent=import', () => {
  it('1. /library normal não muda filtro', () => {
    render(<MemoryRouter><LibraryPage /></MemoryRouter>);
    expect(mockSetSearchParams).not.toHaveBeenCalled();
  });

  it('2, 3, 4, 5. intent=import processa e limpa URL', async () => {
    searchParamsMock.set('intent', 'import');
    render(<MemoryRouter><LibraryPage /></MemoryRouter>);
    
    await waitFor(() => {
      expect(mockSetSearchParams).toHaveBeenCalled();
    });
    
    // Check that it's called with new params not containing intent
    const callArgs = mockSetSearchParams.mock.calls[0];
    const newParams = callArgs[0] as URLSearchParams;
    expect(newParams.has('intent')).toBe(false);
    expect(callArgs[1]).toEqual({ replace: true });
    
    // Wait for the setTimeout focus
    await new Promise(r => setTimeout(r, 150));
    
    // Check search input focus
    const input = screen.getByPlaceholderText(/Buscar por música/i);
    expect(document.activeElement).toBe(input);
  });
  
  it('8. acesso negado não cria bypass', async () => {
    vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => false } as any);
    searchParamsMock.set('intent', 'import');
    render(<MemoryRouter><LibraryPage /></MemoryRouter>);
    
    await waitFor(() => {
      // It should not focus if access is denied
      expect(mockSetSearchParams).not.toHaveBeenCalled();
    });
  });
});
