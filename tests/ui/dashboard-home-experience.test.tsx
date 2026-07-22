import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from '../../pages/DashboardPage';
import { useHomeExperience } from '../../hooks/useHomeExperience';
import { useAuth } from '../../contexts/AuthContext';
import { useMusic } from '../../contexts/MusicDataContext';
import { useSuggestionsContext } from '../../contexts/SuggestionContext';
import { useModals } from '../../contexts/ModalContext';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../../hooks/useHomeExperience');
vi.mock('../../contexts/AuthContext');
vi.mock('../../contexts/MusicDataContext');
vi.mock('../../contexts/SuggestionContext');
vi.mock('../../contexts/ModalContext');
vi.mock('../../hooks/useMusicScaleEntitlements', () => ({
  useMusicScaleEntitlements: () => ({ hasFeature: () => true })
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string, vars?: any) => {
      if (key === 'dashboard.noOrgTitle') return 'Nenhuma organização conectada';
      if (key === 'dashboard.focus.createNextEvent') return 'Criar próxima escala';
      if (key === 'dashboard.focus.continueDraft') return 'Continue preparando';
      if (key === 'dashboard.focus.resolveIssues') return 'Resolver pendências';
      if (key === 'dashboard.focus.noEventsTitle') return 'Você não tem compromissos próximos.';
      if (key === 'dashboard.focus.assignedEyebrow') return 'Você está escalado';
      if (key === 'dashboard.focus.openRepertoire') return 'Abrir repertório';
      if (key === 'dashboard.upcomingEvents.viewAll') return 'Ver todos';
      if (key === 'dashboard.secondaryContent.exploreMore') return 'Explorar mais';
      if (key === 'dashboard.attention.missingRepertoire') return 'Repertório vazio';
      
      if (vars && vars.count !== undefined) return fallback.replace('{{count}}', vars.count.toString());
      return fallback || key;
    },
    i18n: { language: 'pt' }
  })
}));

vi.mock('../../components/scales/AssignmentResponseActions', () => ({
  default: ({ musicScaleId, eventStart }: any) => <div data-testid="assignment-response">Response {musicScaleId} {eventStart}</div>
}));

vi.mock('../../components/onboarding/FirstScaleJourneyCard', () => ({
  FirstScaleJourneyCard: () => <div data-testid="first-scale-journey">Journey</div>
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Dashboard Home Experience', () => {
  const defaultAuth = {
    user: { uid: 'u1', displayName: 'Test User' },
    organization: { id: 'org1', slug: 'org1' },
    isSupportMode: false,
    hasRole: () => true
  };

  vi.mocked(useModals).mockReturnValue({ openSongDetail: vi.fn(), openSongForm: vi.fn(), openScaleForm: vi.fn(), openAiSongImport: vi.fn() } as any);
  const setup = (mode: string, overrides: any = {}) => {
    vi.mocked(useAuth).mockReturnValue(defaultAuth as any);
    vi.mocked(useMusic).mockReturnValue({ songs: [], populatedScales: [], loading: false } as any);
    vi.mocked(useSuggestionsContext).mockReturnValue({ suggestions: [], loading: false } as any);
    
    vi.mocked(useHomeExperience).mockReturnValue({
      isLoading: false,
      upcomingEvents: [],
      experience: {
        mode,
        event: null,
        draftEvent: null,
        attentionItems: [],
        canManageScales: false,
        isUserAssigned: false,
        ...overrides
      }
    } as any);
  };

  it('1. músico escalado vê evento, função e ação de resposta', () => {
    setup('assigned-event', {
      event: {
        id: 'e1',
        title: 'Culto de Domingo',
        date: '2026-10-10',
        time: '19:00',
        songCount: 3,
        userFunctionNames: ['Violão'],
        isUserAssigned: true,
      }
    });
    
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Você está escalado')).toBeDefined();
    expect(screen.getByText('Culto de Domingo')).toBeDefined();
    expect(screen.getByText('Violão')).toBeDefined();
    expect(screen.getByTestId('assignment-response')).toBeDefined();
  });

  it('3. líder vê rascunho e Continuar preparando', () => {
    setup('continue-draft', {
      canManageScales: true,
      draftEvent: {
        id: 'd1',
        title: 'Rascunho de Culto',
        date: '2026-10-15'
      }
    });

    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Continue preparando')).toBeDefined();
    expect(screen.getByText(/Rascunho de Culto/)).toBeDefined();
  });

  it('4. líder vê pendências confiáveis', () => {
    setup('leader-attention', {
      canManageScales: true,
      event: { id: 'e2', title: 'Culto', date: '2026-10-10' },
      attentionItems: [
        { code: 'missing-repertoire', severity: 'important' }
      ]
    });

    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Repertório vazio')).toBeDefined();
    expect(screen.getByText('Resolver pendências')).toBeDefined();
  });

  it('5. organização nova vê FirstScaleJourneyCard', () => {
    setup('first-value');
    renderWithRouter(<DashboardPage />);
    expect(screen.getByTestId('first-scale-journey')).toBeDefined();
  });

  it('6. organização sem eventos e com capacidade vê Criar próxima escala', () => {
    setup('create-next-event', { canManageScales: true });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Criar próxima escala')).toBeDefined();
  });

  it('7. usuário comum sem eventos vê estado vazio correto', () => {
    setup('no-upcoming-event', { canManageScales: false });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Você não tem compromissos próximos.')).toBeDefined();
  });

  it('11. Explorar mais inicia recolhido no celular', () => {
    setup('no-upcoming-event');
    vi.mocked(useSuggestionsContext).mockReturnValue({
      suggestions: [{ id: 's1', isRead: false, songs: [{ title: 'Música 1' }], createdBy: { name: 'User' } }],
      loading: false
    } as any);

    renderWithRouter(<DashboardPage />);
    const exploreMoreBtn = screen.getByText('Explorar mais').closest("button")!;
    expect(exploreMoreBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('13. próximos eventos são limitados a três', () => {
    setup('observer-event', {
      upcomingEvents: [
        { id: '1', title: 'E1', date: '2026-10-01' },
        { id: '2', title: 'E2', date: '2026-10-02' },
        { id: '3', title: 'E3', date: '2026-10-03' },
        { id: '4', title: 'E4', date: '2026-10-04' },
      ]
    });

    renderWithRouter(<DashboardPage />);
    expect(screen.queryByText('E1')).toBeDefined();
    expect(screen.queryByText('E2')).toBeDefined();
    expect(screen.queryByText('E3')).toBeDefined();
    expect(screen.queryByText('E4')).toBeNull(); // Limited to 3
    expect(screen.getByText('Ver todos')).toBeDefined();
  });
});
