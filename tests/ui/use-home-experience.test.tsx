import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useHomeExperience } from '../../hooks/useHomeExperience';

const mockUseAuth = vi.fn();
const mockUseMusic = vi.fn();
const mockUseFirstScaleExperience = vi.fn();
const mockUseCapability = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => mockUseMusic(),
}));

vi.mock('../../hooks/useFirstScaleExperience', () => ({
  useFirstScaleExperience: () => mockUseFirstScaleExperience(),
}));

vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => mockUseCapability(),
}));

describe('useHomeExperience hook', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' } });
    mockUseFirstScaleExperience.mockReturnValue({
      isLoading: false,
      isEligible: false,
      isCompleted: true,
      currentEssentialStep: null,
    });
    mockUseCapability.mockReturnValue({
      hasCapability: (cap: string) => cap === 'musicscale.scales.manage',
    });
    mockUseMusic.mockReturnValue({
      populatedScales: [],
      populatedBandScales: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getFutureDate = () => '2099-12-31';

  it('1. MusicScale com eventAssignments reconhece o usuário', () => {
    mockUseMusic.mockReturnValue({
      populatedScales: [
        {
          id: '1',
          date: getFutureDate(),
          eventAssignments: [{ userId: 'u1', active: true }],
        },
      ],
      populatedBandScales: [],
    });
    
    const { result } = renderHook(() => useHomeExperience());
    expect(result.current.experience.mode).toBe('assigned-event');
    expect(result.current.experience.isUserAssigned).toBe(true);
  });

  it('2. BandScale standalone reconhece user.uid', () => {
    mockUseMusic.mockReturnValue({
      populatedScales: [],
      populatedBandScales: [
        {
          id: 'b1',
          date: getFutureDate(),
          assignments: [{ user: { uid: 'u1' } }],
        },
      ],
    });
    
    const { result } = renderHook(() => useHomeExperience());
    expect(result.current.experience.mode).toBe('assigned-event');
    expect(result.current.experience.isUserAssigned).toBe(true);
  });

  it('3. local e título são strings corretas', () => {
    mockUseMusic.mockReturnValue({
      populatedScales: [
        {
          id: '1',
          date: getFutureDate(),
          location: { name: 'Local Test' },
          eventName: { name: 'Title Test' },
        },
      ],
      populatedBandScales: [],
    });
    
    const { result } = renderHook(() => useHomeExperience());
    expect(result.current.upcomingEvents[0].locationName).toBe('Local Test');
    expect(result.current.upcomingEvents[0].title).toBe('Title Test');
  });

  it('4. evento de hoje permanece visível em UTC-3', () => {
    // Generate a valid today key
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    mockUseMusic.mockReturnValue({
      populatedScales: [
        {
          id: '1',
          date: todayKey,
        },
      ],
      populatedBandScales: [],
    });
    
    const { result } = renderHook(() => useHomeExperience());
    expect(result.current.upcomingEvents.length).toBe(1);
    expect(result.current.upcomingEvents[0].date).toBe(todayKey);
  });

  it('5. band scale ligada não duplica', () => {
    mockUseMusic.mockReturnValue({
      populatedScales: [
        { id: '1', date: getFutureDate() },
      ],
      populatedBandScales: [
        { id: 'b1', date: getFutureDate(), musicScaleId: '1' },
      ],
    });
    
    const { result } = renderHook(() => useHomeExperience());
    expect(result.current.upcomingEvents.length).toBe(1);
    expect(result.current.upcomingEvents[0].type).toBe('music');
  });

  it('6. próximo compromisso do usuário pode ser o segundo evento geral', () => {
    mockUseMusic.mockReturnValue({
      populatedScales: [
        { id: '1', date: '2099-12-30', eventAssignments: [] }, // No assignment
        { id: '2', date: '2099-12-31', eventAssignments: [{ userId: 'u1', active: true }] }, // Assigned
      ],
      populatedBandScales: [],
    });
    
    const { result } = renderHook(() => useHomeExperience());
    expect(result.current.experience.mode).toBe('assigned-event');
    expect(result.current.experience.event?.id).toBe('2');
  });

  it('7. rascunho Firestore Timestamp é selecionado', () => {
    mockUseMusic.mockReturnValue({
      populatedScales: [
        { id: '1', status: 'draft', createdAt: { toMillis: () => 1000 } },
        { id: '2', status: 'draft', createdAt: { toMillis: () => 2000 } },
      ],
      populatedBandScales: [],
    });
    
    const { result } = renderHook(() => useHomeExperience());
    // Mode should be continue-draft because there are no upcoming events and capability is true
    expect(result.current.experience.mode).toBe('continue-draft');
    expect(result.current.experience.draftEvent?.id).toBe('2');
  });

  it('8. capacidade vem de musicscale.scales.manage, não de texto do papel', () => {
    mockUseCapability.mockReturnValue({
      hasCapability: (cap: string) => cap === 'musicscale.scales.manage', // returns true
    });
    
    const { result } = renderHook(() => useHomeExperience());
    expect(result.current.experience.canManageScales).toBe(true);
  });

  it('9. TESTE COM FAKE TIMERS - expiração temporal sem reload', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-02T11:29:00'));

    const scales = [
      {
        id: 's1',
        date: '2026-08-02',
        time: '09:30',
        durationMinutes: 120, // Ends at 11:30
        status: 'published',
        eventAssignments: [{ userId: 'user-uid', functionName: 'Vocal' }]
      },
      {
        id: 's2',
        date: '2026-08-02',
        time: '19:00',
        durationMinutes: 120,
        status: 'published',
        eventAssignments: [{ userId: 'user-uid', functionName: 'Vocal' }]
      }
    ];

    mockUseAuth.mockReturnValue({ user: { uid: 'user-uid', email: 'a@a.com', displayName: 'A' }, isInitialized: true, isLoading: false, currentOrganizationId: 'org1' } as any);
    mockUseMusic.mockReturnValue({ populatedScales: scales, populatedBandScales: [], loading: false } as any);

    const { result, unmount } = renderHook(() => useHomeExperience());

    // Às 11:29, o evento das 09:30 ainda deve ser o principal
    expect(result.current.experience.event?.id).toBe('s1');
    expect(result.current.experience.event?.eventTemporalState).toBe('in-progress');
    
    // Avançar tempo para 11:30:00 e executar timer do hook (60s)
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    // Às 11:30, o evento das 09:30 expirou. s2 é promovido
    expect(result.current.experience.event?.id).toBe('s2');
    expect(result.current.experience.event?.eventTemporalState).toBe('upcoming');
    
    unmount();
    vi.useRealTimers();
  });
});
