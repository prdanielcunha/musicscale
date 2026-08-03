import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../../pages/DashboardPage';
import { FirstValueJourneyOutput } from '../../utils/firstValueJourney';
import { HomeFocusCard } from '../../components/dashboard/HomeFocusCard';

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
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockUseAuth() }));

const mockUseMusic = vi.fn();
vi.mock('../../contexts/MusicDataContext', () => ({ useMusic: () => mockUseMusic() }));

const mockUseCapability = vi.fn();
vi.mock('../../hooks/useCapability', () => ({ useCapability: () => mockUseCapability() }));

const mockUseFirstScaleExperience = vi.fn();
vi.mock('../../hooks/useFirstScaleExperience', () => ({ useFirstScaleExperience: () => mockUseFirstScaleExperience() }));

const mockUseSuggestionsContext = vi.fn();
vi.mock('../../contexts/SuggestionContext', () => ({ useSuggestionsContext: () => mockUseSuggestionsContext() }));

const mockOpenScaleDetail = vi.fn();
const mockOpenBandScaleDetail = vi.fn();
const mockOpenSongDetail = vi.fn();
const mockOpenScaleForm = vi.fn();
const mockOpenBandScaleForm = vi.fn();
vi.mock('../../contexts/ModalContext', () => ({
  useModals: () => ({
    openScaleDetail: mockOpenScaleDetail,
    openBandScaleDetail: mockOpenBandScaleDetail,
    openSongDetail: mockOpenSongDetail,
    openScaleForm: mockOpenScaleForm,
    openBandScaleForm: mockOpenBandScaleForm,
  })
}));

const mockUseToast = vi.fn();
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ toast: mockUseToast })
}));

interface MockResponseActionsProps {
  musicScaleId: string;
  assignments: { userId: string; functionName: string; active: boolean }[];
  eventStart: Date;
  isBandScale?: boolean;
}

const mockAssignmentResponseActions = vi.fn();
vi.mock('../../components/scales/AssignmentResponseActions', () => ({
  default: (props: MockResponseActionsProps) => {
    mockAssignmentResponseActions(props);
    return <div data-testid="mock-response-actions">Response Actions</div>;
  }
}));

vi.mock('../../components/support/SupportRuntimeInspector', () => ({
  SupportRuntimeInspector: () => <div data-testid="support-inspector" style={{ display: 'none' }} />
}));

vi.mock(
  '../../components/onboarding/FirstScaleJourneyCard',
  () => ({
    FirstScaleJourneyCard:
      () => (
        <div
          data-testid=
            "first-scale-journey"
        >
          Journey
        </div>
      )
  })
);

export function createFirstScaleExperienceOutput(
  overrides: Partial<FirstValueJourneyOutput> = {}
): FirstValueJourneyOutput {
  return {
    isLoading: false,
    isEligible: true,
    isCompleted: false,
    currentEssentialStep: "team",
    completedEssentialSteps: 2,
    totalEssentialSteps: 4,
    milestones: [
      {
        id: "repertoire",
        status: "completed"
      },
      {
        id: "firstScale",
        status: "completed"
      },
      {
        id: "team",
        status: "current"
      },
      {
        id: "publish",
        status: "pending"
      }
    ],
    draftScale: {
      id: "draft-1"
    },
    hasTeam: false,
    teamState: "empty",
    teamSetupSummary: {
      totalMembers: 1,
      additionalMembers: 0,
      membersWithAccessProfile: 0,
      membersWithMinistryFunctions: 0,
      configuredMembers: 0,
      incompleteMemberIds: [],
      memberStatuses: [],
      isTeamConfigured: false
    },
    canManageMembers: true,
    ...overrides
  };
}

// Default Mocks
const defaultUser = { uid: 'u1', displayName: 'Daniel' };
const defaultOrg = { id: 'org1', slug: 'org1' };
const getFutureDate = () => '2099-12-31';


const renderWithRouter = (ui: React.ReactElement, lang = 'pt-BR') => {
  i18n.changeLanguage(lang);
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>
  );
};


describe('Dashboard Home Experience UI', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseAuth.mockReturnValue({ user: defaultUser, organization: defaultOrg, isOwner: false, isSupportMode: false });
    mockUseCapability.mockReturnValue({ hasCapability: () => false });
    mockUseFirstScaleExperience.mockReturnValue({
      isLoading: false, isEligible: false, isCompleted: true, currentEssentialStep: null
    });
    mockUseSuggestionsContext.mockReturnValue({ suggestions: [], loading: false });
    mockUseMusic.mockReturnValue({ populatedScales: [], populatedBandScales: [], songs: [], loading: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. músico escalado vê evento, função e resposta', () => {
    const scale = {
      id: 's1', date: getFutureDate(), eventName: { name: 'Sunday Service' },
      eventAssignments: [{ userId: 'u1', functionName: 'Vocal', active: true }]
    };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    expect(screen.getAllByText('Vocal').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sunday Service')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Vocal')[0]).toBeInTheDocument();
    expect(screen.getByTestId('mock-response-actions')).toBeInTheDocument();
  });

  it('2. músico não vê criar, editar, excluir ou clonar', () => {
    const scale = {
      id: 's1', date: getFutureDate(), eventName: { name: 'Sunday Service' },
      eventAssignments: [{ userId: 'u1', functionName: 'Vocal', active: true }]
    };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByText('Criar próxima escala')).not.toBeInTheDocument();
    expect(screen.queryByText('Repetir uma escala')).not.toBeInTheDocument();
  });

  it('3. líder vê rascunho', () => {
    mockUseCapability.mockReturnValue({ hasCapability: (c: string) => c === 'musicscale.scales.manage' });
    const scale = { id: 's1', date: getFutureDate(), status: 'draft', eventName: { name: 'Draft Service' } };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
    expect(screen.getByText('Continuar preparando')).toBeInTheDocument();
  });

  it('4. líder vê pendências', () => {
    mockUseCapability.mockReturnValue({ hasCapability: (c: string) => c === 'musicscale.scales.manage' });
    const scale = { id: 's1', date: getFutureDate(), status: 'published', eventName: { name: 'Pending Service' }, songs: [] };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Resolver pendências')).toBeInTheDocument();
    expect(screen.getByText('Repertório incompleto')).toBeInTheDocument();
  });

  it('5. dashboard renderiza no estado padrão sem exibir jornada explícita', () => {
    mockUseFirstScaleExperience.mockReturnValue({
      isLoading: false, isEligible: false, isCompleted: true, currentEssentialStep: null
    });
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByTestId('first-scale-journey')).not.toBeInTheDocument();
    // Verifica estado padrão (header, etc)
    expect(screen.getByText(/Daniel/i)).toBeInTheDocument();
  });

  it('6. organização sem eventos vê criação', () => {
    mockUseCapability.mockReturnValue({ hasCapability: (c: string) => c === 'musicscale.scales.manage' });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Vamos preparar o próximo culto?')).toBeInTheDocument();
    expect(screen.getByText('Criar próxima escala')).toBeInTheDocument();
  });

  it('7. usuário comum sem eventos vê vazio', () => {
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Agenda livre')).toBeInTheDocument();
    expect(screen.getByText('Você não tem compromissos próximos.')).toBeInTheDocument();
  });

  it('8. métricas artificiais não aparecem', () => {
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByText(/0 métricas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/músicas tocadas/i)).not.toBeInTheDocument();
  });

  it('9. acesso rápido antigo não aparece', () => {
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByText(/Acesso rápido/i)).not.toBeInTheDocument();
  });

  it('10. Biblioteca Viva não domina o foco', () => {
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByText(/Biblioteca Viva/i)).not.toBeInTheDocument();
  });

  it('11. Explorar mais inicia recolhido no celular', () => {
    mockUseSuggestionsContext.mockReturnValue({
      suggestions: [{ id: '1', isRead: false, songs: [{ title: 'Song 1' }], createdBy: { name: 'User' } }],
      loading: false
    });
    renderWithRouter(<DashboardPage />);
    const exploreBtnText = screen.getAllByText('Explorar mais')[1];
    const exploreBtn = exploreBtnText.closest('button');
    expect(exploreBtn).not.toBeNull();
    expect(exploreBtn!.getAttribute('aria-expanded')).toBe('false');
  });

  it('12. aria-expanded muda ao clicar em Explorar mais', () => {
    mockUseSuggestionsContext.mockReturnValue({
      suggestions: [{ id: '1', isRead: false, songs: [{ title: 'Song 1' }], createdBy: { name: 'User' } }],
      loading: false
    });
    renderWithRouter(<DashboardPage />);
    const exploreBtnText = screen.getAllByText('Explorar mais')[1];
    const exploreBtn = exploreBtnText.closest('button');
    expect(exploreBtn).not.toBeNull();
    fireEvent.click(exploreBtn!);
    expect(exploreBtn!.getAttribute('aria-expanded')).toBe('true');
  });

  it('13. próximos eventos limitados a três', () => {
    const scales = Array.from({ length: 5 }).map((_, i) => ({
      id: `s${i}`, date: getFutureDate(), time: `10:0${i}`, eventName: { name: `Event ${i}` }
    }));
    mockUseMusic.mockReturnValue({ populatedScales: scales, populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    expect(screen.getAllByText('Event 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Event 2').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Event 4').length).toBe(0);
  });

  it('14. Ver todos abre /scales', () => {
    const scales = Array.from({ length: 5 }).map((_, i) => ({
      id: `s${i}`, date: getFutureDate(), time: `10:0${i}`, eventName: { name: `Event ${i}` }
    }));
    mockUseMusic.mockReturnValue({ populatedScales: scales, populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    const viewAllBtn = screen.getAllByText('Ver todos')[0];
    fireEvent.click(viewAllBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/scales');
  });

  it('15. evento funciona por teclado', () => {
    const scale = { id: 's1', date: getFutureDate(), eventName: { name: 'Focus Event' } };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    const eventBtn = screen.getAllByText('Ver detalhes')[0].closest('button');
    expect(eventBtn).not.toBeNull();
    eventBtn?.focus();
    expect(document.activeElement).toBe(eventBtn);
  });

  it('16. ações possuem texto', () => {
    const scale = { id: 's1', date: getFutureDate(), eventName: { name: 'Focus Event' } };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    const viewDetails = screen.getAllByText('Ver detalhes')[0];
    expect(viewDetails).toBeInTheDocument();
    expect(viewDetails.textContent?.length).toBeGreaterThan(0);
  });

  it('17. criação usa openScaleForm', () => {
    mockUseCapability.mockReturnValue({ hasCapability: (c: string) => c === 'musicscale.scales.manage' });
    renderWithRouter(<DashboardPage />);
    const createBtn = screen.getByText('Criar próxima escala');
    fireEvent.click(createBtn);
    expect(mockOpenScaleForm).toHaveBeenCalled();
  });

  it('18. PT funciona', () => {
    renderWithRouter(<DashboardPage />, 'pt-BR');
    expect(screen.getByText('Agenda livre')).toBeInTheDocument();
  });

  it('19. EN funciona', () => {
    renderWithRouter(<DashboardPage />, 'en-US');
    expect(screen.getByText('Clear agenda')).toBeInTheDocument();
  });

  it('20. ES funciona', () => {
    renderWithRouter(<DashboardPage />, 'es-ES');
    expect(screen.getByText('Agenda libre')).toBeInTheDocument();
  });

  it('21. não existe "Nova Escala" fixa em EN ou ES', async () => {
    mockUseCapability.mockReturnValue({ hasCapability: (c: string) => c === 'musicscale.scales.manage' });
    renderWithRouter(<DashboardPage />, 'en-US');
    
    expect(screen.queryByText('Nova Escala')).not.toBeInTheDocument();
    renderWithRouter(<DashboardPage />, 'es-ES');
    
    expect(screen.queryByText('Nova Escala')).not.toBeInTheDocument();
  });

  it('22. SupportRuntimeInspector fica oculto', () => {
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByText('Inspect Support')).not.toBeInTheDocument();
  });

  it('23. AssignmentResponseActions recebe musicScaleId correto, 24. recebe assignments reais, 25. eventStart Date, 26. não recebe isBandScale', () => {
    const scale = {
      id: 's1', date: getFutureDate(), time: '19:00', eventName: { name: 'Sunday Service' },
      eventAssignments: [{ userId: 'u1', functionName: 'Vocal', active: true }]
    };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    expect(mockAssignmentResponseActions).toHaveBeenCalled();
    const props = mockAssignmentResponseActions.mock.calls[0][0];
    expect(props.musicScaleId).toBe('s1');
    expect(props.assignments).toEqual([{ userId: 'u1', functionName: 'Vocal', active: true }]);
    expect(props.eventStart).toBeInstanceOf(Date);
    expect(props.eventStart.toISOString()).toContain('19:00:00');
    expect(props.isBandScale).toBeUndefined();
  });

  it('27. Performance usa openSongDetail', () => {
    mockUseCapability.mockReturnValue({ hasCapability: (c: string) => c === 'musicscale.performance.use' });
    const scale = {
      id: 's1', date: getFutureDate(), eventName: { name: 'Service' },
      eventAssignments: [{ userId: 'u1', active: true }], songs: [{ id: 'song1' }], status: 'published'
    };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    const perfBtn = screen.getByText('Entrar no Modo Performance');
    fireEvent.click(perfBtn);
    expect(mockOpenSongDetail).toHaveBeenCalledWith(
      { id: 'song1' }, true, { songs: [{ id: 'song1' }], currentIndex: 0 }, true
    );
  });

  it('28. criar escala não navega para /scales/new', () => {
    mockUseCapability.mockReturnValue({ hasCapability: (c: string) => c === 'musicscale.scales.manage' });
    renderWithRouter(<DashboardPage />);
    const createBtn = screen.getByText('Criar próxima escala');
    fireEvent.click(createBtn);
    expect(mockNavigate).not.toHaveBeenCalledWith('/scales/new');
  });

  it('29. repetir leva à lista /scales sem query falsa', () => {
    mockUseCapability.mockReturnValue({ hasCapability: (c: string) => c === 'musicscale.scales.manage' });
    renderWithRouter(<DashboardPage />);
    const repeatBtn = screen.getByText('Escolher escala para repetir');
    fireEvent.click(repeatBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/scales');
    expect(mockNavigate).not.toHaveBeenCalledWith('/scales?action=clone');
  });

  it('30. próximos eventos usam upcomingEvents retornado separadamente', () => {
    const scales = [
      { id: 's1', date: getFutureDate(), eventName: { name: 'Event 1' } },
      { id: 's2', date: getFutureDate(), eventName: { name: 'Event 2' } }
    ];
    mockUseMusic.mockReturnValue({ populatedScales: scales, populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Event 2')).toBeInTheDocument();
  });

  it('31. jornada elegível e não concluída com step team mostra o card', () => {
    const journey = createFirstScaleExperienceOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "team"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.getByTestId('first-scale-journey')).toBeInTheDocument();
  });

  it('32. jornada elegível e não concluída com step publish mostra o card', () => {
    const journey = createFirstScaleExperienceOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "publish"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.getByTestId('first-scale-journey')).toBeInTheDocument();
  });

  it('33. jornada concluída com currentEssentialStep: null não mostra o card', () => {
    const journey = createFirstScaleExperienceOutput({
      isEligible: true,
      isCompleted: true,
      currentEssentialStep: null
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByTestId('first-scale-journey')).not.toBeInTheDocument();
  });

  it('34. jornada não elegível não mostra o card', () => {
    const journey = createFirstScaleExperienceOutput({
      isEligible: false,
      isCompleted: false,
      currentEssentialStep: "team"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByTestId('first-scale-journey')).not.toBeInTheDocument();
  });

  it('35. jornada em loading mantém o estado de carregamento correto', () => {
    const journey = createFirstScaleExperienceOutput({
      isLoading: true,
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "team"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.getByLabelText('Carregando...')).toBeInTheDocument();
  });

  it('36. experiência normal com evento continua mostrando HomeFocusCard', () => {
    const journey = createFirstScaleExperienceOutput({
      isEligible: false,
      isCompleted: true,
      currentEssentialStep: null
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);

    const scale = {
      id: 's1',
      date: getFutureDate(),
      eventName: { name: 'Sunday Service' },
      eventAssignments: [{ userId: 'u1', functionName: 'Vocal', active: true }]
    };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });

    renderWithRouter(<DashboardPage />);
    expect(screen.getAllByText('Vocal').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('first-scale-journey')).not.toBeInTheDocument();
  });

  it('37. organização sem eventos e sem jornada segue o fluxo normal atual', () => {
    const journey = createFirstScaleExperienceOutput({
      isEligible: false,
      isCompleted: true,
      currentEssentialStep: null
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    mockUseMusic.mockReturnValue({ populatedScales: [], populatedBandScales: [], songs: [], loading: false });

    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Agenda livre')).toBeInTheDocument();
    expect(screen.queryByTestId('first-scale-journey')).not.toBeInTheDocument();
  });
});

describe('Continuar Preparando (Dashboard)', () => {
  it('1. experience.event aponta para evento publicado', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'missing-team', severity: 'important' }]
    };
    const onResolveAttention = vi.fn();

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={onResolveAttention}
      />
    );

    const btn = screen.getByText('Continuar preparando');
    fireEvent.click(btn);
    expect(onResolveAttention).toHaveBeenCalledTimes(1);
  });

  it('2. experience.draftEvent aponta para outro ID', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'missing-team', severity: 'important' }]
    };
    const onResolveAttention = vi.fn();

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={onResolveAttention}
      />
    );

    const btn = screen.getByText('Continuar preparando');
    fireEvent.click(btn);

    const calledEvent = onResolveAttention.mock.calls[0][0];
    expect(calledEvent.id).toBe('draft-event');
    expect(calledEvent.id).not.toBe('published-event');
  });

  it('3. modo continue-draft', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'missing-team', severity: 'important' }]
    };

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={vi.fn()}
      />
    );

    expect(screen.getByText('Continuar preparando')).toBeInTheDocument();
  });

  it('4. clicar em Continuar preparando', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'missing-team', severity: 'important' }]
    };
    const onResolveAttention = vi.fn();

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={onResolveAttention}
      />
    );

    const btn = screen.getByText('Continuar preparando');
    fireEvent.click(btn);
    expect(onResolveAttention).toHaveBeenCalled();
  });

  it('5. missing-team', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'missing-team', severity: 'important' }]
    };
    const onResolveAttention = vi.fn();

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={onResolveAttention}
      />
    );

    const btn = screen.getByText('Continuar preparando');
    fireEvent.click(btn);

    const calledAttention = onResolveAttention.mock.calls[0][1];
    expect(calledAttention.code).toBe('missing-team');
  });

  it('6. missing-repertoire', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'missing-repertoire', severity: 'important' }]
    };
    const onResolveAttention = vi.fn();

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={onResolveAttention}
      />
    );

    const btn = screen.getByText('Continuar preparando');
    fireEvent.click(btn);

    const calledAttention = onResolveAttention.mock.calls[0][1];
    expect(calledAttention.code).toBe('missing-repertoire');
  });

  it('7. missing-time', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'missing-time', severity: 'important' }]
    };
    const onResolveAttention = vi.fn();

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={onResolveAttention}
      />
    );

    const btn = screen.getByText('Continuar preparando');
    fireEvent.click(btn);

    const calledAttention = onResolveAttention.mock.calls[0][1];
    expect(calledAttention.code).toBe('missing-time');
  });

  it('8. missing-location', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'missing-location', severity: 'important' }]
    };
    const onResolveAttention = vi.fn();

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={onResolveAttention}
      />
    );

    const btn = screen.getByText('Continuar preparando');
    fireEvent.click(btn);

    const calledAttention = onResolveAttention.mock.calls[0][1];
    expect(calledAttention.code).toBe('missing-location');
  });

  it('9. rascunho completo usa draft/review', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'draft', severity: 'important' }]
    };
    const onResolveAttention = vi.fn();

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={onResolveAttention}
      />
    );

    const btn = screen.getByText('Continuar preparando');
    fireEvent.click(btn);

    const calledAttention = onResolveAttention.mock.calls[0][1];
    expect(calledAttention.code).toBe('draft');
  });

  it('10. ausência de handler abre draftEvent', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: { id: 'draft-event', date: '2026-08-10', title: 'Culto Rascunho', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      attentionItems: [{ code: 'draft', severity: 'important' }]
    };
    const onOpenEvent = vi.fn();

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={onOpenEvent}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
      />
    );

    const btn = screen.getByText('Continuar preparando');
    fireEvent.click(btn);

    expect(onOpenEvent).toHaveBeenCalledTimes(1);
    expect(onOpenEvent.mock.calls[0][0].id).toBe('draft-event');
  });

  it('11. rascunho raw ausente executa fallback', () => {
    const experience = {
      mode: 'continue-draft',
      event: { id: 'published-event', date: '2026-08-10', title: 'Culto Publicado', type: 'music', songCount: 0, userFunctionNames: [], isUserAssigned: false },
      draftEvent: null,
      attentionItems: []
    };

    renderWithRouter(
      <HomeFocusCard
        experience={experience as any}
        canUsePerformance={false}
        onOpenEvent={vi.fn()}
        onOpenPerformance={vi.fn()}
        onCreateScale={vi.fn()}
        onChooseScaleToRepeat={vi.fn()}
        onResolveAttention={vi.fn()}
      />
    );

    expect(screen.queryByText('Continuar preparando')).not.toBeInTheDocument();
  });
});
