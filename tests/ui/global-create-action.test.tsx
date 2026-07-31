import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GlobalCreateAction } from '../../components/layout/GlobalCreateAction';
import * as CapabilityHook from '../../hooks/useCapability';
import * as AuthContext from '../../contexts/AuthContext';
import * as EntitlementsHook from '../../hooks/useMusicScaleEntitlements';
import * as ModalContext from '../../contexts/ModalContext';
import * as MusicContext from '../../contexts/MusicDataContext';
import { MemoryRouter, useLocation } from 'react-router-dom';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultLabel: string) => defaultLabel,
  }),
}));

const mockNavigate = vi.fn();
let mockPathname = '/';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname })
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
  mockPathname = '/';
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
      expect(screen.queryByText('Importar com IA')).not.toBeInTheDocument();
      expect(screen.queryByText('Buscar na Biblioteca Viva')).not.toBeInTheDocument();
      expect(screen.getByText('Adicionar manualmente')).toBeInTheDocument();
    });
  });
});

describe('MS-UX-CREATE-02-HOTFIX-OPEN-1: Mobile closing regression', () => {
  it('keeps palette open when hasCapability and canAccessGlobalLibrary change references but not values', async () => {
    // We will simulate a rerender by changing state in a parent wrapper
    let setCapabilityRef: any;
    let setAccessRef: any;

    const Wrapper = () => {
      const [capRef, setCapRef] = React.useState(0);
      const [accessRef, setAccessRefState] = React.useState(0);

      setCapabilityRef = setCapRef;
      setAccessRef = setAccessRefState;

      // New function references each render, but same return values
      const mockHasCapability = (cap: string) => true;
      const mockCanAccessGlobalLibrary = () => true;

      vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: mockHasCapability });
      vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: mockCanAccessGlobalLibrary } as any);
      vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(true);

      return (
        <MemoryRouter>
          <GlobalCreateAction variant="mobile" />
        </MemoryRouter>
      );
    };

    render(<Wrapper />);

    // 1. trigger mobile is visible;
    const trigger = screen.getByRole('button', { name: 'Criar' });
    expect(trigger).toBeVisible();

    // 2. click trigger opens dialog;
    fireEvent.click(trigger);
    
    // 16. mobile continues using createPortal (in body)
    // 17. mobile continues with role="dialog"
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    
    // 3. dialog remains visible after rerender;
    // 4. recreating hasCapability with same boolean results doesn't close palette;
    React.act(() => {
      setCapabilityRef(1);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 5. recreating canAccessGlobalLibrary with same boolean result doesn't close palette;
    React.act(() => {
      setAccessRef(1);
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    // 6. keeping organizationId and pathname same doesn't close;
    // Done implicitly above since they didn't change
  });

  it('closes dialog on actual location change', async () => {
    let setLocationPath: any;
    
    const Wrapper = () => {
      const [path, setPath] = React.useState('/');
      setLocationPath = setPath;
      
      vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
      vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => true } as any);
      vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(true);

      mockPathname = path;

      return (
        <MemoryRouter>
          <GlobalCreateAction variant="mobile" />
        </MemoryRouter>
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // 8. changing pathname closes;
    React.act(() => {
      setLocationPath('/other-path');
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes dialog on organization change', async () => {
    let setOrg: any;
    
    const Wrapper = () => {
      const [orgId, setOrgId] = React.useState('org_1');
      setOrg = setOrgId;
      
      vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
      vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => true } as any);
      vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(true);
      vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ organization: { id: orgId } } as any);

      return (
        <MemoryRouter>
          <GlobalCreateAction variant="mobile" />
        </MemoryRouter>
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // 7. changing organizationId closes;
    React.act(() => {
      setOrg('org_2');
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes dialog on capabilities change (action signature change)', async () => {
    let setCap: any;
    
    const Wrapper = () => {
      const [canManage, setCanManage] = React.useState(true);
      setCap = setCanManage;
      
      vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => canManage });
      vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => true } as any);
      vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(true);

      return (
        <MemoryRouter>
          <GlobalCreateAction variant="mobile" />
        </MemoryRouter>
      );
    };

    render(<Wrapper />);

    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // 9. changing real action signature closes;
    React.act(() => {
      setCap(false);
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('supports close button and backdrop click', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => true } as any);
    vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(true);
    
    render(<MemoryRouter><GlobalCreateAction variant="mobile" /></MemoryRouter>);
    
    // Close button test
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    const closeBtn = await screen.findByRole('button', { name: 'Fechar' });
    fireEvent.click(closeBtn);
    
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Backdrop test
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    const dialog = await screen.findByRole('dialog');
    
    // The backdrop is the previous sibling of the dialog div
    const backdrop = dialog.previousElementSibling as HTMLElement;
    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    
    // Escape test
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('runs action exactly once, double click does not run twice', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    vi.spyOn(AuthContext, 'useFeatures').mockReturnValue({ canAccessGlobalLibrary: () => true } as any);
    vi.spyOn(EntitlementsHook, 'useMusicScaleFeature').mockReturnValue(true);
    
    render(<MemoryRouter><GlobalCreateAction variant="mobile" /></MemoryRouter>);
    
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    
    const actionBtn = await screen.findByText('Adicionar manualmente');
    
    // 14. double click doesn't run twice
    fireEvent.click(actionBtn);
    fireEvent.click(actionBtn);
    
    // 13. action runs exactly once;
    await waitFor(() => {
      expect(mockOpenSongForm).toHaveBeenCalledTimes(1);
    });
    
    // And closes
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
