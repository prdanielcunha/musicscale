/** Resolve musical metadata only; organization access roles are never input. */
export function resolveMemberMusicRoleId(
  member: { roleId?: string; musicscaleRole?: string; ministryFunction?: string | string[] },
  roles: readonly { id: string; name: string }[],
): string {
  const exact = roles.find(role => role.id === member.roleId);
  if (exact) return exact.id;
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const aliases: Record<string, string[]> = {
    musician: ['musico', 'musico / vocal'], role_dummy_musician: ['musico / vocal', 'musico'],
    leader: ['lider', 'lider / ministro', 'ministro'], role_dummy_leader: ['lider / ministro', 'lider', 'ministro'],
    admin: ['administrador'], role_dummy_admin: ['administrador'], 'admin-role-fallback': ['administrador'],
    owner: ['dono'], role_dummy_owner: ['dono'],
    viewer: ['visitante'], role_dummy_visitor: ['visitante'],
  };
  const ministry = Array.isArray(member.ministryFunction) ? member.ministryFunction : [member.ministryFunction];
  for (const source of [member.roleId, member.musicscaleRole, ...ministry]) {
    if (typeof source !== 'string' || !source.trim()) continue;
    const key = normalize(source);
    for (const name of [key, ...(aliases[key] || [])]) {
      const matches = roles.filter(role => normalize(role.name) === name);
      if (matches.length === 1) return matches[0].id;
      if (matches.length > 1) return member.roleId || '';
    }
  }
  // Keep unresolved references for later recovery; never rewrite them to viewer.
  return member.roleId || '';
}
