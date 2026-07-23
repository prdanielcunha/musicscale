import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../../pages/DashboardPage';

// Mock Modules
vi.unmock('react-i18next');
import i18n from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import pt from '../../locales/pt.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': { translation: pt },
      'en-US': { translation: en },
      'es-ES': { translation: es }
    },
    lng: 'pt-BR',
    fallbackLng: 'pt-BR',
    interpolation: { escapeValue: false }
  });

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const mockUseMusic = vi.fn();
vi.mock('../../contexts/MusicDataContext', () => ({ useMusic: () => mockUseMusic() }));

const mockUseEcosystem = vi.fn();
vi.mock('../../contexts/EcosystemContext', () => ({ useEcosystem: () => mockUseEcosystem() }));

const mockUseCapability = vi.fn();
vi.mock('../../hooks/useCapability', () => ({ useCapability: () => mockUseCapability() }));

const mockUseFirstScaleExperience = vi.fn();
vi.mock('../../hooks/useFirstScaleExperience', () => ({ useFirstScaleExperience: () => mockUseFirstScaleExperience() }));

const mockUsePlan = vi.fn();

const mockUseToast = vi.fn();
vi.mock("../../contexts/ToastContext", () => ({ useToast: () => mockUseToast() }));

const mockUseApi = vi.fn();
vi.mock("../../contexts/ApiContext", () => ({ useApi: () => mockUseApi() }));

const mockUseModals = vi.fn();
vi.mock("../../contexts/ModalContext", () => ({ useModals: () => mockUseModals() }));

const mockUseSuggestionsContext = vi.fn();
vi.mock("../../contexts/SuggestionContext", () => ({ useSuggestionsContext: () => mockUseSuggestionsContext() }));
vi.mock('../../hooks/usePlan', () => ({ usePlan: () => mockUsePlan() }));

// Helpers estruturais de i18n
function getKeysDeep(obj: any, prefix = ''): string[] {
  return Object.keys(obj).reduce((acc: string[], k: string) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      acc.push(...getKeysDeep(obj[k], pre + k));
    } else {
      acc.push(pre + k);
    }
    return acc;
  }, []);
}

describe('Dashboard Home Experience UI & I18N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.changeLanguage('pt-BR');
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' },
      userProfile: { uid: 'u1', firstName: 'João', defaultOrganizationId: 'org1' }, organization: { id: 'org1' }
    });
    mockUseEcosystem.mockReturnValue({
      currentOrganization: { id: 'org1', name: 'Org' },
      userGlobalRole: 'member',
      organizationRole: 'member',
      isEcosystemOwner: false
    });
    mockUseToast.mockReturnValue({ toast: vi.fn() });
    mockUseApi.mockReturnValue({});
    mockUseModals.mockReturnValue({ openScaleDetail: vi.fn(), openBandScaleDetail: vi.fn(), openScaleForm: vi.fn(), openSongDetail: vi.fn() });
    mockUseSuggestionsContext.mockReturnValue({ pendingSuggestionsCount: 0, setPendingSuggestionsCount: vi.fn(), loading: false, suggestions: [], error: null, refetchSuggestions: vi.fn(), dismissSuggestion: vi.fn() });
    mockUseCapability.mockReturnValue({ hasCapability: () => true });
    mockUseFirstScaleExperience.mockReturnValue({ isLoading: false, isEligible: false });
    mockUsePlan.mockReturnValue({
      canUsePerformance: true
    });
  });

  it('I18N: estrutural check for pt, en, es', () => {
    // Pegar chaves de dentro das seções específicas
    const ptKeys = [
      ...getKeysDeep((pt as any).dashboard.attention || {}),
      ...getKeysDeep((pt as any).dashboard.focus || {}),
      ...getKeysDeep((pt as any).dashboard.upcomingEvents || {}),
      ...getKeysDeep((pt as any).dashboard.secondaryContent || {})
    ].sort();

    const enKeys = [
      ...getKeysDeep((en as any).dashboard.attention || {}),
      ...getKeysDeep((en as any).dashboard.focus || {}),
      ...getKeysDeep((en as any).dashboard.upcomingEvents || {}),
      ...getKeysDeep((en as any).dashboard.secondaryContent || {})
    ].sort();

    const esKeys = [
      ...getKeysDeep((es as any).dashboard.attention || {}),
      ...getKeysDeep((es as any).dashboard.focus || {}),
      ...getKeysDeep((es as any).dashboard.upcomingEvents || {}),
      ...getKeysDeep((es as any).dashboard.secondaryContent || {})
    ].sort();

    expect(ptKeys).toEqual(enKeys);
    expect(ptKeys).toEqual(esKeys);
    
    // Check no flat keys starting with dashboard. inside dashboard block
    const ptFlatDashboardKeys = Object.keys((pt as any).dashboard).filter(k => k.startsWith('dashboard.'));
    expect(ptFlatDashboardKeys).toEqual([]);
    const enFlatDashboardKeys = Object.keys((en as any).dashboard).filter(k => k.startsWith('dashboard.'));
    expect(enFlatDashboardKeys).toEqual([]);
    const esFlatDashboardKeys = Object.keys((es as any).dashboard).filter(k => k.startsWith('dashboard.'));
    expect(esFlatDashboardKeys).toEqual([]);
  });

  const baseMusicData = {
    populatedScales: [],
    populatedBandScales: [],
    songs: [],
    members: [],
    loading: false
  };

  it('renders correct functions string in PT', async () => {
    i18n.changeLanguage('pt-BR');
    mockUseMusic.mockReturnValue({
      ...baseMusicData,
      populatedScales: [
        {
          id: '1', date: '2026-12-01', status: 'published',
          eventAssignments: [
            { userId: 'u1', active: true, functionName: 'Violão' },
            { userId: 'u1', active: true, functionName: 'Vocal' }
          ]
        }
      ]
    });
    
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getAllByText('Violão e Vocal').length).toBeGreaterThan(0);
  });

  it('renders correct functions string in EN', async () => {
    await act(async () => {
      i18n.changeLanguage('en-US');
    });
    mockUseMusic.mockReturnValue({
      ...baseMusicData,
      populatedScales: [
        {
          id: '1', date: '2026-12-01', status: 'published',
          eventAssignments: [
            { userId: 'u1', active: true, functionName: 'Guitar' },
            { userId: 'u1', active: true, functionName: 'Vocal' }
          ]
        }
      ]
    });
    
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getAllByText('Guitar and Vocal').length).toBeGreaterThan(0);
  });

  it('renders correct functions string in ES', async () => {
    await act(async () => {
      i18n.changeLanguage('es-ES');
    });
    mockUseMusic.mockReturnValue({
      ...baseMusicData,
      populatedScales: [
        {
          id: '1', date: '2026-12-01', status: 'published',
          eventAssignments: [
            { userId: 'u1', active: true, functionName: 'Guitarra' },
            { userId: 'u1', active: true, functionName: 'Voz' }
          ]
        }
      ]
    });
    
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getAllByText('Guitarra y Voz').length).toBeGreaterThan(0);
  });

  it('renders assigned event without function properly', async () => {
    await act(async () => {
      i18n.changeLanguage('pt-BR');
    });
    mockUseMusic.mockReturnValue({
      ...baseMusicData,
      populatedScales: [
        {
          id: '1', date: '2026-12-01', status: 'published',
          eventAssignments: [
            { userId: 'u1', active: true } // Sem functionName
          ]
        }
      ]
    });
    
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.queryByText('Função:')).not.toBeInTheDocument();
    expect(screen.getByText('Você está na equipe')).toBeInTheDocument();
  });

  it('opens event by clicking with keyboard', async () => {
    await act(async () => {
      i18n.changeLanguage('pt-BR');
    });
    mockUseMusic.mockReturnValue({
      ...baseMusicData,
      populatedScales: [
        {
          id: '1', date: '2026-12-01', status: 'published',
          eventAssignments: [
            { userId: 'u1', active: true, functionName: 'Violão' }
          ]
        }
      ]
    });
    
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    const button = screen.getByText('Abrir repertório');
    button.focus();
    fireEvent.click(button);
    
    expect(mockUseModals().openScaleDetail).toHaveBeenCalled();
  });

  it('does not render old artificial metrics', async () => {
    await act(async () => {
      i18n.changeLanguage('pt-BR');
    });
    mockUseMusic.mockReturnValue({
      ...baseMusicData
    });
    
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.queryByText('TOTAL DE MÚSICAS')).not.toBeInTheDocument();
    expect(screen.queryByText('MÚSICAS ATIVAS')).not.toBeInTheDocument();
    expect(screen.queryByText('MÚSICAS INATIVAS')).not.toBeInTheDocument();
  });
});
