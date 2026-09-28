import { describe, expect, it } from 'vitest';
import { resolveEcosystemSystemRole } from '../../services/ecosystem/startupFastPath';

describe('resolveEcosystemSystemRole', () => {
  it('keeps canonical lowercase system roles', () => {
    expect(resolveEcosystemSystemRole({ systemRole: 'ceo' })).toBe('ceo');
    expect(resolveEcosystemSystemRole({ systemRole: 'global_admin' })).toBe('global_admin');
  });

  it('normalizes uppercase canonical roles', () => {
    expect(resolveEcosystemSystemRole({ systemRole: 'CEO' })).toBe('ceo');
    expect(resolveEcosystemSystemRole({ systemRole: 'ADMIN' })).toBe('admin');
  });

  it('finds a global role in canonical compatibility fields before a tenant role', () => {
    expect(resolveEcosystemSystemRole({
      systemRole: 'user',
      globalRole: 'ceo',
      ecosystemRole: 'owner',
    })).toBe('ceo');
  });

  it('never promotes the organization role field into an ecosystem role', () => {
    expect(resolveEcosystemSystemRole({ role: 'admin' })).toBe('user');
  });
});
