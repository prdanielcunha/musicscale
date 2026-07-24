import { describe, it, expect } from 'vitest';
import { evaluateTeamSetup } from '../../utils/teamSetup';
import { UserProfile } from '../../types';

function createProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: "user-id",
    email: "user@example.com",
    displayName: "User Name",
    photoURL: null,
    roleId: "",
    ...overrides
  };
}

describe('evaluateTeamSetup', () => {
  it('1. array vazio', () => {
    const result = evaluateTeamSetup([], 'current');
    expect(result.totalMembers).toBe(0);
    expect(result.additionalMembers).toBe(0);
  });

  it('2. somente usuário atual', () => {
    const result = evaluateTeamSetup([createProfile({ uid: 'current' })], 'current');
    expect(result.totalMembers).toBe(1);
    expect(result.additionalMembers).toBe(0);
  });

  it('3. usuário atual não conta como adicional', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'current' }),
      createProfile({ uid: 'other' })
    ], 'current');
    expect(result.additionalMembers).toBe(1);
  });

  it('4. integrante com roleId e specialtyIds é configurado', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', roleId: 'admin', specialtyIds: ['guitar'] })
    ], 'current');
    expect(result.memberStatuses[0].isConfigured).toBe(true);
  });

  it('5. integrante com musicscaleRole e specialtyIds é configurado', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', musicscaleRole: 'musician', specialtyIds: ['vocals'] })
    ], 'current');
    expect(result.memberStatuses[0].isConfigured).toBe(true);
  });

  it('6. organizationRole sozinho não configura acesso', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', organizationRole: 'admin', specialtyIds: ['vocals'] })
    ], 'current');
    expect(result.memberStatuses[0].hasAccessProfile).toBe(false);
    expect(result.memberStatuses[0].isConfigured).toBe(false);
  });

  it('7. systemRole sozinho não configura acesso', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', systemRole: 'admin', specialtyIds: ['vocals'] })
    ], 'current');
    expect(result.memberStatuses[0].hasAccessProfile).toBe(false);
  });

  it('8. role legado sozinho não configura acesso', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', role: 'admin', specialtyIds: ['vocals'] })
    ], 'current');
    expect(result.memberStatuses[0].hasAccessProfile).toBe(false);
  });

  it('9. roleId vazio não configura acesso', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', roleId: '', specialtyIds: ['vocals'] })
    ], 'current');
    expect(result.memberStatuses[0].hasAccessProfile).toBe(false);
  });

  it('10. musicscaleRole com espaços não configura acesso', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', musicscaleRole: '   ', specialtyIds: ['vocals'] })
    ], 'current');
    expect(result.memberStatuses[0].hasAccessProfile).toBe(false);
  });

  it('11. specialtyIds vazio não configura funções', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', roleId: 'admin', specialtyIds: [] })
    ], 'current');
    expect(result.memberStatuses[0].hasMinistryFunctions).toBe(false);
  });

  it('12. specialtyIds apenas com espaços não configura funções', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', roleId: 'admin', specialtyIds: ['   '] })
    ], 'current');
    expect(result.memberStatuses[0].hasMinistryFunctions).toBe(false);
  });

  it('13. IDs ministeriais duplicados não alteram a conclusão', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', roleId: 'admin', specialtyIds: ['vocals', 'vocals'] })
    ], 'current');
    expect(result.memberStatuses[0].hasMinistryFunctions).toBe(true);
  });

  it('14. integrante somente com acesso é incompleto', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', roleId: 'admin' })
    ], 'current');
    expect(result.memberStatuses[0].isConfigured).toBe(false);
  });

  it('15. integrante somente com função é incompleto', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other', specialtyIds: ['vocals'] })
    ], 'current');
    expect(result.memberStatuses[0].isConfigured).toBe(false);
  });

  it('16. integrante sem acesso e sem função é incompleto', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'other' })
    ], 'current');
    expect(result.memberStatuses[0].isConfigured).toBe(false);
  });

  it('17. duas pessoas configuradas são contadas corretamente', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'a', roleId: 'admin', specialtyIds: ['v'] }),
      createProfile({ uid: 'b', roleId: 'leader', specialtyIds: ['g'] })
    ], 'current');
    expect(result.configuredMembers).toBe(2);
  });

  it('18. incompleteMemberIds preserva a ordem', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'b' }),
      createProfile({ uid: 'a' })
    ], 'current');
    expect(result.incompleteMemberIds).toEqual(['b', 'a']);
  });

  it('19. memberStatuses preserva a ordem', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'b' }),
      createProfile({ uid: 'a' })
    ], 'current');
    expect(result.memberStatuses.map(s => s.userId)).toEqual(['b', 'a']);
  });

  it('20. UID vazio é ignorado', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: '  ' }),
      createProfile({ uid: '' })
    ], 'current');
    expect(result.totalMembers).toBe(0);
  });

  it('21. UID repetido não é contado duas vezes', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'a', roleId: 'admin' }),
      createProfile({ uid: 'a', roleId: 'leader', specialtyIds: ['g'] })
    ], 'current');
    expect(result.totalMembers).toBe(1);
    expect(result.memberStatuses[0].hasMinistryFunctions).toBe(false);
  });

  it('22. usuário atual não aparece em incompleteMemberIds', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'current' })
    ], 'current');
    expect(result.incompleteMemberIds).toEqual([]);
  });

  it('23. sem currentUserId, todos contam como adicionais', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'current' })
    ]);
    expect(result.additionalMembers).toBe(1);
  });

  it('24. isTeamConfigured exige ao menos um adicional configurado', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'a' })
    ], 'current');
    expect(result.isTeamConfigured).toBe(false);
  });

  it('25. integrante configurado e outro incompleto mantém isTeamConfigured verdadeiro', () => {
    const result = evaluateTeamSetup([
      createProfile({ uid: 'a', roleId: 'admin', specialtyIds: ['v'] }),
      createProfile({ uid: 'b' })
    ], 'current');
    expect(result.isTeamConfigured).toBe(true);
  });

  it('26. array recebido não é modificado', () => {
    const arr = [createProfile({ uid: 'a' })];
    const copy = [...arr];
    evaluateTeamSetup(arr, 'current');
    expect(arr).toEqual(copy);
  });

  it('27. objetos recebidos não são modificados', () => {
    const obj = createProfile({ uid: 'a' });
    const copy = { ...obj };
    evaluateTeamSetup([obj], 'current');
    expect(obj).toEqual(copy);
  });
});
