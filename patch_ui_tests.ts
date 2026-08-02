import fs from 'fs';

const path = 'tests/ui/use-home-experience.test.tsx';
let code = fs.readFileSync(path, 'utf8');

const newTest = `
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

    vi.mocked(useAuth).mockReturnValue({ user: { uid: 'user-uid', email: 'a@a.com', displayName: 'A' }, isInitialized: true, isLoading: false, currentOrganizationId: 'org1' } as any);
    vi.mocked(useMusic).mockReturnValue({ populatedScales: scales, populatedBandScales: [], loading: false } as any);

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
`;

const lastBraceIndex = code.lastIndexOf('});');
code = code.substring(0, lastBraceIndex) + newTest + code.substring(lastBraceIndex);

fs.writeFileSync(path, code);
console.log('patched ui tests');
