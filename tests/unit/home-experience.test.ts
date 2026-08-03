import { describe, it, expect } from 'vitest';
import { 
  evaluateHomeExperience, 
  buildHomeEventSummaries, 
  selectMostRecentDraft,
  getLocalDateKey,
  HomeEventSummary,
  PopulatedScaleWithAssignmentsAndStatus,
  PopulatedBandScaleWithStatus,
  canUsePerformanceMode
} from '../../utils/homeExperience';
import type { PopulatedBandScale } from '../../types';
import type { PopulatedScaleWithAssignments } from '../../utils/homeExperience';

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
    date: '2099-12-31',
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

    it('12. MusicScale vazia recebe missing-repertoire', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ type: 'music', songCount: 0, teamCount: 1, time: '10:00', locationName: 'Loc' })],
      });
      expect(result.attentionItems.some(i => i.code === 'missing-repertoire')).toBe(true);
    });

    it('11. BandScale não recebe missing-repertoire', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ type: 'band', songCount: 0, teamCount: 1, time: '10:00', locationName: 'Loc' })],
      });
      expect(result.attentionItems.some(i => i.code === 'missing-repertoire')).toBe(false);
    });

    it('13. BandScale sem equipe recebe missing-team', () => {
      const result = evaluateHomeExperience({
        ...defaultInput,
        canManageScales: true,
        upcomingEvents: [createEvent({ type: 'band', songCount: 0, teamCount: 0, time: '10:00', locationName: 'Loc' })],
      });
      expect(result.attentionItems.some(i => i.code === 'missing-team')).toBe(true);
    });
  });

  describe('buildHomeEventSummaries', () => {
    const today = '2026-10-10';

    it('1. MusicScale sem data é ignorada', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries.length).toBe(0);
    });

    it('2. BandScale sem data é ignorada', () => {
      const bandScales: PopulatedBandScaleWithStatus[] = [
        { id: '1' } as any
      ];
      const summaries = buildHomeEventSummaries([], bandScales, undefined, today);
      expect(summaries.length).toBe(0);
    });

    it('3. data vazia é ignorada', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', date: '' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries.length).toBe(0);
    });

    it('4. data malformada é ignorada', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', date: '2026/10/10' } as any,
        { id: '2', date: 'outubro' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries.length).toBe(0);
    });

    it('5. 2026-02-30 é ignorada', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', date: '2026-02-30' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries.length).toBe(0);
    });

    it('6. data de hoje, fornecida como todayKey, permanece visível', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', date: '2026-10-10' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries.length).toBe(1);
    });

    it('7. evento anterior ao todayKey é ignorado', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', date: '2026-10-09' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries.length).toBe(0);
    });

    it('8. evento posterior permanece', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', date: '2026-10-11' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries.length).toBe(1);
    });

    it('9. vários eventos válidos continuam ordenados', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', date: '2026-10-12', time: '10:00' } as any,
        { id: '2', date: '2026-10-11', time: '11:00' } as any,
        { id: '3', date: '2026-10-11', time: '09:00' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries[0].id).toBe('3');
      expect(summaries[1].id).toBe('2');
      expect(summaries[2].id).toBe('1');
    });

    it('10. evento inválido não impede os demais', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', date: 'invalid' } as any,
        { id: '2', date: '2026-10-11' } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries.length).toBe(1);
      expect(summaries[0].id).toBe('2');
    });

    it('24. arrays não são modificados', () => {
      const original: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', date: '2026-10-11' } as any
      ];
      const copy = [...original];
      buildHomeEventSummaries(original, [], undefined, today);
      expect(original).toEqual(copy);
    });

    it('30. contagem da equipe para music scale considera bandScale vinculada', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { 
          id: '1', 
          date: '2026-10-12',
          bandScaleId: 'band1',
          eventAssignments: [{ userId: 'a' } as any] // Should be ignored in favor of band scale
        } as any
      ];
      const bandScales: PopulatedBandScaleWithStatus[] = [
        {
          id: 'band1',
          date: '2026-10-12',
          assignments: [
            { user: { uid: 'u1' } },
            { user: { uid: 'u2' } },
            { user: { uid: 'u2' } } // duplicate user
          ]
        } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, bandScales, undefined, today);
      expect(summaries[0].teamCount).toBe(2);
    });

    it('31. contagem da equipe para music scale sem bandScale usa eventAssignments', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { 
          id: '1', 
          date: '2026-10-12',
          eventAssignments: [{ userId: 'userA' }, { userId: 'userB' }, { userId: 'userB' }] as any
        } as any
      ];
      const summaries = buildHomeEventSummaries(musicScales, [], undefined, today);
      expect(summaries[0].teamCount).toBe(2);
    });
  });

  describe('selectMostRecentDraft', () => {
    it('14. lastModifiedAt tem prioridade sobre createdAt', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', status: 'draft', createdAt: 2000, lastModifiedAt: 3000 } as any,
        { id: '2', status: 'draft', createdAt: 4000, lastModifiedAt: 1000 } as any,
      ];
      const result = selectMostRecentDraft(musicScales, []);
      expect(result?.id).toBe('1');
    });

    it('15. updatedAt é usado quando lastModifiedAt não existe', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', status: 'draft', createdAt: 1000, updatedAt: 3000 } as any,
        { id: '2', status: 'draft', createdAt: 4000, updatedAt: 2000 } as any,
      ];
      const result = selectMostRecentDraft(musicScales, []);
      expect(result?.id).toBe('1');
    });

    it('16. createdAt é o fallback', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', status: 'draft', createdAt: 1000 } as any,
        { id: '2', status: 'draft', createdAt: 2000 } as any,
      ];
      const result = selectMostRecentDraft(musicScales, []);
      expect(result?.id).toBe('2');
    });

    it('17. Timestamp toMillis funciona', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', status: 'draft', createdAt: { toMillis: () => 3000 } } as any,
        { id: '2', status: 'draft', createdAt: { toMillis: () => 1000 } } as any,
      ];
      const result = selectMostRecentDraft(musicScales, []);
      expect(result?.id).toBe('1');
    });

    it('18. Timestamp toDate funciona', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', status: 'draft', createdAt: { toDate: () => new Date(3000) } } as any,
        { id: '2', status: 'draft', createdAt: { toDate: () => new Date(1000) } } as any,
      ];
      const result = selectMostRecentDraft(musicScales, []);
      expect(result?.id).toBe('1');
    });

    it('19. objeto seconds funciona', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', status: 'draft', createdAt: { seconds: 3 } } as any,
        { id: '2', status: 'draft', createdAt: { seconds: 1 } } as any,
      ];
      const result = selectMostRecentDraft(musicScales, []);
      expect(result?.id).toBe('1');
    });

    it('20. timestamp inválido retorna zero', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', status: 'draft', createdAt: 'invalid' } as any,
        { id: '2', status: 'draft', createdAt: 1000 } as any,
      ];
      const result = selectMostRecentDraft(musicScales, []);
      expect(result?.id).toBe('2');
    });

    it('21. função de timestamp que lança não derruba a Home', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', status: 'draft', createdAt: { toMillis: () => { throw new Error('Boom'); } } } as any,
        { id: '2', status: 'draft', createdAt: 1000 } as any,
      ];
      const result = selectMostRecentDraft(musicScales, []);
      expect(result?.id).toBe('2');
    });

    it('22. MusicScale vazia continua identificada como music no rascunho', () => {
      const musicScales: PopulatedScaleWithAssignmentsAndStatus[] = [
        { id: '1', status: 'draft', createdAt: 1000 } as any,
      ];
      const result = selectMostRecentDraft(musicScales, []);
      expect(result?.type).toBe('music');
    });

    it('23. BandScale continua identificada como band', () => {
      const bandScales: PopulatedBandScaleWithStatus[] = [
        { id: '1', status: 'draft', createdAt: 1000 } as any,
      ];
      const result = selectMostRecentDraft([], bandScales);
      expect(result?.type).toBe('band');
    });
  });

  describe('canUsePerformanceMode', () => {
    it('deve retornar verdadeiro se o evento for música, possuir músicas, status publicado, e o usuário tiver permissão', () => {
      const event = createEvent({ type: 'music', songCount: 5, status: 'published' });
      expect(canUsePerformanceMode(event, true)).toBe(true);
    });

    it('deve retornar verdadeiro para status prepared, e falso para draft, vazio ou desconhecido', () => {
      const preparedEventObj = createEvent({ type: 'music', songCount: 2, status: 'prepared' });
      expect(canUsePerformanceMode(preparedEventObj, true)).toBe(true);

      const draftEventObj = createEvent({ type: 'music', songCount: 3, status: 'draft' });
      expect(canUsePerformanceMode(draftEventObj, true)).toBe(false);

      const emptyEventObj = createEvent({ type: 'music', songCount: 3, status: '' });
      expect(canUsePerformanceMode(emptyEventObj, true)).toBe(false);

      const unknownEventObj = createEvent({ type: 'music', songCount: 3, status: 'unknown' });
      expect(canUsePerformanceMode(unknownEventObj, true)).toBe(false);
    });

    it('deve retornar falso se songCount for 0', () => {
      const event = createEvent({ type: 'music', songCount: 0, status: 'published' });
      expect(canUsePerformanceMode(event, true)).toBe(false);
    });

    it('deve retornar falso se type for band', () => {
      const event = createEvent({ type: 'band', songCount: 4, status: 'published' });
      expect(canUsePerformanceMode(event, true)).toBe(false);
    });

    it('deve retornar falso se o usuário não possuir permissão', () => {
      const event = createEvent({ type: 'music', songCount: 3, status: 'published' });
      expect(canUsePerformanceMode(event, false)).toBe(false);
    });

    it('deve retornar falso se status for cancelled', () => {
      const event = createEvent({ type: 'music', songCount: 3, status: 'cancelled' });
      expect(canUsePerformanceMode(event, true)).toBe(false);
    });
  });

  describe('Temporal Expiration and Promotion (Fase MS-DASHBOARD-EVENT-LIFECYCLE-01)', () => {
    const today = new Date('2026-08-02T12:00:00');
    const todayKey = '2026-08-02';
    
    const createMusicScale = (time: string | null, status: string = 'published', durationMinutes?: any, assignments: any = []): any => ({
      id: Math.random().toString(),
      date: todayKey,
      time,
      status,
      durationMinutes,
      eventAssignments: assignments
    });

    it('1. evento futuro no mesmo dia aparece', () => {
      const now = new Date('2026-08-02T09:00:00').getTime();
      const scale = createMusicScale('10:00');
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
      expect(events[0].eventTemporalState).toBe('upcoming');
    });

    it('2. evento exatamente no horário de início aparece como in-progress', () => {
      const now = new Date('2026-08-02T10:00:00').getTime();
      const scale = createMusicScale('10:00');
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
      expect(events[0].eventTemporalState).toBe('in-progress');
    });

    it('3. evento durante sua duração permanece', () => {
      const now = new Date('2026-08-02T11:00:00').getTime();
      const scale = createMusicScale('10:00'); // 120min duration by default => ends at 12:00
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
      expect(events[0].eventTemporalState).toBe('in-progress');
    });

    it('4. evento um minuto antes do fim permanece', () => {
      const now = new Date('2026-08-02T11:59:00').getTime();
      const scale = createMusicScale('10:00'); 
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
      expect(events[0].eventTemporalState).toBe('in-progress');
    });

    it('5. evento exatamente no fim desaparece', () => {
      const now = new Date('2026-08-02T12:00:00').getTime();
      const scale = createMusicScale('10:00'); 
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(0);
    });

    it('6. evento depois do fim desaparece', () => {
      const now = new Date('2026-08-02T13:00:00').getTime();
      const scale = createMusicScale('10:00'); 
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(0);
    });

    it('7. evento de 09:30 com 120 minutos desaparece às 11:30', () => {
      const now = new Date('2026-08-02T11:30:00').getTime();
      const scale = createMusicScale('09:30', 'published', 120); 
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(0);
    });

    it('8. evento encerrado não permanece por o usuário estar atribuído', () => {
      const now = new Date('2026-08-02T12:00:00').getTime();
      const scale = createMusicScale('09:00', 'published', 120, [{ userId: 'u1' }]); 
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(0);
    });

    it('9. evento seguinte do mesmo dia é promovido', () => {
      const now = new Date('2026-08-02T11:30:00').getTime();
      const scaleA = createMusicScale('09:30', 'published', 120); 
      const scaleB = createMusicScale('19:00', 'published', 120);
      const events = buildHomeEventSummaries([scaleA, scaleB], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
      expect(events[0].time).toBe('19:00');
    });

    it('10. evento do dia seguinte permanece', () => {
      const now = new Date('2026-08-02T11:30:00').getTime();
      const scale = createMusicScale('09:30', 'published', 120);
      scale.date = '2026-08-03';
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
    });

    it('11. durationMinutes ausente usa fallback canônico', () => {
      const now = new Date('2026-08-02T10:30:00').getTime();
      const scale = createMusicScale('09:30'); // No duration provided
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
      expect(events[0].durationMinutes).toBe(120); // 120 is canonical fallback
    });

    it('12. durationMinutes inválido usa fallback seguro', () => {
      const now = new Date('2026-08-02T10:30:00').getTime();
      const scale = createMusicScale('09:30', 'published', -50); 
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
      expect(events[0].durationMinutes).toBe(120); 
    });

    it('13. evento sem horário mantém pendência', () => {
      const now = new Date('2026-08-02T23:59:00').getTime(); // Late in the day
      const scale = createMusicScale(null); 
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
      expect(events[0].eventTemporalState).toBe('unscheduled');
    });

    it('14. evento completed não aparece', () => {
      const now = new Date('2026-08-02T09:00:00').getTime();
      const scale = createMusicScale('10:00', 'completed');
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(0);
    });

    it('15. evento cancelled não aparece', () => {
      const now = new Date('2026-08-02T09:00:00').getTime();
      const scale = createMusicScale('10:00', 'cancelled');
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(0);
    });

    it('16. evento draft não entra em upcomingEvents', () => {
      const now = new Date('2026-08-02T09:00:00').getTime();
      const scale = createMusicScale('10:00', 'draft');
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(0);
    });

    it('17. parsing local não muda o dia por UTC', () => {
      const now = new Date('2026-08-02T01:00:00').getTime();
      const scale = createMusicScale('02:00'); // Early morning
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      const startAt = new Date(events[0].startAtMillis as number);
      expect(startAt.getDate()).toBe(2);
      expect(startAt.getHours()).toBe(2);
    });

    it('18. virada de meia-noite', () => {
      const now = new Date('2026-08-02T23:59:00').getTime();
      const scale = createMusicScale('23:30', 'published', 120); 
      const events = buildHomeEventSummaries([scale], [], 'u1', todayKey, now);
      expect(events).toHaveLength(1);
      expect(events[0].eventTemporalState).toBe('in-progress');
    });

    it('19. horário 23:30 com duração atravessando o dia seguinte', () => {
      const now = new Date('2026-08-03T01:00:00').getTime();
      const scale = createMusicScale('23:30', 'published', 120); 
      scale.date = '2026-08-02';
      const events = buildHomeEventSummaries([scale], [], 'u1', '2026-08-03', now);
      expect(events).toHaveLength(1);
      expect(events[0].eventTemporalState).toBe('in-progress');
    });

    it('20. ordenação por início real', () => {
      const now = new Date('2026-08-02T09:00:00').getTime();
      const scaleA = createMusicScale('19:00'); 
      const scaleB = createMusicScale('10:00');
      const events = buildHomeEventSummaries([scaleA, scaleB], [], 'u1', todayKey, now);
      expect(events[0].time).toBe('10:00');
      expect(events[1].time).toBe('19:00');
    });
  });
});
