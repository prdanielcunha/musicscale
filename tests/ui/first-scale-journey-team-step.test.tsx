import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirstScaleJourneyCard } from '../../components/onboarding/FirstScaleJourneyCard';
import { FirstValueJourneyOutput, FirstValueJourneyMilestone } from '../../utils/firstValueJourney';
import { BrowserRouter } from 'react-router-dom';
import pt from '../../locales/pt.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

vi.unmock('react-i18next');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockOpenModal = vi.fn();
const mockCloseModal = vi.fn();
vi.mock('../../contexts/ModalContext', () => ({
  useModals: () => ({ openModal: mockOpenModal, closeModal: mockCloseModal })
}));

type MotionDivProps = React.PropsWithChildren<
  Pick<
    React.HTMLAttributes<HTMLDivElement>,
    | "className"
    | "style"
    | "onClick"
  >
>;

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, className, style, onClick }: MotionDivProps) => (
      <div className={className} style={style} onClick={onClick}>
        {children}
      </div>
    )
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ currentUser: { uid: 'u1' }, organization: { id: 'org1' } }),
  useLimits: () => ({})
}));

const mockApi = {
  updateUser: vi.fn(),
  updateScale: vi.fn()
};

vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => ({ api: mockApi })
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({ songs: [], scales: [] })
}));

const mockHandleAction = vi.fn((action: string, fallback?: () => void) => {
  if (fallback) fallback();
});

vi.mock('../../hooks/useFirstScaleExperience', () => ({
  useFirstScaleExperience: () => ({
    handleAction: mockHandleAction,
    isLoading: false,
    error: null
  })
}));

vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({ hasCapability: () => true })
}));

function renderWithI18n(ui: React.ReactElement, lang = 'pt') {
  const i18nInstance = createInstance();
  i18nInstance.use(initReactI18next).init({
    lng: lang,
    fallbackLng: 'pt',
    resources: {
      pt: { translation: pt },
      en: { translation: en },
      es: { translation: es }
    },
    interpolation: { escapeValue: false }
  });
  return {
    ...render(
      <BrowserRouter>
        <I18nextProvider i18n={i18nInstance}>
          {ui}
        </I18nextProvider>
      </BrowserRouter>
    ),
    i18n: i18nInstance
  };
}

const renderWithRouter = (ui: React.ReactElement, lang = 'pt') => {
  return renderWithI18n(ui, lang);
};

function createBaseOutput(overrides: Partial<FirstValueJourneyOutput> = {}): FirstValueJourneyOutput {
  return {
    isEligible: true,
    isLoading: false,
    isCompleted: false,
    currentEssentialStep: 'team',
    completedEssentialSteps: 2,
    totalEssentialSteps: 4,
    milestones: [
      { id: 'repertoire', status: 'completed' },
      { id: 'firstScale', status: 'completed' },
      { id: 'team', status: 'current' },
      { id: 'publish', status: 'pending' }
    ],
    draftScale: { id: 'draft-1' },
    hasTeam: false,
    teamState: 'empty',
    teamSetupSummary: {
      additionalMembers: 0,
      configuredMembers: 0,
      incompleteMemberIds: [],
      isTeamConfigured: false,
      totalMembers: 0,
      membersWithAccessProfile: 0,
      membersWithMinistryFunctions: 0,
      memberStatuses: []
    },
    canManageMembers: true,
    ...overrides
  };
}

describe('FirstScaleJourneyCard - Team Step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('quatro marcos em PT', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput()} />, 'pt');
    expect(screen.getAllByText(pt.firstValueJourney.milestoneRepertoire).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt.firstValueJourney.milestoneFirstScale).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt.firstValueJourney.milestoneTeam).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt.firstValueJourney.milestonePublish).length).toBeGreaterThan(0);
  });

  it('quatro marcos em EN', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput()} />, 'en');
    expect(screen.getAllByText(en.firstValueJourney.milestoneRepertoire).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.firstValueJourney.milestoneFirstScale).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.firstValueJourney.milestoneTeam).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.firstValueJourney.milestonePublish).length).toBeGreaterThan(0);
  });

  it('quatro marcos em ES', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput()} />, 'es');
    expect(screen.getAllByText(es.firstValueJourney.milestoneRepertoire).length).toBeGreaterThan(0);
    expect(screen.getAllByText(es.firstValueJourney.milestoneFirstScale).length).toBeGreaterThan(0);
    expect(screen.getAllByText(es.firstValueJourney.milestoneTeam).length).toBeGreaterThan(0);
    expect(screen.getAllByText(es.firstValueJourney.milestonePublish).length).toBeGreaterThan(0);
  });

  it('empty mostra ação principal', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    expect(screen.getByText(pt.firstValueJourney.addTeamAction)).toBeInTheDocument();
  });

  it('empty mostra continuar sem equipe', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    expect(screen.getByText(pt.firstValueJourney.continueWithoutTeamAction)).toBeInTheDocument();
  });

  it('incomplete mostra configurar pessoas', () => {
    const output = createBaseOutput({
      teamState: 'incomplete',
      teamSetupSummary: {
        additionalMembers: 1, configuredMembers: 0, incompleteMemberIds: ['u1'], isTeamConfigured: false, totalMembers: 0, membersWithAccessProfile: 0, membersWithMinistryFunctions: 0, memberStatuses: []
      }
    });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    expect(screen.getByText(pt.firstValueJourney.configureTeamAction)).toBeInTheDocument();
  });

  it('incomplete mostra contadores', () => {
    const output = createBaseOutput({
      teamState: 'incomplete',
      teamSetupSummary: {
        additionalMembers: 1, configuredMembers: 0, incompleteMemberIds: ['u1'], isTeamConfigured: false, totalMembers: 0, membersWithAccessProfile: 0, membersWithMinistryFunctions: 0, memberStatuses: []
      }
    });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    expect(screen.getByText(pt.firstValueJourney.teamSummaryTotal)).toBeInTheDocument();
    expect(screen.getByText(pt.firstValueJourney.teamSummaryReady)).toBeInTheDocument();
    expect(screen.getByText(pt.firstValueJourney.teamSummaryPending)).toBeInTheDocument();
  });

  it('ready não renderiza etapa Team', () => {
    const output = createBaseOutput({ teamState: 'ready', currentEssentialStep: 'publish' });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    expect(screen.queryByText(pt.firstValueJourney.teamEmptyTitle)).not.toBeInTheDocument();
  });

  it('unavailable renderiza Publicação', () => {
    const output = createBaseOutput({ teamState: 'unavailable', currentEssentialStep: 'publish' });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    expect(screen.getByText(pt.firstValueJourney.teamUnavailableTitle)).toBeInTheDocument();
  });

  it('unavailable não mostra gerenciamento', () => {
    const output = createBaseOutput({ teamState: 'unavailable', currentEssentialStep: 'publish', canManageMembers: false });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    expect(screen.queryByText(pt.firstValueJourney.addTeamAction)).not.toBeInTheDocument();
    expect(screen.queryByText(pt.firstValueJourney.prepareTeamAction)).not.toBeInTheDocument();
  });

  it('milestone Team aparece optional em PT', () => {
    const milestones: FirstValueJourneyMilestone[] = [
      { id: 'repertoire', status: 'completed' },
      { id: 'firstScale', status: 'completed' },
      { id: 'team', status: 'optional' },
      { id: 'publish', status: 'current' }
    ];
    const output = createBaseOutput({ milestones });
    const { container } = renderWithRouter(<FirstScaleJourneyCard journey={output} />, 'pt');
    
    const teamMilestone = container.querySelector('[data-status="optional"]');
    expect(teamMilestone).toBeInTheDocument();
    expect(teamMilestone?.getAttribute('aria-label')).toBe('Equipe (Opcional)');
    
    const optionalLabels = container.querySelectorAll('[data-milestone-optional="true"]');
    expect(optionalLabels.length).toBeGreaterThan(0);
    expect(optionalLabels[0]).toHaveTextContent('Opcional');
  });

  it('milestone Team aparece optional em EN', () => {
    const milestones: FirstValueJourneyMilestone[] = [
      { id: 'repertoire', status: 'completed' },
      { id: 'firstScale', status: 'completed' },
      { id: 'team', status: 'optional' },
      { id: 'publish', status: 'current' }
    ];
    const output = createBaseOutput({ milestones });
    const { container } = renderWithRouter(<FirstScaleJourneyCard journey={output} />, 'en');
    
    const teamMilestone = container.querySelector('[data-status="optional"]');
    expect(teamMilestone).toBeInTheDocument();
    expect(teamMilestone?.getAttribute('aria-label')).toBe('Team (Optional)');
    
    const optionalLabels = container.querySelectorAll('[data-milestone-optional="true"]');
    expect(optionalLabels.length).toBeGreaterThan(0);
    expect(optionalLabels[0]).toHaveTextContent('Optional');
  });

  it('milestone Team aparece optional em ES', () => {
    const milestones: FirstValueJourneyMilestone[] = [
      { id: 'repertoire', status: 'completed' },
      { id: 'firstScale', status: 'completed' },
      { id: 'team', status: 'optional' },
      { id: 'publish', status: 'current' }
    ];
    const output = createBaseOutput({ milestones });
    const { container } = renderWithRouter(<FirstScaleJourneyCard journey={output} />, 'es');
    
    const teamMilestone = container.querySelector('[data-status="optional"]');
    expect(teamMilestone).toBeInTheDocument();
    expect(teamMilestone?.getAttribute('aria-label')).toBe('Equipo (Opcional)');
    
    const optionalLabels = container.querySelectorAll('[data-milestone-optional="true"]');
    expect(optionalLabels.length).toBeGreaterThan(0);
    expect(optionalLabels[0]).toHaveTextContent('Opcional');
  });

  it('adicionar pessoas envia state correto', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    fireEvent.click(screen.getByText(pt.firstValueJourney.addTeamAction));
    expect(mockNavigate).toHaveBeenCalledWith('/users', { state: { teamSetupIntent: 'add-members', origin: 'first-value-journey', returnTo: '/' } });
  });

  it('configurar pessoas envia state correto', () => {
    const output = createBaseOutput({
      teamState: 'incomplete',
      teamSetupSummary: {
        additionalMembers: 1, configuredMembers: 0, incompleteMemberIds: ['u1'], isTeamConfigured: false, totalMembers: 0, membersWithAccessProfile: 0, membersWithMinistryFunctions: 0, memberStatuses: []
      }
    });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    fireEvent.click(screen.getByText(pt.firstValueJourney.configureTeamAction));
    expect(mockNavigate).toHaveBeenCalledWith('/users', { state: { teamSetupIntent: 'configure-existing', origin: 'first-value-journey', returnTo: '/' } });
  });

  it('preparar equipe envia state correto', () => {
    const output = createBaseOutput({
      teamState: 'incomplete',
      currentEssentialStep: 'publish',
      teamSetupSummary: {
        additionalMembers: 2, configuredMembers: 1, incompleteMemberIds: ['u1'], isTeamConfigured: true, totalMembers: 0, membersWithAccessProfile: 0, membersWithMinistryFunctions: 0, memberStatuses: []
      }
    });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    fireEvent.click(screen.getByText(pt.firstValueJourney.prepareTeamAction));
    expect(mockNavigate).toHaveBeenCalledWith('/users', { state: { teamSetupIntent: 'configure-existing', origin: 'first-value-journey', returnTo: '/' } });
  });

  it('continuar sem equipe abre rascunho correto', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    fireEvent.click(screen.getByText(pt.firstValueJourney.continueWithoutTeamAction));
    expect(mockNavigate).toHaveBeenCalledWith('/scales/draft-1');
  });

  it('continuar sem equipe sem rascunho usa fluxo canônico', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty', draftScale: null })} />);
    fireEvent.click(screen.getByText(pt.firstValueJourney.continueWithoutTeamAction));
    expect(mockNavigate).toHaveBeenCalledWith('/scales');
  });

  it('continuar sem equipe tem um único efeito público (abrir fluxo da escala)', () => {
    mockNavigate.mockClear();
    mockOpenModal.mockClear();
    mockCloseModal.mockClear();

    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    
    fireEvent.click(screen.getByText(pt.firstValueJourney.continueWithoutTeamAction));
    
    expect(mockNavigate).toHaveBeenCalledOnce();
    expect(mockNavigate).toHaveBeenCalledWith('/scales/draft-1');
    expect(mockOpenModal).not.toHaveBeenCalled();
    expect(mockCloseModal).not.toHaveBeenCalled();
  });

  it('publicação sem equipe mostra aviso', () => {
    const output = createBaseOutput({
      currentEssentialStep: 'publish',
      teamSetupSummary: {
        additionalMembers: 0, configuredMembers: 0, incompleteMemberIds: [], isTeamConfigured: false, totalMembers: 0, membersWithAccessProfile: 0, membersWithMinistryFunctions: 0, memberStatuses: []
      }
    });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    expect(screen.getByText(pt.firstValueJourney.publishWithoutTeamWarning)).toBeInTheDocument();
  });

  it('publicação com pendência mostra aviso diferente', () => {
    const output = createBaseOutput({
      currentEssentialStep: 'publish',
      teamSetupSummary: {
        additionalMembers: 2, configuredMembers: 1, incompleteMemberIds: ['u1'], isTeamConfigured: true, totalMembers: 0, membersWithAccessProfile: 0, membersWithMinistryFunctions: 0, memberStatuses: []
      }
    });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    expect(screen.getByText(pt.firstValueJourney.publishWithPendingWarning)).toBeInTheDocument();
  });

  it('publicação com equipe completa não mostra aviso', () => {
    const output = createBaseOutput({
      currentEssentialStep: 'publish',
      teamSetupSummary: {
        additionalMembers: 1, configuredMembers: 1, incompleteMemberIds: [], isTeamConfigured: true, totalMembers: 0, membersWithAccessProfile: 0, membersWithMinistryFunctions: 0, memberStatuses: []
      }
    });
    renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    expect(screen.queryByText(pt.firstValueJourney.publishWithoutTeamWarning)).not.toBeInTheDocument();
    expect(screen.queryByText(pt.firstValueJourney.publishWithPendingWarning)).not.toBeInTheDocument();
  });

  it('exatamente uma ação principal para cada estado relevante', () => {
    const states = [
      { currentEssentialStep: 'repertoire' as const, teamState: 'empty' as const },
      { currentEssentialStep: 'firstScale' as const, teamState: 'empty' as const },
      { currentEssentialStep: 'team' as const, teamState: 'empty' as const },
      { currentEssentialStep: 'team' as const, teamState: 'incomplete' as const },
      { currentEssentialStep: 'publish' as const, teamState: 'empty' as const }
    ];

    for (const s of states) {
      const output = createBaseOutput({
        currentEssentialStep: s.currentEssentialStep,
        teamState: s.teamState
      });
      const { container } = renderWithRouter(<FirstScaleJourneyCard journey={output} />);
      const primaryActions = container.querySelectorAll('[data-primary-action="true"]');
      expect(primaryActions).toHaveLength(1);

      const action = primaryActions[0];
      expect(action.tagName.toLowerCase()).toBe('button');
      
      expect(action).toHaveAccessibleName();

      if (s.currentEssentialStep === 'team' && s.teamState === 'empty') {
        const secondary = screen.getByText(pt.firstValueJourney.continueWithoutTeamAction);
        expect(secondary.getAttribute('data-primary-action')).toBeNull();
      }
    }
  });

  it('nomes acessíveis', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    const btn = screen.getByRole('button', { name: pt.firstValueJourney.addTeamAction });
    expect(btn).toBeInTheDocument();
  });

  it('navegação por teclado com Enter na ação principal', async () => {
    const user = userEvent.setup();
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    
    const primaryBtn = screen.getByRole('button', { name: pt.firstValueJourney.addTeamAction });
    
    let focused = false;
    for (let i = 0; i < 15; i++) {
      await user.tab();
      if (document.activeElement === primaryBtn) {
        focused = true;
        break;
      }
    }
    expect(focused).toBe(true);
    expect(primaryBtn).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(mockNavigate).toHaveBeenCalledWith('/users', {
      state: {
        teamSetupIntent: 'add-members',
        origin: 'first-value-journey',
        returnTo: '/'
      }
    });
  });

  it('navegação por teclado com Space na ação principal', async () => {
    const user = userEvent.setup();
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    
    const primaryBtn = screen.getByRole('button', { name: pt.firstValueJourney.addTeamAction });
    
    let focused = false;
    for (let i = 0; i < 15; i++) {
      await user.tab();
      if (document.activeElement === primaryBtn) {
        focused = true;
        break;
      }
    }
    expect(focused).toBe(true);
    expect(primaryBtn).toHaveFocus();
    
    await user.keyboard(' ');
    expect(mockNavigate).toHaveBeenCalledWith('/users', {
      state: {
        teamSetupIntent: 'add-members',
        origin: 'first-value-journey',
        returnTo: '/'
      }
    });
  });

  it('quatro colunas não eliminam labels', () => {
    const { container } = renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput()} />);
    
    const items = container.querySelectorAll('.md\\:flex-1');
    expect(items.length).toBeGreaterThanOrEqual(4);
    
    expect(screen.getAllByText(pt.firstValueJourney.milestoneRepertoire).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt.firstValueJourney.milestoneFirstScale).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt.firstValueJourney.milestoneTeam).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt.firstValueJourney.milestonePublish).length).toBeGreaterThan(0);
  });
});
