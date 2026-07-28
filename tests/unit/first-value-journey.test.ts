import { describe, it, expect } from 'vitest';
import { evaluateFirstValueJourney, FirstValueJourneyInput, MinimalJourneyScale, getJourneyTimestampValue } from '../../utils/firstValueJourney';
import type { Song, UserProfile } from '../../types';

function createSong(overrides: Partial<Song> = {}): Song {
  return {
    id: "s1",
    title: "Title",
    artist: "Artist",
    createdAt: "2026-01-01T00:00:00Z",
    status: "active",
    lastPlayed: null,
    
    createdBy: { uid: "u1", displayName: "User", photoURL: null },
    organizationId: "org1",
    
    originalKey: "C",
    key: "C",
    tagIds: [], lyrics: "", chords: "", chordsUrl: "", videoUrl: "",
    ...overrides
  };
}

function createUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: "u1",
    displayName: "User",
    email: "u1@example.com",
    photoURL: null,
    roleId: "r1",
    organizationId: "org1",
    
    specialtyIds: [],
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides
  };
}

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
    const song = createSong();
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [] });
    expect(res.currentEssentialStep).toBe('firstScale');
  });

  it('somente usuário atual retorna team/empty', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('team');
    expect(res.teamState).toBe('empty');
  });

  it('adicional sem acesso retorna incomplete', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
    const user2 = createUserProfile({ uid: 'u2' }); // no access
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('team');
    expect(res.teamState).toBe('incomplete');
  });

  it('adicional sem função retorna incomplete', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
    const user2 = createUserProfile({ uid: 'u2' }); // no specialty
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('team');
    expect(res.teamState).toBe('incomplete');
  });

  it('adicional completo retorna publish/ready', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
    const user2 = createUserProfile({ uid: 'u2', specialtyIds: ['spec1'] });
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('publish');
    expect(res.teamState).toBe('ready');
  });

  it('um completo e um incompleto retorna publish e mantém pendência', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
    const user2 = createUserProfile({ uid: 'u2', specialtyIds: ['spec1'] });
    const user3 = createUserProfile({ uid: 'u3' });
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2, user3], currentUserId: 'u1' });
    expect(res.currentEssentialStep).toBe('publish');
    expect(res.teamSetupSummary?.incompleteMemberIds).toContain('u3');
  });

  it('sem members.manage retorna publish/unavailable', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user], currentUserId: 'u1', canManageMembers: false });
    expect(res.currentEssentialStep).toBe('publish');
    expect(res.teamState).toBe('unavailable');
  });

  it('milestone Team é optional sem permissão', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user], currentUserId: 'u1', canManageMembers: false });
    const teamMilestone = res.milestones.find(m => m.id === 'team');
    expect(teamMilestone?.status).toBe('optional');
  });

  it('milestone Publicação é current sem permissão', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user], currentUserId: 'u1', canManageMembers: false });
    const pubMilestone = res.milestones.find(m => m.id === 'publish');
    expect(pubMilestone?.status).toBe('current');
  });

  it('escala publicada conclui jornada', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'published' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale] });
    expect(res.isCompleted).toBe(true);
    expect(res.currentEssentialStep).toBeNull();
  });

  it('escala cancelada não conclui', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'cancelled' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale] });
    expect(res.isCompleted).toBe(false);
    expect(res.currentEssentialStep).toBe('firstScale');
  });

  it('rascunho mais recente por lastModifiedAt', () => {
    const song = createSong();
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', lastModifiedAt: 1000 };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', lastModifiedAt: 2000, updatedAt: 5000 };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc2');
  });

  it('prova discriminatoria lastModifiedAt prioridade absoluta sobre createdAt e updatedAt', () => {
    const song = createSong();
    const scaleA: MinimalJourneyScale = { id: 'scaleA', status: 'draft', lastModifiedAt: 5000, createdAt: 1000, updatedAt: 1000 };
    const scaleB: MinimalJourneyScale = { id: 'scaleB', status: 'draft', lastModifiedAt: 2000, createdAt: 9000, updatedAt: 9000 };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scaleA, scaleB] });
    expect(res.draftScale?.id).toBe('scaleA');
  });

  it('fallback para updatedAt', () => {
    const song = createSong();
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', updatedAt: 3000 };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', createdAt: 2000 };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('fallback para createdAt', () => {
    const song = createSong();
    const scale1: MinimalJourneyScale = { id: 'sc1', status: 'draft', createdAt: new Date('2026-01-02T00:00:00Z').getTime() };
    const scale2: MinimalJourneyScale = { id: 'sc2', status: 'draft', date: '2026-01-01' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale1, scale2] });
    expect(res.draftScale?.id).toBe('sc1');
  });

  it('Date válida é suportada', () => {
    const ts = getJourneyTimestampValue(new Date('2026-01-02T00:00:00Z'));
    expect(ts).toBeGreaterThan(0);
  });

  it('Date inválida retorna 0', () => {
    const ts = getJourneyTimestampValue(new Date('invalid'));
    expect(ts).toBe(0);
  });

  it('number infinito retorna 0', () => {
    const ts = getJourneyTimestampValue(Infinity);
    expect(ts).toBe(0);
  });

  it('Firestore toMillis válido é suportado', () => {
    const ts = getJourneyTimestampValue({ toMillis: () => 5000 });
    expect(ts).toBe(5000);
  });
  
  it('toMillis que retorna NaN resulta 0', () => {
    const ts = getJourneyTimestampValue({ toMillis: () => NaN });
    expect(ts).toBe(0);
  });

  it('Firestore toDate válido é suportado', () => {
    const ts = getJourneyTimestampValue({ toDate: () => new Date(6000) });
    expect(ts).toBe(6000);
  });

  it('toDate que retorna Date inválida resulta 0', () => {
    const ts = getJourneyTimestampValue({ toDate: () => new Date('invalid') });
    expect(ts).toBe(0);
  });

  it('toDate que lança resulta 0', () => {
    const ts = getJourneyTimestampValue({ toDate: () => { throw new Error(); } });
    expect(ts).toBe(0);
  });

  it('seconds válido é suportado', () => {
    const ts = getJourneyTimestampValue({ seconds: 10 });
    expect(ts).toBe(10000);
  });
  
  it('seconds infinito resulta 0', () => {
    const ts = getJourneyTimestampValue({ seconds: Infinity });
    expect(ts).toBe(0);
  });

  it('string válida é suportada', () => {
    const ts = getJourneyTimestampValue('2026-02-01T00:00:00Z');
    expect(ts).toBeGreaterThan(0);
  });

  it('string inválida resulta 0', () => {
    const ts = getJourneyTimestampValue('invalid-date');
    expect(ts).toBe(0);
  });

  it('função toMillis que lança não quebra', () => {
    const ts = getJourneyTimestampValue({ toMillis: () => { throw new Error('ops'); } });
    expect(ts).toBe(0);
  });

  it('array de escalas não é modificado', () => {
    const song = createSong();
    const scales: MinimalJourneyScale[] = [{ id: 'sc1', status: 'draft', createdAt: 1000 }, { id: 'sc2', status: 'draft', createdAt: 2000 }];
    const scalesCopy = [...scales];
    evaluateFirstValueJourney({ ...baseInput, songs: [song], scales });
    expect(scales).toEqual(scalesCopy);
  });

  it('array de usuários não é modificado', () => {
    const users: UserProfile[] = [createUserProfile({ uid: 'u1' })];
    const usersCopy = [...users];
    evaluateFirstValueJourney({ ...baseInput, allUsers: users });
    expect(users).toEqual(usersCopy);
  });

  it('UIDs duplicados não duplicam contagem', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
    const user2 = createUserProfile({ uid: 'u2', specialtyIds: ['spec1'] });
    const user3 = createUserProfile({ uid: 'u2', specialtyIds: ['spec1'] }); // Duplicado
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], allUsers: [user, user2, user3], currentUserId: 'u1' });
    expect(res.teamSetupSummary?.additionalMembers).toBe(1);
    expect(res.teamSetupSummary?.configuredMembers).toBe(1);
  });

  it('usuário atual não conta como adicional', () => {
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const user = createUserProfile({ uid: 'u1' });
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
    const song = createSong();
    const scale: MinimalJourneyScale = { id: 'sc1', status: 'draft' };
    const res = evaluateFirstValueJourney({ ...baseInput, songs: [song], scales: [scale], canManageMembers: false });
    const teamMilestone = res.milestones.find(m => m.id === 'team');
    expect(teamMilestone?.status).not.toBe('current');
    expect(teamMilestone?.status).toBe('optional');
  });

});
