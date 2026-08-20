import { describe, expect, it } from 'vitest';
import { evaluateFirstValueJourney, type FirstValueJourneyInput, type MinimalJourneyScale } from '../../utils/firstValueJourney';
import type { Song, UserProfile } from '../../types';

const song = {
  id: 'song-1',
  title: 'Song',
  artist: 'Artist',
  organizationId: 'org-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  status: 'active',
  lastPlayed: null,
  createdBy: { uid: 'u1', displayName: 'User', photoURL: null },
  originalKey: 'C',
  key: 'C',
  tagIds: [],
  lyrics: '',
  chords: '',
  chordsUrl: '',
  videoUrl: ''
} as Song;

const draft: MinimalJourneyScale = { id: 'draft-1', status: 'draft' };
const published: MinimalJourneyScale = { id: 'published-1', status: 'published' };

const currentUser = {
  uid: 'u1',
  displayName: 'Current',
  email: 'current@example.com',
  photoURL: null,
  roleId: 'role-1',
  organizationId: 'org-1',
  specialtyIds: [],
  createdAt: '2026-01-01T00:00:00.000Z'
} as UserProfile;

const configuredMember = {
  ...currentUser,
  uid: 'u2',
  email: 'member@example.com',
  specialtyIds: ['spec-1']
} as UserProfile;

const base: FirstValueJourneyInput = {
  songs: [song],
  scales: [draft],
  allUsers: [],
  canEditScales: true,
  canCreateSongs: true,
  canManageMembers: true,
  organizationId: 'org-1',
  loading: false,
  currentUserId: 'u1',
  teamDataStatus: 'ready'
};

describe('First Value Journey selective team readiness', () => {
  it('does not wait for users when repertoire is the next step', () => {
    const result = evaluateFirstValueJourney({ ...base, songs: [], scales: [], teamDataStatus: 'loading' });
    expect(result.isLoading).toBe(false);
    expect(result.currentEssentialStep).toBe('repertoire');
  });

  it('does not wait for users when firstScale is the next step', () => {
    const result = evaluateFirstValueJourney({ ...base, scales: [], teamDataStatus: 'loading' });
    expect(result.isLoading).toBe(false);
    expect(result.currentEssentialStep).toBe('firstScale');
  });

  it('does not wait for users when a published scale already completes the journey', () => {
    const result = evaluateFirstValueJourney({ ...base, scales: [published], teamDataStatus: 'loading' });
    expect(result.isLoading).toBe(false);
    expect(result.isCompleted).toBe(true);
    expect(result.currentEssentialStep).toBeNull();
  });

  it('does not wait for users when member management is unavailable', () => {
    const result = evaluateFirstValueJourney({ ...base, canManageMembers: false, teamDataStatus: 'loading' });
    expect(result.isLoading).toBe(false);
    expect(result.currentEssentialStep).toBe('publish');
    expect(result.teamState).toBe('unavailable');
  });

  it('waits only on the draft team-vs-publish decision', () => {
    const result = evaluateFirstValueJourney({ ...base, allUsers: [], teamDataStatus: 'loading' });
    expect(result.isLoading).toBe(true);
    expect(result.currentEssentialStep).toBeNull();
    expect(result.teamState).toBe('unavailable');
    expect(result.teamSetupSummary).toBeNull();
  });

  it('ready authoritative empty users resolves to team/empty', () => {
    const result = evaluateFirstValueJourney({ ...base, allUsers: [currentUser], teamDataStatus: 'ready' });
    expect(result.isLoading).toBe(false);
    expect(result.currentEssentialStep).toBe('team');
    expect(result.teamState).toBe('empty');
  });

  it('ready configured member resolves to publish/ready', () => {
    const result = evaluateFirstValueJourney({ ...base, allUsers: [currentUser, configuredMember], teamDataStatus: 'ready' });
    expect(result.isLoading).toBe(false);
    expect(result.currentEssentialStep).toBe('publish');
    expect(result.teamState).toBe('ready');
  });

  it('users error is non-blocking and never fabricates an empty team', () => {
    const result = evaluateFirstValueJourney({ ...base, allUsers: [], teamDataStatus: 'error' });
    expect(result.isLoading).toBe(false);
    expect(result.isEligible).toBe(false);
    expect(result.currentEssentialStep).toBeNull();
    expect(result.teamState).toBe('unavailable');
    expect(result.teamSetupSummary).toBeNull();
  });

  it('keeps legacy pure callers backward compatible by defaulting team data to ready', () => {
    const { teamDataStatus: _ignored, ...legacyInput } = base;
    const result = evaluateFirstValueJourney({ ...legacyInput, allUsers: [currentUser] });
    expect(result.currentEssentialStep).toBe('team');
    expect(result.teamState).toBe('empty');
  });
});
