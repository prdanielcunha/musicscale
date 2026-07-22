import { describe, it, expect } from 'vitest';
import { evaluateHomeExperience, HomeEventSummary } from '../../utils/homeExperience';

describe('evaluateHomeExperience', () => {
  const defaultInput = {
    isFirstValueJourneyActive: false,
    canManageScales: false,
    upcomingEvents: [],
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

  it('3. líder escalado também recebe assigned-event e mantém pendências administrativas', () => {
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

  it('5. evento sem repertório recebe missing-repertoire', () => {
    const result = evaluateHomeExperience({
      ...defaultInput,
      canManageScales: true,
      upcomingEvents: [createEvent({ songCount: 0, teamCount: 1, time: '10:00', locationName: 'Loc' })],
    });
    expect(result.mode).toBe('leader-attention');
    expect(result.attentionItems.some(i => i.code === 'missing-repertoire')).toBe(true);
  });

  it('6. evento sem equipe recebe missing-team', () => {
    const result = evaluateHomeExperience({
      ...defaultInput,
      canManageScales: true,
      upcomingEvents: [createEvent({ songCount: 1, teamCount: 0, time: '10:00', locationName: 'Loc' })],
    });
    expect(result.mode).toBe('leader-attention');
    expect(result.attentionItems.some(i => i.code === 'missing-team')).toBe(true);
  });

  it('7. evento sem horário recebe missing-time', () => {
    const result = evaluateHomeExperience({
      ...defaultInput,
      canManageScales: true,
      upcomingEvents: [createEvent({ songCount: 1, teamCount: 1, locationName: 'Loc' })],
    });
    expect(result.mode).toBe('leader-attention');
    expect(result.attentionItems.some(i => i.code === 'missing-time')).toBe(true);
  });

  it('8. evento sem local recebe missing-location', () => {
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

  it('17. a função não modifica arrays de entrada', () => {
    const originalEvents = [createEvent({})];
    const eventsRef = [...originalEvents];
    evaluateHomeExperience({
      ...defaultInput,
      upcomingEvents: originalEvents,
    });
    expect(originalEvents).toEqual(eventsRef);
  });
});
