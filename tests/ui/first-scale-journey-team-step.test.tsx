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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../contexts/ModalContext', () => ({
  useModals: () => ({ openModal: vi.fn(), closeModal: vi.fn() })
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, className, style, onClick }: React.PropsWithChildren<any>) => <div className={className} style={style} onClick={onClick}>{children}</div>
  },
  AnimatePresence: ({ children }: React.PropsWithChildren<any>) => <>{children}</>
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

vi.mock('../../hooks/useFirstScaleExperience', () => ({
  useFirstScaleExperience: () => ({
    handleAction: (action: string, fallback?: () => void) => { fallback && fallback(); },
    isLoading: false,
    error: null
  })
}));

vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({ hasCapability: () => true })
}));

let currentLang = 'pt';
vi.mock('react-i18next', () => ({
  useTranslation: () => {
    return {
      t: (key: string, variables: any) => {
        const parts = key.split('.');
        let obj: any = currentLang === 'pt' ? pt : currentLang === 'en' ? en : es;
        for (const p of parts) {
          if (obj) obj = obj[p];
        }
        
        let val = obj || key;
        if (typeof val === 'string' && variables) {
           for (const k in variables) {
              val = val.replace(`{{${k}}}`, variables[k]);
           }
        }
        return val;
      },
      i18n: { language: currentLang }
    };
  }
}));

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

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('FirstScaleJourneyCard - Team Step', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentLang = 'pt';
  });

  it('quatro marcos em PT', () => {
    currentLang = 'pt';
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput()} />);
    expect(screen.getAllByText(pt.firstValueJourney.milestoneRepertoire).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt.firstValueJourney.milestoneFirstScale).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt.firstValueJourney.milestoneTeam).length).toBeGreaterThan(0);
    expect(screen.getAllByText(pt.firstValueJourney.milestonePublish).length).toBeGreaterThan(0);
  });

  it('quatro marcos em EN', () => {
    currentLang = 'en';
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput()} />);
    expect(screen.getAllByText(en.firstValueJourney.milestoneRepertoire).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.firstValueJourney.milestoneFirstScale).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.firstValueJourney.milestoneTeam).length).toBeGreaterThan(0);
    expect(screen.getAllByText(en.firstValueJourney.milestonePublish).length).toBeGreaterThan(0);
  });

  it('quatro marcos em ES', () => {
    currentLang = 'es';
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput()} />);
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

  it('milestone Team aparece optional', () => {
    const milestones: FirstValueJourneyMilestone[] = [
      { id: 'repertoire', status: 'completed' },
      { id: 'firstScale', status: 'completed' },
      { id: 'team', status: 'optional' },
      { id: 'publish', status: 'current' }
    ];
    const output = createBaseOutput({ milestones });
    const { container } = renderWithRouter(<FirstScaleJourneyCard journey={output} />);
    
    const teamMilestone = container.querySelector('[data-status="optional"]');
    expect(teamMilestone).toBeInTheDocument();
    
    expect(screen.getAllByText(pt.firstValueJourney.milestoneTeam).length).toBeGreaterThan(0);
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

  it('continuar sem equipe não chama API', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    fireEvent.click(screen.getByText(pt.firstValueJourney.continueWithoutTeamAction));
    
    expect(mockNavigate).toHaveBeenCalled();
    expect(mockApi.updateUser).not.toHaveBeenCalled();
    expect(mockApi.updateScale).not.toHaveBeenCalled();
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

  it('somente uma ação principal', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    
    const primaryBtn = screen.getByText(pt.firstValueJourney.addTeamAction);
    expect(primaryBtn.className).toContain('bg-white');
    expect(primaryBtn.className).toContain('text-zinc-900');
    
    const secondaryBtn = screen.getByText(pt.firstValueJourney.continueWithoutTeamAction);
    expect(secondaryBtn.className).not.toContain('bg-white text-zinc-900');
  });

  it('nomes acessíveis', () => {
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    const btn = screen.getByRole('button', { name: pt.firstValueJourney.addTeamAction });
    expect(btn).toBeInTheDocument();
  });

  it('navegação por teclado', async () => {
    const user = userEvent.setup();
    renderWithRouter(<FirstScaleJourneyCard journey={createBaseOutput({ teamState: 'empty' })} />);
    
    const primaryBtn = screen.getByRole('button', { name: pt.firstValueJourney.addTeamAction });
    
    primaryBtn.focus();
    expect(primaryBtn).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(mockNavigate).toHaveBeenCalled();
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
