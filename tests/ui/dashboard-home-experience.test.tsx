import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../../pages/DashboardPage';
import { FirstValueJourneyOutput } from '../../utils/firstValueJourney';

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
vi.mock('../../contexts/ModalContext', () => ({
  useModals: () => ({
    openScaleDetail: mockOpenScaleDetail,
    openBandScaleDetail: mockOpenBandScaleDetail,
    openSongDetail: mockOpenSongDetail,
    openScaleForm: mockOpenScaleForm,
  })
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

export let receivedJourney: FirstValueJourneyOutput | null = null;

vi.mock('../../components/onboarding/FirstScaleJourneyCard', () => ({
  FirstScaleJourneyCard: ({
    journey
  }: {
    journey?: FirstValueJourneyOutput;
  }) => {
    receivedJourney = journey || mockUseFirstScaleExperience();
    return <div data-testid="first-scale-journey">Journey</div>;
  }
}));

export function createJourneyOutput(
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
    receivedJourney = null;
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
    expect(screen.getByText('Você está na equipe')).toBeInTheDocument();
    expect(screen.getAllByText('Sunday Service')[0]).toBeInTheDocument();
    expect(screen.getByText('Função:')).toBeInTheDocument();
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
    expect(screen.getByText('Rascunho salvo')).toBeInTheDocument();
    expect(screen.getByText('Continue preparando')).toBeInTheDocument();
  });

  it('4. líder vê pendências', () => {
    mockUseCapability.mockReturnValue({ hasCapability: (c: string) => c === 'musicscale.scales.manage' });
    const scale = { id: 's1', date: getFutureDate(), status: 'published', eventName: { name: 'Pending Service' }, songs: [] };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText('Requer atenção')).toBeInTheDocument();
    expect(screen.getByText('Repertório vazio')).toBeInTheDocument();
  });

  it('5. dashboard renderiza no estado padrão sem exibir jornada explícita', () => {
    mockUseFirstScaleExperience.mockReturnValue({
      isLoading: false, isEligible: false, isCompleted: true, currentEssentialStep: 'completed'
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
    const exploreBtnText = screen.getByText('Explorar mais');
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
    const exploreBtnText = screen.getByText('Explorar mais');
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

  it('21. não existe "Nova Escala" fixa em EN ou ES', () => {
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
      eventAssignments: [{ userId: 'u1', active: true }], songs: [{ id: 'song1' }]
    };
    mockUseMusic.mockReturnValue({ populatedScales: [scale], populatedBandScales: [], songs: [], loading: false });
    renderWithRouter(<DashboardPage />);
    const perfBtn = screen.getByText('Performance Mode');
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

  it('31. renderiza FirstScaleJourneyCard quando elegível', () => {
    mockUseFirstScaleExperience.mockReturnValue({
      isLoading: false, isEligible: true, isCompleted: false, currentEssentialStep: 'team'
    });
    renderWithRouter(<DashboardPage />);
    expect(screen.getByTestId('first-scale-journey')).toBeInTheDocument();
  });

  it('32. não renderiza FirstScaleJourneyCard quando não elegível', () => {
    mockUseFirstScaleExperience.mockReturnValue({
      isLoading: false, isEligible: false, isCompleted: false, currentEssentialStep: null
    });
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByTestId('first-scale-journey')).not.toBeInTheDocument();
  });

  it('33. jornada elegível com currentEssentialStep: "team" aparece', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "team"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.getByTestId('first-scale-journey')).toBeInTheDocument();
  });

  it('34. receivedJourney.currentEssentialStep é "team"', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "team"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(receivedJourney).not.toBeNull();
    expect(receivedJourney?.currentEssentialStep).toBe("team");
  });

  it('35. jornada elegível com currentEssentialStep: "publish" aparece', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "publish"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.getByTestId('first-scale-journey')).toBeInTheDocument();
  });

  it('36. receivedJourney.currentEssentialStep é "publish"', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "publish"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(receivedJourney).not.toBeNull();
    expect(receivedJourney?.currentEssentialStep).toBe("publish");
  });

  it('37. output entregue possui exatamente quatro milestones', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "team"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(receivedJourney?.milestones).toHaveLength(4);
  });

  it('38. ordem dos milestones é repertoire, firstScale, team, publish', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "team"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    const ids = receivedJourney?.milestones.map(m => m.id);
    expect(ids).toEqual(["repertoire", "firstScale", "team", "publish"]);
  });

  it('39. milestone Team com status optional chega intacto ao card', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "team",
      milestones: [
        { id: "repertoire", status: "completed" },
        { id: "firstScale", status: "completed" },
        { id: "team", status: "optional" },
        { id: "publish", status: "pending" }
      ]
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    const teamMilestone = receivedJourney?.milestones.find(m => m.id === "team");
    expect(teamMilestone?.status).toBe("optional");
  });

  it('40. usuário sem members.manage recebe output em publish, não em team', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "publish",
      canManageMembers: false
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(receivedJourney?.canManageMembers).toBe(false);
    expect(receivedJourney?.currentEssentialStep).toBe("publish");
  });

  it('41. jornada concluída com currentEssentialStep: null não aparece', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: true,
      currentEssentialStep: null
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByTestId('first-scale-journey')).not.toBeInTheDocument();
  });

  it('42. usuário não elegível não recebe jornada', () => {
    const journey = createJourneyOutput({
      isEligible: false,
      isCompleted: false,
      currentEssentialStep: "team"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.queryByTestId('first-scale-journey')).not.toBeInTheDocument();
  });

  it('43. experiência normal do Dashboard continua renderizando', () => {
    const journey = createJourneyOutput({
      isEligible: true,
      isCompleted: false,
      currentEssentialStep: "team"
    });
    mockUseFirstScaleExperience.mockReturnValue(journey);
    renderWithRouter(<DashboardPage />);
    expect(screen.getByText(/Daniel/i)).toBeInTheDocument();
  });
});
