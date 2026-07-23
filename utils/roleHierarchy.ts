export const ORG_ROLE_RANK: Record<string, number> = {
  viewer: 10,
  musician: 10,
  member: 10,
  leader: 30,
  admin: 70,
  owner: 100,
};

export function getRoleKeyFromName(roleName: string): string {
  const name = (roleName || "").toLowerCase();
  if (name.includes("dono") || name === "owner" || name === "ceo" || name.includes("founder")) return "owner";
  if (name.includes("administrador") || name === "admin") return "admin";
  if (name.includes("líder") || name.includes("lider") || name.includes("ministro") || name === "leader") return "leader";
  if (name.includes("músico") || name.includes("musico") || name.includes("vocal") || name === "musician") return "musician";
  return "viewer";
}

export function getRoleKeyFromId(roleId: string, availableRoles: any[]): string {
  const roleName = availableRoles.find(r => r.id === roleId)?.name || "";
  return getRoleKeyFromName(roleName);
}

export interface RoleChangeContext {
  isGlobalPrivilegedUser: boolean;
  actorSystemRole?: string;
  actorOrganizationRole?: string;
  targetOrganizationRole?: string;
  newOrganizationRole?: string;
  isSelfChange: boolean;
  otherOwnersActiveCount: number;
}

/**
 * Assesses whether an actor can assign a speculative role.
 */
export function canAssignOrganizationRole(
  actorRole: string,
  targetRole: string,
  context: RoleChangeContext
): { canAssign: boolean; error?: string } {
  if (context.isGlobalPrivilegedUser) {
    return { canAssign: true };
  }

  const roleNormalized = (actorRole || 'viewer').toLowerCase();
  const targetNormalized = (targetRole || 'viewer').toLowerCase();

  const actorRank = ORG_ROLE_RANK[roleNormalized] || 10;
  const targetRank = ORG_ROLE_RANK[targetNormalized] || 10;

  if (targetRank > actorRank) {
    return { canAssign: false, error: "Você não pode conceder um cargo acima do seu nível na organização." };
  }

  if (roleNormalized === 'admin' && targetNormalized === 'owner') {
    return { canAssign: false, error: "Administradores não podem promover membros a Dono da organização." };
  }

  return { canAssign: true };
}

/**
 * Validates if a role transition is permitted under organizational hierarchy constraints.
 */
export function canChangeOrganizationRole(
  actorRole: string,
  targetCurrentRole: string,
  newRole: string,
  context: RoleChangeContext
): { canChange: boolean; error?: string } {
  if (context.isGlobalPrivilegedUser) {
    // Even global privileged users cannot remove the last owner
    if (
      (targetCurrentRole || '').toLowerCase() === 'owner' &&
      (newRole || '').toLowerCase() !== 'owner' &&
      context.otherOwnersActiveCount === 0
    ) {
      return { canChange: false, error: "Não é possível remover o último dono da organização." };
    }
    return { canChange: true };
  }

  const roleNormalized = (actorRole || 'viewer').toLowerCase();
  const currentNormalized = (targetCurrentRole || 'viewer').toLowerCase();
  const newNormalized = (newRole || 'viewer').toLowerCase();

  const actorRank = ORG_ROLE_RANK[roleNormalized] || 10;
  const currentRank = ORG_ROLE_RANK[currentNormalized] || 10;
  const newRank = ORG_ROLE_RANK[newNormalized] || 10;

  // non-admin/owner roles can't change roles at all
  if (roleNormalized !== 'owner' && roleNormalized !== 'admin') {
    return { canChange: false, error: "Seu cargo atual não permite alterar funções de membros." };
  }

  // admin cannot change owner
  if (roleNormalized === 'admin' && currentNormalized === 'owner') {
    return { canChange: false, error: "Administradores não podem alterar donos da organização." };
  }

  // users cannot change roles of anyone of a higher rank than themselves
  if (currentRank > actorRank) {
    return { canChange: false, error: "Você não pode alterar o cargo de alguém acima do seu nível na organização." };
  }

  // admin cannot assign role above their own level (e.g. promoting to owner)
  if (newRank > actorRank) {
    return { canChange: false, error: "Você não pode conceder um cargo acima do seu nível na organização." };
  }

  // owner cannot demote another owner
  if (roleNormalized === 'owner' && currentNormalized === 'owner' && !context.isSelfChange) {
    return { canChange: false, error: "Dono não pode rebaixar outro Dono." };
  }

  // check self change for owner
  if (context.isSelfChange && currentNormalized === 'owner' && newNormalized !== 'owner') {
    if (context.otherOwnersActiveCount === 0) {
      return { canChange: false, error: "Não é possível remover o último dono da organização." };
    }
  }

  return { canChange: true };
}

/**
 * Returns list of allowed roles that an actor can speculative assign.
 */
export function getAssignableOrganizationRoles(
  actorRole: string,
  context: { isGlobalPrivilegedUser: boolean }
): string[] {
  const norm = (actorRole || '').toLowerCase();
  if (context.isGlobalPrivilegedUser) {
    return ['owner', 'admin', 'leader', 'musician', 'viewer'];
  }
  if (norm === 'owner') {
    return ['owner', 'admin', 'leader', 'musician', 'viewer'];
  }
  if (norm === 'admin') {
    return ['admin', 'leader', 'musician', 'viewer'];
  }
  return [];
}
