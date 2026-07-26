import { describe, it, expect } from 'vitest';
import { 
  isTeamMemberDraftDirty,
  buildExistingMemberSetupItems, 
  groupTeamFunctions, 
  normalizeSpecialtyIds 
} from '../../utils/teamMemberSetup';
import { UserProfile, Instrument } from '../../types';

const createMockUser = (partial: Partial<UserProfile>): UserProfile => ({ uid: 'mock_uid', email: null, displayName: null, photoURL: null, roleId: '', ...partial });

describe('teamMemberSetup', () => {
  
  describe('isTeamMemberDraftDirty', () => {
    it('1. dois drafts nulos;', () => {
      expect(isTeamMemberDraftDirty(null, null)).toBe(false);
    });
    
    it('2. initial nulo e current existente;', () => {
      expect(isTeamMemberDraftDirty(null, { userId: 'u1', roleId: 'r1', specialtyIds: [] })).toBe(true);
    });

    it('3. initial existente e current nulo;', () => {
      expect(isTeamMemberDraftDirty({ userId: 'u1', roleId: 'r1', specialtyIds: [] }, null)).toBe(true);
    });

    it('4. seleção sem alteração;', () => {
      const draft = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1'] };
      expect(isTeamMemberDraftDirty(draft, draft)).toBe(false);
      expect(isTeamMemberDraftDirty(draft, { ...draft })).toBe(false);
    });

    it('5. papel alterado;', () => {
      const draft1 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1'] };
      const draft2 = { userId: 'u1', roleId: 'r2', specialtyIds: ['i1'] };
      expect(isTeamMemberDraftDirty(draft1, draft2)).toBe(true);
    });

    it('6. função adicionada;', () => {
      const draft1 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1'] };
      const draft2 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1', 'i2'] };
      expect(isTeamMemberDraftDirty(draft1, draft2)).toBe(true);
    });

    it('7. função removida;', () => {
      const draft1 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1', 'i2'] };
      const draft2 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1'] };
      expect(isTeamMemberDraftDirty(draft1, draft2)).toBe(true);
    });

    it('8. ordem diferente equivalente;', () => {
      const draft1 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1', 'i2'] };
      const draft2 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i2', 'i1'] };
      expect(isTeamMemberDraftDirty(draft1, draft2)).toBe(false);
    });

    it('9. espaços equivalentes;', () => {
      const draft1 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1 '] };
      const draft2 = { userId: 'u1', roleId: 'r1', specialtyIds: [' i1'] };
      expect(isTeamMemberDraftDirty(draft1, draft2)).toBe(false);
    });

    it('10. duplicidades equivalentes;', () => {
      const draft1 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1', 'i1'] };
      const draft2 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1'] };
      expect(isTeamMemberDraftDirty(draft1, draft2)).toBe(false);
    });

    it('11. retorno ao valor original;', () => {
      const draft1 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1'] };
      const draft2 = { userId: 'u1', roleId: 'r2', specialtyIds: ['i1'] }; // Changed
      expect(isTeamMemberDraftDirty(draft1, draft2)).toBe(true);
      const draft3 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1'] }; // Returned to original
      expect(isTeamMemberDraftDirty(draft1, draft3)).toBe(false);
    });

    it('12. objetos não modificados;', () => {
      const draft1 = { userId: 'u1', roleId: 'r1', specialtyIds: ['i1'] };
      const res = isTeamMemberDraftDirty(draft1, draft1);
      expect(draft1).toEqual({ userId: 'u1', roleId: 'r1', specialtyIds: ['i1'] });
      expect(res).toBe(false);
    });
  });

  describe('buildExistingMemberSetupItems', () => {
    it('1. lista vazia;', () => {
      const items = buildExistingMemberSetupItems([]);
      expect(items).toEqual([]);
    });

    it('2. UID vazio ignorado;', () => {
      const items = buildExistingMemberSetupItems([
        createMockUser({ uid: '' }),
        createMockUser({ uid: '   ' }),
      ]);
      expect(items).toEqual([]);
    });

    it('3. duplicidade preserva primeira ocorrência;', () => {
      const users: readonly UserProfile[] = [
        createMockUser({ uid: 'user1', email: 'first@test.com' }),
        createMockUser({ uid: 'user1', email: 'second@test.com' }),
      ];
      const result = buildExistingMemberSetupItems(users);
      expect(result.length).toBe(1);
      expect(result[0].user.email).toBe('first@test.com');
    });

    it('4. usuário atual é marcado;', () => {
      const users: readonly UserProfile[] = [
        createMockUser({ uid: 'user1' }),
      ];
      const result = buildExistingMemberSetupItems(users, 'user1');
      expect(result[0].isCurrentUser).toBe(true);
    });

    it('5. incompletos precedem completos;', () => {
      const users: readonly UserProfile[] = [
        createMockUser({ uid: 'comp1', roleId: 'r', specialtyIds: ['s'] }),
        createMockUser({ uid: 'incomp1' }),
      ];
      const result = buildExistingMemberSetupItems(users);
      expect(result[0].user.uid).toBe('incomp1');
      expect(result[1].user.uid).toBe('comp1');
    });

    it('6. ordem original é preservada dentro dos grupos;', () => {
      const users: readonly UserProfile[] = [
        createMockUser({ uid: 'incomp1', email: '1' }),
        createMockUser({ uid: 'incomp2', email: '2' }),
        createMockUser({ uid: 'comp1', email: '3', roleId: 'r', specialtyIds: ['s'] }),
        createMockUser({ uid: 'comp2', email: '4', roleId: 'r', specialtyIds: ['s'] }),
      ];
      const result = buildExistingMemberSetupItems(users);
      expect(result.map(r => r.user.uid)).toEqual(['incomp1', 'incomp2', 'comp1', 'comp2']);
    });

    it('7. usuário atual incompleto vem depois dos adicionais incompletos;', () => {
      const users: readonly UserProfile[] = [
        createMockUser({ uid: 'current' }),
        createMockUser({ uid: 'add1' }),
      ];
      const result = buildExistingMemberSetupItems(users, 'current');
      expect(result[0].user.uid).toBe('add1');
      expect(result[1].user.uid).toBe('current');
    });

    it('8. usuário atual completo vem depois dos adicionais completos;', () => {
      const users: readonly UserProfile[] = [
        createMockUser({ uid: 'current', roleId: 'r', specialtyIds: ['s'] }),
        createMockUser({ uid: 'add1', roleId: 'r', specialtyIds: ['s'] }),
      ];
      const result = buildExistingMemberSetupItems(users, 'current');
      expect(result[0].user.uid).toBe('add1');
      expect(result[1].user.uid).toBe('current');
    });

    it('9. avaliação reutiliza estados compatíveis com evaluateTeamSetup;', () => {
      const users: readonly UserProfile[] = [
        createMockUser({ uid: 'u1', roleId: 'r', specialtyIds: ['s'] }),
      ];
      const result = buildExistingMemberSetupItems(users);
      expect(result[0].hasAccessProfile).toBe(true);
      expect(result[0].hasMinistryFunctions).toBe(true);
      expect(result[0].isConfigured).toBe(true);
    });

    it('10. organizationRole não cria acesso;', () => {
      const users: readonly UserProfile[] = [
        createMockUser({ uid: 'u1', organizationRole: 'admin', specialtyIds: ['s'] }),
      ];
      const result = buildExistingMemberSetupItems(users);
      expect(result[0].hasAccessProfile).toBe(false);
      expect(result[0].isConfigured).toBe(false);
    });

    it('11. specialtyIds determina função;', () => {
      const users: readonly UserProfile[] = [
        createMockUser({ uid: 'u1', roleId: 'r' }),
        createMockUser({ uid: 'u2', roleId: 'r', specialtyIds: [] }),
        createMockUser({ uid: 'u3', roleId: 'r', specialtyIds: ['s'] }),
      ];
      const result = buildExistingMemberSetupItems(users);
      const u1 = result.find(r => r.user.uid === 'u1')!;
      const u2 = result.find(r => r.user.uid === 'u2')!;
      const u3 = result.find(r => r.user.uid === 'u3')!;
      
      expect(u1.hasMinistryFunctions).toBe(false);
      expect(u2.hasMinistryFunctions).toBe(false);
      expect(u3.hasMinistryFunctions).toBe(true);
    });

    it('21. arrays recebidos não são modificados;', () => {
      const users: readonly UserProfile[] = [createMockUser({ uid: '1' })];
      const original = [...users];
      buildExistingMemberSetupItems(users);
      expect(users).toEqual(original);
    });

    it('22. objetos recebidos não são modificados.', () => {
      const user = createMockUser({ uid: '1', roleId: 'r' });
      const original = { ...user };
      buildExistingMemberSetupItems([user]);
      expect(user).toEqual(original);
    });
  });

  describe('groupTeamFunctions', () => {
    it('12. categorias são agrupadas;', () => {
      const instruments: readonly Instrument[] = [
        { id: '1', name: 'Z', category: 'Ministro' } ,
        { id: '2', name: 'A', category: 'Voz' } ,
        { id: '3', name: 'B', category: 'Instrumento' } ,
      ];
      const result = groupTeamFunctions(instruments);
      expect(result.ministers.length).toBe(1);
      expect(result.vocals.length).toBe(1);
      expect(result.instruments.length).toBe(1);
    });

    it('13. grupos são ordenados alfabeticamente;', () => {
      const instruments: readonly Instrument[] = [
        { id: '2', name: 'B', category: 'Voz' } ,
        { id: '1', name: 'A', category: 'Voz' } ,
      ];
      const result = groupTeamFunctions(instruments);
      expect(result.vocals[0].name).toBe('A');
      expect(result.vocals[1].name).toBe('B');
    });

    it('14. instrumento sem ID é ignorado;', () => {
      const instruments: readonly Instrument[] = [
        
        { id: '', name: 'B', category: 'Voz' } ,
        { id: '  ', name: 'C', category: 'Voz' } ,
      ];
      const result = groupTeamFunctions(instruments);
      expect(result.ministers.length).toBe(0);
      expect(result.vocals.length).toBe(0);
      expect(result.instruments.length).toBe(0);
    });

    it('15. instrumento duplicado é ignorado;', () => {
      const instruments: readonly Instrument[] = [
        { id: '1', name: 'A', category: 'Voz' } ,
        { id: '1', name: 'B', category: 'Voz' } ,
      ];
      const result = groupTeamFunctions(instruments);
      expect(result.vocals.length).toBe(1);
      expect(result.vocals[0].name).toBe('A');
    });

    it('16. array de instrumentos não é modificado;', () => {
      const instruments: readonly Instrument[] = [
        { id: '1', name: 'B', category: 'Voz' } ,
        { id: '2', name: 'A', category: 'Voz' } ,
      ];
      const original = [...instruments];
      groupTeamFunctions(instruments);
      expect(instruments).toEqual(original);
    });
  });

  describe('normalizeSpecialtyIds', () => {
    it('17. IDs de funções são normalizados;', () => {
      const ids = [' a ', 'b'];
      const result = normalizeSpecialtyIds(ids);
      expect(result).toEqual(['a', 'b']);
    });

    it('18. IDs vazios são removidos;', () => {
      const ids = ['a', '', '  '];
      const result = normalizeSpecialtyIds(ids);
      expect(result).toEqual(['a']);
    });

    it('19. duplicidades são removidas;', () => {
      const ids = ['a', ' b ', 'a', 'b'];
      const result = normalizeSpecialtyIds(ids);
      expect(result).toEqual(['a', 'b']);
    });

    it('20. ordem dos IDs é preservada;', () => {
      const ids = ['c', 'b', 'a'];
      const result = normalizeSpecialtyIds(ids);
      expect(result).toEqual(['c', 'b', 'a']);
    });

    it('21. arrays recebidos não são modificados;', () => {
      const ids = [' c ', 'b', ' a '];
      const original = [...ids];
      normalizeSpecialtyIds(ids);
      expect(ids).toEqual(original);
    });
  });
});
