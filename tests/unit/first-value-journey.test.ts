import { describe, it, expect } from 'vitest';
import { evaluateFirstValueJourney, FirstValueJourneyInput, MinimalJourneyScale } from '../../utils/firstValueJourney';
import type { Song, UserProfile } from '../../types';

describe('evaluateFirstValueJourney', () => {
  const baseInput: FirstValueJourneyInput = {
    songs: [],
    scales: [],
    allUsers: [],
    canEditScales: true,
    canCreateSongs: true,
    canManageMembers: true,
    organizationId: 'org1',
    loading: false,
    currentUserId: 'u1'
  };

  it('loading não ativa jornada', () => {
    const res = evaluateFirstValueJourney({ ...baseInput, loading: true });
    expect(res.isEligible).toBe(false);
  });

  it('ausência de organização não ativa jornada', () => {
    const res = evaluateFirstValueJourney({ ...baseInput, organizationId: undefined });
    expect(res.isEligible).toBe(false);
  });

  it('sem scales.manage não ativa jornada', () => {
    const res = evaluateFirstValueJourney({ ...baseInput, canEditScales: false });
    expect(res.isEligible).toBe(false);
  });

  it('sem songs.edit não ativa jornada', () => {
    const res = evaluateFirstValueJourney({ ...baseInput, canCreateSongs: false });
    expect(res.isEligible).toBe(false);
  });

  it('sem músicas retorna repertoire', () => {
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [] });
    expect(res.currentEssentialStep).toBe('repertoire');
  });

  it('com músicas e sem escala retorna firstScale', () => {
    const song = { id: 's1' } as Song;
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [] });
    expect(res.currentEssentialStep).toBe('firstScale');
  });

  it('somente usuário atual retorna team/empty', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('team');
    expect(res.teamState).toBe('empty');
  });

  it('adicional sem acesso retorna incomplete', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const user2 = { uid: 'u2' } as unknown as UserProfile; // no access
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('team');
    expect(res.teamState).toBe('incomplete');
  });

  it('adicional sem função retorna incomplete', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const user2 = { uid: 'u2', hasAppAccess: true } as unknown as UserProfile; // no specialty
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('team');
    expect(res.teamState).toBe('incomplete');
  });

  it('adicional completo retorna publish/ready', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const user2 = { uid: 'u2', roleId: 'r2', hasAppAccess: true, specialtyIds: ['spec1'] } as unknown as UserProfile;
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('publish');
    expect(res.teamState).toBe('ready');
  });

  it('um completo e um incompleto retorna publish e mantém pendência', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const user2 = { uid: 'u2', roleId: 'r2', hasAppAccess: true, specialtyIds: ['spec1'] } as unknown as UserProfile;
    const user3 = { uid: 'u3', hasAppAccess: false } as unknown as UserProfile;
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2, user3], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('publish');
    expect(res.teamSetupSummary?.incompleteMemberIds).toContain('u3');
  });

  it('sem members.manage retorna publish/unavailable', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user], currentUserId: 'u1', canManageMembers: false });
    expect(res.currentEssentialStep).toBe('publish');
    expect(res.teamState).toBe('unavailable');
  });

  it('milestone Team é optional sem permissão', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user], currentUserId: 'u1', canManageMembers: false });
    const teamMilestone = res.milestones.find(m => m.id === 'team');
    expect(teamMilestone?.status).toBe('optional');
  });

  it('milestone Publicação é current sem permissão', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user], currentUserId: 'u1', canManageMembers: false });
    const pubMilestone = res.milestones.find(m => m.id === 'publish');
    expect(pubMilestone?.status).toBe('current');
  });

  it('escala publicada conclui jornada', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'published' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale] });
    expect(res.isCompleted).toBe(true);
    expect(res.currentEssentialStep).toBeNull();
  });

  it('escala cancelada não conclui', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'cancelled' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale] });
    expect(res.isCompleted).toBe(false);
    expect(res.currentEssentialStep).toBe('firstScale');
  });

  it('rascunho mais recente por lastModifiedAt', () => {
    // Actually, current implementation uses updatedAt or createdAt or date.
    // Let's test the fallback logic there.
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: 1000 };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', createdAt: 2000 };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc2');
  });

  it('fallback para updatedAt', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', updatedAt: 3000 };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', createdAt: 2000 };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('fallback para createdAt', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: new Date('2026-01-02T00:00:00Z').getTime() };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', date: '2026-01-01' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('Date é suportada', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: new Date('2026-01-02T00:00:00Z') };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', createdAt: new Date('2026-01-01T00:00:00Z') };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('Firestore toMillis é suportado', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: { toMillis: () => 5000 } };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', createdAt: { toMillis: () => 3000 } };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('Firestore toDate é suportado', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: { toDate: () => new Date(6000) } };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', createdAt: { toDate: () => new Date(4000) } };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('seconds é suportado', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: { seconds: 10 } };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', createdAt: { seconds: 5 } };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('string válida é suportada', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: '2026-02-01T00:00:00Z' };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', createdAt: '2026-01-01T00:00:00Z' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('timestamp inválido não quebra', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: 'invalid-date' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('função toMillis que lança não quebra', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: { toMillis: () => { throw new Error('ops'); } } };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('função toDate que lança não quebra', () => {
    const song = { id: 's1' } as Song;
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: { toDate: () => { throw new Error('ops'); } } };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('array de escalas não é modificado', () => {
    const song = { id: 's1' } as Song;
    const scales: MinimalJourneyScale[] = [{ id: 'sc1', status: 'draft', createdAt: 1000 }, { id: 'sc2', status: 'draft', createdAt: 2000 }];
    const scalesCopy = [...scales];
    evaluateFirstValueJourney({ ...baseInput, songs: [song], scales });
    expect(scales).toEqual(scalesCopy);
  });

  it('array de usuários não é modificado', () => {
    const users: UserProfile[] = [{ uid: 'u1', roleId: 'r1' } as unknown as UserProfile];
    const usersCopy = [...users];
    evaluateFirstValueJourney({ ...baseInput, allUsers: users });
    expect(users).toEqual(usersCopy);
  });

  it('UIDs duplicados não duplicam contagem', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const user2 = { uid: 'u2', roleId: 'r2', hasAppAccess: true, specialtyIds: ['spec1'] } as unknown as UserProfile;
    const user3 = { uid: 'u2', roleId: 'r2', hasAppAccess: true, specialtyIds: ['spec1'] } as unknown as UserProfile; // Duplicado
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2, user3], currentUserId: 'u1' });
    // evaluateTeamSetup actually uses Map by uid, so duplicates are ignored.
    expect(res.teamSetupSummary?.additionalMembers).toBe(1);
    expect(res.teamSetupSummary?.configuredMembers).toBe(1);
  });

  it('usuário atual não conta como adicional', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = { uid: 'u1', roleId: 'r1' } as unknown as UserProfile;
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user], currentUserId: 'u1' });
    expect(res.teamSetupSummary?.additionalMembers).toBe(0);
  });

  it('totalEssentialSteps é 4', () => {
    const res = evaluateFirstValueJourney(baseInput);
    expect(res.totalEssentialSteps).toBe(4);
  });

  it('existem quatro milestones', () => {
    const res = evaluateFirstValueJourney(baseInput);
    expect(res.milestones.length).toBe(4);
  });

  it('milestones estão na ordem correta', () => {
    const res = evaluateFirstValueJourney(baseInput);
    expect(res.milestones.map(m => m.id)).toEqual(['repertoire', 'firstScale', 'team', 'publish']);
  });

  it('Team não fica current para usuário sem permissão', () => {
    const song = { id: 's1' } as Song;
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], canManageMembers: false });
    const teamMilestone = res.milestones.find(m => m.id === 'team');
    expect(teamMilestone?.status).not.toBe('current');
    expect(teamMilestone?.status).toBe('optional');
  });

});
