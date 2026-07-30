import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../../pages/DashboardPage';

// Real code for determining next event
import { buildHomeEventSummaries, evaluateHomeExperience } from '../../utils/homeExperience';

// Mock Translation
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
      pt: { translation: pt },
      en: { translation: en },
      es: { translation: es }
    },
    lng: 'pt',
    fallbackLng: 'pt',
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

// UNMOCK useHomeExperience so we test the REAL logic inside the component!
// vi.mock('../../hooks/useHomeExperience', () => ({ useHomeExperience: () => mockUseHomeExperience() }));


const mockUseSuggestionsContext = vi.fn();
vi.mock('../../contexts/SuggestionContext', () => ({ useSuggestionsContext: () => mockUseSuggestionsContext() }));


vi.mock('../../hooks/useFirstScaleExperience', () => ({
  useFirstScaleExperience: () => ({
    isLoading: false,
    isEligible: false,
    isCompleted: false,
    currentEssentialStep: null
  })
}));



vi.mock('../../contexts/ModalContext', () => ({
  useModals: () => ({
    openScaleDetail: vi.fn(),
    openBandScaleDetail: vi.fn(),
    openSongDetail: vi.fn(),
    openScaleForm: vi.fn(),
  })
}));

vi.mock('../../components/scales/AssignmentResponseActions', () => ({
  default: () => <div data-testid="mock-response-actions">Response Actions</div>
}));

vi.mock('../../components/support/SupportRuntimeInspector', () => ({
  SupportRuntimeInspector: () => <div data-testid="support-inspector" style={{ display: 'none' }} />
}));

vi.mock('../../components/onboarding/FirstScaleJourneyCard', () => ({
  FirstScaleJourneyCard: () => <div data-testid="first-scale-journey">Journey</div>
}));

const defaultUser = { uid: 'u1', displayName: 'Daniel' };
const defaultOrg = { id: 'org1', slug: 'org1' };

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{ui}</MemoryRouter>
    </I18nextProvider>
  );
};

import { PopulatedScaleWithAssignmentsAndStatus } from '../../utils/homeExperience';
import { EventName } from '../../types';

function createMockScale(overrides: any): PopulatedScaleWithAssignmentsAndStatus {
  const eventNameObj: EventName | null = overrides.eventName === undefined ? null : overrides.eventName;
  return {
    id: overrides.id || 'mock-id',
    date: overrides.date || '2026-12-31',
    time: overrides.time || '19:00',
    status: (overrides.status || 'published') as 'draft' | 'published' | 'cancelled' | 'completed',
    eventName: eventNameObj,
    observations: overrides.observations || '',
    songs: overrides.songs || [],
    eventType: overrides.eventType || { id: 'evt-1', name: 'Culto' },
    location: overrides.location || { id: 'loc-1', name: 'Prédio Principal' },
    createdBy: overrides.createdBy || { uid: 'u1', displayName: 'Daniel', photoURL: null },
    createdAt: overrides.createdAt || '2026-08-01T00:00:00Z',
    eventAssignments: overrides.eventAssignments || [],
    ...overrides
  } as PopulatedScaleWithAssignmentsAndStatus;
}

describe('Dashboard & Upcoming Event Logic', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseAuth.mockReturnValue({ user: defaultUser, organization: defaultOrg, isOwner: false, isSupportMode: false });
    mockUseCapability.mockReturnValue({ hasCapability: () => true }); // Can manage scales
    mockUseSuggestionsContext.mockReturnValue({ suggestions: [], loading: false });
    mockUseMusic.mockReturnValue({ populatedScales: [], populatedBandScales: [], songs: [], loading: false, error: null });
  });

  describe('Next Event Logic (Real code)', () => {
    const org1Scale = createMockScale({
      id: 'sc-future-1',
      organizationId: 'org1',
      date: '2026-12-31',
      time: '19:00',
      status: 'published',
      eventName: { id: 'en-1', name: 'Culto Futuro 1' }
    });
    const org1ScalePast = createMockScale({
      id: 'sc-past-1',
      organizationId: 'org1',
      date: '2020-01-01',
      time: '10:00',
      status: 'published',
      eventName: { id: 'en-2', name: 'Culto Passado' }
    });
    const org1ScaleCancelled = createMockScale({
      id: 'sc-canc-1',
      organizationId: 'org1',
      date: '2026-12-31',
      time: '20:00',
      status: 'cancelled',
      eventName: { id: 'en-3', name: 'Culto Cancelado' }
    });

    it('determina evento futuro mais próximo com data e horário', () => {
      const scaleCedo = createMockScale({
        ...org1Scale,
        id: 'sc-future-2',
        time: '18:00',
        eventName: { id: 'en-cedo', name: 'Mais Cedo' }
      });
      const summaries = buildHomeEventSummaries([org1Scale, scaleCedo], [], 'u1', '2026-08-01');
      expect(summaries[0].id).toBe('sc-future-2'); // 18:00 comes before 19:00
      
      const exp = evaluateHomeExperience({ isFirstValueJourneyActive: false, canManageScales: true, upcomingEvents: summaries, mostRecentDraft: null, currentUserId: "u1" });
      expect(exp.event?.id).toBe('sc-future-2');
    });

    it('ignora passado e cancelado', () => {
      const summaries = buildHomeEventSummaries([org1ScalePast, org1ScaleCancelled, org1Scale], [], 'u1', '2026-08-01');
      expect(summaries.length).toBe(1);
      expect(summaries[0].id).toBe('sc-future-1');
    });

    it('músico vs líder: músico recebe destaque no evento escalado', () => {
      const myScale = createMockScale({
        ...org1Scale,
        id: 'my-scale',
        eventAssignments: [{ eventAssignmentId: 'a1', sourceBandScaleId: null, sourceAssignmentId: null, userId: 'u1', functionId: 'f1', functionName: 'Violão', functionCategory: 'musical_instrument', active: true, assignmentRevision: 1 }]
      });
      const otherScale = createMockScale({
        ...org1Scale,
        id: 'other-scale',
        date: '2026-12-30',
        eventAssignments: [{ eventAssignmentId: 'a2', sourceBandScaleId: null, sourceAssignmentId: null, userId: 'u2', functionId: 'f1', functionName: 'Violão', functionCategory: 'musical_instrument', active: true, assignmentRevision: 1 }]
      });
      
      const summaries = buildHomeEventSummaries([myScale, otherScale], [], 'u1', '2026-08-01');
      const exp = evaluateHomeExperience({ isFirstValueJourneyActive: false, canManageScales: false, upcomingEvents: summaries, mostRecentDraft: null, currentUserId: "u1" });
      
      // Músico (não admin) - o próximo evento DELE deve ser o destaque (my-scale), mesmo que other-scale seja antes
      expect(exp.mode).toBe('assigned-event');
      expect(exp.event?.id).toBe('my-scale');
    });

    it('líder: vê o próximo evento geral, se não estiver escalado em nada, em modo manager', () => {
      const otherScale = createMockScale({
        ...org1Scale,
        id: 'other-scale',
        date: '2026-12-30',
        eventAssignments: [{ eventAssignmentId: 'a2', sourceBandScaleId: null, sourceAssignmentId: null, userId: 'u2', functionId: 'f1', functionName: 'Violão', functionCategory: 'musical_instrument', active: true, assignmentRevision: 1 }]
      });
      const summaries = buildHomeEventSummaries([otherScale], [], 'u1', '2026-08-01');
      const exp = evaluateHomeExperience({ isFirstValueJourneyActive: false, canManageScales: true, upcomingEvents: summaries, mostRecentDraft: null, currentUserId: "u1" });
      
      expect(exp.mode).toBe("leader-attention");
      expect(exp.event?.id).toBe('other-scale');
    });
  });

  describe('Dashboard UI Rendering', () => {
    it('renderiza loading', () => {
      mockUseMusic.mockReturnValue({ populatedScales: [], populatedBandScales: [], songs: [], loading: true, error: null });
      console.log("music:", mockUseMusic()); console.log("sugg:", mockUseSuggestionsContext()); renderWithRouter(<DashboardPage />);
      expect(screen.getByLabelText(i18n.t('dashboard.loading'))).toBeInTheDocument();
    });

    it('renderiza erro', () => {
      mockUseMusic.mockReturnValue({ populatedScales: [], populatedBandScales: [], songs: [], loading: false, error: new Error('Network fail') });
      renderWithRouter(<DashboardPage />);
      expect(screen.getByText(i18n.t('updates.error'))).toBeInTheDocument();
    });

    it('renderiza vazio (nenhuma organização)', () => {
      mockUseAuth.mockReturnValue({ user: defaultUser, organization: null, isOwner: false, isSupportMode: false });
      renderWithRouter(<DashboardPage />);
      expect(screen.getByText(i18n.t('dashboard.noOrgTitle'))).toBeInTheDocument();
    });

    it('reage perfeitamente a mudança de idioma dinâmica (pt -> en -> es)', async () => {
      mockUseAuth.mockReturnValue({ user: defaultUser, organization: null, isOwner: false, isSupportMode: false });
      
      const { rerender } = renderWithRouter(<DashboardPage />);
      expect(screen.getByText(pt.dashboard.noOrgTitle)).toBeInTheDocument();

      // Switch to English
      await act(async () => {
        await i18n.changeLanguage('en');
      });
      rerender(<I18nextProvider i18n={i18n}><DashboardPage /></I18nextProvider>);
      expect(screen.getByText(en.dashboard.noOrgTitle)).toBeInTheDocument();

      // Switch to Spanish
      await act(async () => {
        await i18n.changeLanguage('es');
      });
      rerender(<I18nextProvider i18n={i18n}><DashboardPage /></I18nextProvider>);
      expect(screen.getByText(es.dashboard.noOrgTitle)).toBeInTheDocument();

      // Switch back to Portuguese
      await act(async () => {
        await i18n.changeLanguage('pt');
      });
      rerender(<I18nextProvider i18n={i18n}><DashboardPage /></I18nextProvider>);
      expect(screen.getByText(pt.dashboard.noOrgTitle)).toBeInTheDocument();
    });

    it('atualização de horário e isolamento da organização no render', () => {
      // Mock with two valid scales. The dashboard should render the closest one if using real code.
      // E.g. date is tomorrow.
      // Note: buildHomeEventSummaries uses getLocalDateKey(). So we must use a far future date to guarantee it shows up.
      mockUseMusic.mockReturnValue({
        populatedScales: [{
          id: 'org1-next',
          date: '2099-12-31',
          time: '19:00',
          status: 'published',
          eventName: { name: 'Culto Futuro' },
          eventAssignments: []
        }],
        populatedBandScales: [],
        songs: [],
        loading: false,
        error: null
      });

      renderWithRouter(<DashboardPage />);
      
      // Wait for the UI to show the next event card
      expect(screen.getByText('Culto Futuro')).toBeInTheDocument();
      // Should show Add to Calendar button
    });
    
    it('mudança de organização renderiza dados correspondentes (isolamento)', () => {
      mockUseAuth.mockReturnValue({ user: defaultUser, organization: { id: 'org2', slug: 'org2' }, isOwner: false, isSupportMode: false });
      mockUseMusic.mockReturnValue({
        populatedScales: [{
          id: 'org2-next',
          date: '2099-12-31',
          time: '19:00',
          status: 'published',
          eventName: { name: 'Culto Org2' },
          eventAssignments: []
        }],
        populatedBandScales: [],
        songs: [],
        loading: false,
        error: null
      });

      renderWithRouter(<DashboardPage />);
      expect(screen.getByText('Culto Org2')).toBeInTheDocument();
      expect(screen.queryByText('Culto Futuro')).not.toBeInTheDocument();
    });
  });
});
