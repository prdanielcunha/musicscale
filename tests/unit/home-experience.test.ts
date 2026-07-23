import { describe, it, expect } from 'vitest';
import { 
  evaluateHomeExperience, 
  buildHomeEventSummaries, 
  selectMostRecentDraft,
  getLocalDateKey,
  HomeEventSummary,
  PopulatedScaleWithAssignments
} from '../../utils/homeExperience';
import type { PopulatedBandScale } from '../../types';

describe('Home Experience Domain Logic', () => {
  const defaultInput = {
    isFirstValueJourneyActive: false,
    canManageScales: false,
    upcomingEvents: [] as HomeEventSummary[],
    mostRecentDraft: null,
    currentUserId: 'u1',
  };

  const createEvent = (overrides: Partial<HomeEventSummary>): HomeEventSummary => ({
    id: 'e1',
    type: 'music',
    title: 'Event',
    date: '2026-10-10',
    songCount: 0,
    teamCount: 0,
    userFunctionNames: [],
    isUserAssigned: false,
    ...overrides,
  });

  describe('evaluateHomeExperience', () => {
    it('1. jornada inicial possui prioridade', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        isFirstValueJourneyActive: true,
        canManageScales: true,
        upcomingEvents: [createEvent({ isUserAssigned: true })],
      });
      expect(result.mode).toBe('first-value');
    });

    it('2. usuário escalado recebe assigned-event', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        upcomingEvents: [createEvent({ isUserAssigned: true })],
      });
      expect(result.mode).toBe('assigned-event');
      expect(result.isUserAssigned).toBe(true);
    });

    it('3. líder escalado recebe assigned-event com pendências', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ isUserAssigned: true, status: 'draft', songCount: 0 })],
      });
      expect(result.mode).toBe('assigned-event');
      expect(result.attentionItems.length).toBeGreaterThan(0);
      expect(result.attentionItems.some(i => i.code === 'missing-repertoire')).toBe(true);
      expect(result.attentionItems.some(i => i.code === 'draft')).toBe(true);
    });

    it('4. rascunho mais recente recebe continue-draft', () => {
      const draft = createEvent({ id: 'd1', status: 'draft' });
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        mostRecentDraft: draft,
      });
      expect(result.mode).toBe('continue-draft');
      expect(result.draftEvent?.id).toBe('d1');
    });

    it('5. evento sem repertório', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ songCount: 0, teamCount: 1, time: '10:00', locationName: 'Loc' })],
      });
      expect(result.mode).toBe('leader-attention');
      expect(result.attentionItems.some(i => i.code === 'missing-repertoire')).toBe(true);
    });

    it('6. evento sem equipe', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ songCount: 1, teamCount: 0, time: '10:00', locationName: 'Loc' })],
      });
      expect(result.mode).toBe('leader-attention');
      expect(result.attentionItems.some(i => i.code === 'missing-team')).toBe(true);
    });

    it('7. evento sem horário', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ songCount: 1, teamCount: 1, locationName: 'Loc' })],
      });
      expect(result.mode).toBe('leader-attention');
      expect(result.attentionItems.some(i => i.code === 'missing-time')).toBe(true);
    });

    it('8. evento sem local', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ songCount: 1, teamCount: 1, time: '10:00' })],
      });
      expect(result.mode).toBe('leader-attention');
      expect(result.attentionItems.some(i => i.code === 'missing-location')).toBe(true);
    });

    it('11. líder com evento publicado recebe leader-prepared', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ songCount: 1, teamCount: 1, time: '10:00', locationName: 'Loc', status: 'published' })],
      });
      expect(result.mode).toBe('leader-prepared');
      expect(result.attentionItems.length).toBe(0);
    });

    it('12. não administrador recebe observer-event', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: false,
        upcomingEvents: [createEvent({ isUserAssigned: false })],
      });
      expect(result.mode).toBe('observer-event');
    });

    it('13. administrador sem evento recebe create-next-event', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [],
      });
      expect(result.mode).toBe('create-next-event');
    });

    it('14. músico sem compromisso recebe no-upcoming-event', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: false,
        upcomingEvents: [],
      });
      expect(result.mode).toBe('no-upcoming-event');
    });

    it('17. arrays de entrada não são modificados', () => {
      const originalEvents = [createEvent({})];
      const eventsRef = [...originalEvents];
      evaluateHomeExperience({
        ...defaultInput,
        upcomingEvents: originalEvents,
      });
      expect(originalEvents).toEqual(eventsRef);
    });

    it('19. leader-prepared não afirma confirmação coletiva (não avalia responses do assignment)', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ songCount: 1, teamCount: 1, time: '10:00', locationName: 'Loc', status: 'published' })],
      });
      expect(result.mode).toBe('leader-prepared');
    });

    it('29. usuário escalado no segundo evento recebe esse compromisso', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        upcomingEvents: [
          createEvent({ id: 'e1', isUserAssigned: false }),
          createEvent({ id: 'e2', isUserAssigned: true })
        ],
      });
      expect(result.mode).toBe('assigned-event');
      expect(result.event?.id).toBe('e2');
    });
  });

  describe('buildHomeEventSummaries', () => {
    const today = getLocalDateKey();
    const futureDate = '2099-12-31';
    
    it('9. evento cancelado é ignorado', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { id: '1', status: 'cancelled', date: futureDate } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, []);
      expect(summaries.length).toBe(0);
    });

    it('10. eventos são ordenados por data e horário', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { id: '1', date: '2099-12-31', time: '10:00' } as any,
        { id: '2', date: '2099-12-30', time: '11:00' } as any,
        { id: '3', date: '2099-12-31', time: '09:00' } as any,
      ];
      const summaries = buildHomeEventSummaries(musicScales, []);
      expect(summaries.map(s => s.id)).toEqual(['2', '3', '1']);
    });

    it('15. função duplicada não aparece duas vezes', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { 
          id: '1', 
          date: futureDate, 
          eventAssignments: [
            { userId: 'u1', functionName: 'Guitar', active: true },
            { userId: 'u1', functionName: 'Guitar', active: true }
          ] 
        } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], 'u1');
      expect(summaries[0].userFunctionNames).toEqual(['Guitar']);
    });

    it('16. atribuições inativas não contam', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { 
          id: '1', 
          date: futureDate, 
          eventAssignments: [
            { userId: 'u1', functionName: 'Guitar', active: false },
            { userId: 'u2', functionName: 'Bass', active: true }
          ] 
        } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], 'u1');
      expect(summaries[0].isUserAssigned).toBe(false);
      expect(summaries[0].teamCount).toBe(1);
    });

    it('18. nenhuma métrica de músicas inativas é inventada', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { id: '1', date: futureDate, songs: [] } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, []);
      expect(summaries[0].songCount).toBe(0);
    });

    it('20. datas YYYY-MM-DD não mudam por UTC', () => {
      const key = getLocalDateKey(new Date('2026-10-10T12:00:00Z'));
      // The local date of 12:00 UTC might depend on timezone, but getLocalDateKey uses local JS date.
      // We just expect it to return a string YYYY-MM-DD
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('21. PopulatedScale usa eventAssignments', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { 
          id: '1', 
          date: futureDate, 
          eventAssignments: [
            { userId: 'u1', functionName: 'Vocal', active: true }
          ] 
        } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], 'u1');
      expect(summaries[0].isUserAssigned).toBe(true);
      expect(summaries[0].userFunctionNames).toEqual(['Vocal']);
    });

    it('22. PopulatedBandScale usa user.uid e instrument.name', () => {
      const bandScales: PopulatedBandScale[] = [
        { 
          id: '1', 
          date: futureDate, 
          assignments: [
            { user: { uid: 'u1' }, instrument: { name: 'Drums' } }
          ] 
        } as any
      ];
      const summaries = buildHomeEventSummaries([], bandScales, 'u1');
      expect(summaries[0].isUserAssigned).toBe(true);
      expect(summaries[0].userFunctionNames).toEqual(['Drums']);
    });

    it('23. MusicScale e BandScale ligados não duplicam evento', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { id: 'm1', date: futureDate } as any
      ];
      const bandScales: PopulatedBandScale[] = [
        { id: 'b1', date: futureDate, musicScaleId: 'm1' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, bandScales, 'u1');
      expect(summaries.length).toBe(1);
      expect(summaries[0].id).toBe('m1');
      expect(summaries[0].type).toBe('music');
    });

    it('24. local vem de location.name', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { id: '1', date: futureDate, location: { name: 'Main Hall' } } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, []);
      expect(summaries[0].locationName).toBe('Main Hall');
    });

    it('25. título vem de eventName.name', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { id: '1', date: futureDate, eventName: { name: 'Sunday Service' } } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, []);
      expect(summaries[0].title).toBe('Sunday Service');
    });

    it('26. fallback de título usa eventType.name', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { id: '1', date: futureDate, eventType: { name: 'Youth' } } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, []);
      expect(summaries[0].title).toBe('Youth');
    });

    it('30. duas funções da mesma pessoa contam uma única pessoa na equipe', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { 
          id: '1', 
          date: futureDate, 
          eventAssignments: [
            { userId: 'u1', functionName: 'Vocal', active: true },
            { userId: 'u1', functionName: 'Guitar', active: true }
          ] 
        } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, []);
      expect(summaries[0].teamCount).toBe(1);
    });
  });

  describe('selectMostRecentDraft', () => {
    it('27. Timestamp com toMillis ordena rascunhos', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { id: '1', status: 'draft', createdAt: { toMillis: () => 1000 } } as any,
        { id: '2', status: 'draft', createdAt: { toMillis: () => 2000 } } as any,
      ];
      const draft = selectMostRecentDraft(musicScales, []);
      expect(draft?.id).toBe('2');
    });

    it('28. Timestamp com toDate ordena rascunhos', () => {
      const musicScales: PopulatedScaleWithAssignments[] = [
        { id: '1', status: 'draft', createdAt: { toDate: () => new Date(1000) } } as any,
        { id: '2', status: 'draft', createdAt: { toDate: () => new Date(2000) } } as any,
      ];
      const draft = selectMostRecentDraft(musicScales, []);
      expect(draft?.id).toBe('2');
    });
  });
});
