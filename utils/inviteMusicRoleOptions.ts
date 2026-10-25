import type { Role } from '../types';

const PROTECTED_ROLE_NAMES = new Set([
  'owner', 'dono', 'ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support', 'suporte'
]);
const PERMISSION_KEYS = [
  'canManageUsers', 'canManageRoles', 'canManageRepertoire',
  'canManageScales', 'canViewContent', 'canManageChords',
] as const;

export type InviteMusicRoleOption = {
  role: Role;
  /** Multiple backing role IDs have the same visible label but different permissions. */
  ambiguous: boolean;
  duplicateCount: number;
};

/** UI-only grouping: never deletes or merges persisted MusicScale roles. */
export function resolveInviteMusicRoleOptions(
  roles: readonly Role[], organizationId: string
): InviteMusicRoleOption[] {
  const byName = new Map<string, Role[]>();
  for (const role of roles) {
    const name = typeof role?.name === 'string' ? role.name.trim() : '';
    if (!name || !role?.id ||
      (role.organizationId && role.organizationId !== organizationId)) continue;
    const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').toLowerCase();
    if (PROTECTED_ROLE_NAMES.has(key)) continue;
    const bucket = byName.get(key) ?? [];
    if (!bucket.some(candidate => candidate.id === role.id)) bucket.push(role);
    byName.set(key, bucket);
  }
  return Array.from(byName.values()).map(bucket => {
    // Stable representation independent of Firestore query order.
    const sorted = [...bucket].sort((a, b) => a.id.localeCompare(b.id));
    const fingerprints = new Set(sorted.map(role =>
      PERMISSION_KEYS.map(key => role.permissions?.[key] === true ? '1' : '0').join('')
    ));
    return {
      role: sorted[0],
      ambiguous: fingerprints.size > 1,
      duplicateCount: sorted.length,
    };
  }).sort((a, b) => a.role.name.localeCompare(b.role.name, 'pt-BR'));
}
