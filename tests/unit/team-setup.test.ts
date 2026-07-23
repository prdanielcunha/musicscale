import { describe, it, expect } from 'vitest';
import { evaluateTeamSetup, groupMinistryFunctions } from '../../utils/teamSetup';
import { UserProfile, Instrument } from '../../types';

describe('evaluateTeamSetup', () => {
  const currentUserId = 'user-owner';

  it('evaluates empty user list', () => {
    const result = evaluateTeamSetup([], currentUserId);
    expect(result.totalMembers).toBe(0);
    expect(result.additionalMembers).toBe(0);
    expect(result.configuredMembers).toBe(0);
    expect(result.isTeamConfigured).toBe(false);
  });

  it('excludes current user from additional members count', () => {
    const users: UserProfile[] = [
      { uid: 'user-owner', email: 'owner@test.com', roleId: 'role-owner', specialtyIds: ['inst-1'] } as UserProfile,
      { uid: 'user-2', email: 'user2@test.com', roleId: 'role-musician', specialtyIds: ['inst-2'] } as UserProfile,
    ];

    const result = evaluateTeamSetup(users, currentUserId);
    expect(result.totalMembers).toBe(2);
    expect(result.additionalMembers).toBe(1);
    expect(result.configuredMembers).toBe(1);
    expect(result.incompleteMemberIds).toHaveLength(0);
    expect(result.isTeamConfigured).toBe(true);
  });

  it('identifies incomplete members who lack access profile or ministry functions', () => {
    const users: UserProfile[] = [
      { uid: 'user-owner', email: 'owner@test.com', roleId: 'role-owner', specialtyIds: ['inst-1'] } as UserProfile,
      // Missing functions
      { uid: 'user-no-functions', email: 'nofunc@test.com', roleId: 'role-musician', specialtyIds: [] } as UserProfile,
      // Missing access profile
      { uid: 'user-no-access', email: 'noacc@test.com', roleId: '', specialtyIds: ['inst-1'] } as UserProfile,
    ];

    const result = evaluateTeamSetup(users, currentUserId);
    expect(result.additionalMembers).toBe(2);
    expect(result.membersWithAccessProfile).toBe(1);
    expect(result.membersWithMinistryFunctions).toBe(1);
    expect(result.configuredMembers).toBe(0);
    expect(result.incompleteMemberIds).toEqual(['user-no-functions', 'user-no-access']);
  });
});

describe('groupMinistryFunctions', () => {
  it('groups instruments correctly into ministers, vocals, and instruments', () => {
    const mockInstruments: Instrument[] = [
      { id: '1', name: 'Ministro de Louvor', category: 'Ministro' },
      { id: '2', name: 'Vocal Soprano', category: 'Voz' },
      { id: '3', name: 'Violão', category: 'Instrumento' },
      { id: '4', name: 'Bateria', category: 'Instrumento' },
    ];

    const grouped = groupMinistryFunctions(mockInstruments);
    expect(grouped.ministers).toHaveLength(1);
    expect(grouped.ministers[0].name).toBe('Ministro de Louvor');
    expect(grouped.vocals).toHaveLength(1);
    expect(grouped.instruments).toHaveLength(2);
    expect(grouped.instruments[0].name).toBe('Bateria'); // Sorted alphabetically
  });
});
