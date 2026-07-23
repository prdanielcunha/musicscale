import { describe, it, expect } from 'vitest';
import { 
  evaluateHomeExperience, 
  buildHomeEventSummaries, 
  selectMostRecentDraft,
  getLocalDateKey,
  HomeEventSummary,
  PopulatedScaleWithAssignmentsAndStatus,
  PopulatedBandScaleWithStatus
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
});
