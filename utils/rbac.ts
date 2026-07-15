export type MusicScaleCapability =
  | 'musicScale.fullAccess'
  | 'scales.read'
  | 'scales.create'
  | 'scales.update'
  | 'scales.delete'
  | 'scales.publish'
  | 'bandScales.read'
  | 'bandScales.create'
  | 'bandScales.update'
  | 'bandScales.delete'
  | 'songs.read'
  | 'songs.create'
  | 'songs.update'
  | 'songs.delete'
  | 'musicians.read'
  | 'musicians.manageMusicalProfile'
  | 'musicians.assignToScale'
  | 'taxonomy.roles.manage'
  | 'taxonomy.instruments.manage'
  | 'taxonomy.skills.manage'
  | 'taxonomy.eventTypes.manage'
  | 'taxonomy.eventNames.manage'
  | 'taxonomy.locations.manage'
  | 'taxonomy.tags.manage'
  | 'notifications.readOwn'
  | 'scaleResponses.respondOwn'
  | 'scaleResponses.readManaged'
  | 'organization.settings.manage'
  | 'organization.members.manage';

export type EffectiveEcosystemContext = {
  userId: string;
  organizationId: string | null;
  systemRole: string | null;
  organizationRole: string | null;
  membershipStatus: string | null;
  musicScaleProfile: {
    ministryRoles: string[];
    instrumentIds: string[];
    skillIds: string[];
  } | null;
  isGlobalAccess: boolean;
  isOrganizationAdmin: boolean;
  effectiveCapabilities: string[];
  accessSource:
    | 'system_role'
    | 'organization_owner'
    | 'organization_role'
    | 'music_role'
    | 'membership'
    | 'none';
  resolutionStatus:
    | 'resolved'
    | 'incomplete'
    | 'error';
  version: number;
};

export type EffectiveAccessContext = {
  userId: string;
  organizationId: string | null;
  systemRole: string | null;
  organizationRole: string | null;
  isGlobalFullAccess: boolean;
  isOrganizationFullAccess: boolean;
  capabilities: Set<MusicScaleCapability>;
};

export function normalizeSystemRole(role: string | null | undefined): string {
  if (!role) return 'viewer';
  const r = role.toLowerCase().trim();
  if (['ceo', 'founder', 'ecosystem_owner', 'owner', 'dono'].includes(r)) return 'ecosystem_owner';
  if (['admin', 'global_admin', 'administrador'].includes(r)) return 'global_admin';
  if (['support', 'suporte', 'global_support'].includes(r)) return 'global_support';
  return r;
}

export function isGlobalMusicScaleAdministrator(normalizedRole: string): boolean {
  return ['ecosystem_owner', 'global_admin', 'global_support'].includes(normalizedRole);
}

export function normalizeOrganizationRole(role: string | null | undefined): string {
  if (!role) return 'viewer';
  const r = role.toLowerCase().trim();
  if (['owner', 'dono'].includes(r)) return 'owner';
  if (['admin', 'administrator', 'administrador'].includes(r)) return 'admin';
  if (['leader', 'lider', 'líder', 'lider / ministro', 'líder / ministro', 'minister', 'ministro', 'pastor', 'worship_leader', 'music_leader'].includes(r)) return 'leader';
  if (['member', 'membro', 'musician', 'musico', 'músico', 'singer', 'cantor', 'vocal', 'músico / vocal', 'musico / vocal', 'integrante', 'voluntário'].includes(r)) return 'member';
  return r;
}

export function resolveCapabilities(systemRole: string | null, orgRole: string | null): Set<MusicScaleCapability> {
  const normalizedSystem = normalizeSystemRole(systemRole);
  const normalizedOrg = normalizeOrganizationRole(orgRole);
  
  const capabilities = new Set<MusicScaleCapability>();
  
  // 1. Global Admins
  if (isGlobalMusicScaleAdministrator(normalizedSystem)) {
    capabilities.add('musicScale.fullAccess');
    const allCaps: MusicScaleCapability[] = [
      'scales.read', 'scales.create', 'scales.update', 'scales.delete', 'scales.publish',
      'bandScales.read', 'bandScales.create', 'bandScales.update', 'bandScales.delete',
      'songs.read', 'songs.create', 'songs.update', 'songs.delete',
      'musicians.read', 'musicians.manageMusicalProfile', 'musicians.assignToScale',
      'taxonomy.roles.manage', 'taxonomy.instruments.manage', 'taxonomy.skills.manage',
      'taxonomy.eventTypes.manage', 'taxonomy.eventNames.manage', 'taxonomy.locations.manage', 'taxonomy.tags.manage',
      'notifications.readOwn', 'scaleResponses.respondOwn', 'scaleResponses.readManaged',
      'organization.settings.manage', 'organization.members.manage'
    ];
    allCaps.forEach(c => capabilities.add(c));
    return capabilities;
  }
  
  // 2. Organization Admins
  if (['owner', 'admin'].includes(normalizedOrg)) {
    const orgAdminCaps: MusicScaleCapability[] = [
      'scales.read', 'scales.create', 'scales.update', 'scales.delete', 'scales.publish',
      'bandScales.read', 'bandScales.create', 'bandScales.update', 'bandScales.delete',
      'songs.read', 'songs.create', 'songs.update', 'songs.delete',
      'musicians.read', 'musicians.manageMusicalProfile', 'musicians.assignToScale',
      'taxonomy.roles.manage', 'taxonomy.instruments.manage', 'taxonomy.skills.manage',
      'taxonomy.eventTypes.manage', 'taxonomy.eventNames.manage', 'taxonomy.locations.manage', 'taxonomy.tags.manage',
      'notifications.readOwn', 'scaleResponses.respondOwn', 'scaleResponses.readManaged',
      'organization.settings.manage', 'organization.members.manage'
    ];
    orgAdminCaps.forEach(c => capabilities.add(c));
    return capabilities;
  }
  
  // 3. Leaders
  if (normalizedOrg === 'leader') {
    const leaderCaps: MusicScaleCapability[] = [
      'scales.read', 'scales.create', 'scales.update', 'scales.delete', 'scales.publish',
      'bandScales.read', 'bandScales.create', 'bandScales.update', 'bandScales.delete',
      'songs.read', 'songs.create', 'songs.update', 'songs.delete',
      'musicians.read', 'musicians.manageMusicalProfile', 'musicians.assignToScale',
      'taxonomy.roles.manage', 'taxonomy.instruments.manage', 'taxonomy.skills.manage',
      'taxonomy.eventTypes.manage', 'taxonomy.eventNames.manage', 'taxonomy.locations.manage', 'taxonomy.tags.manage',
      'notifications.readOwn', 'scaleResponses.respondOwn', 'scaleResponses.readManaged'
    ];
    leaderCaps.forEach(c => capabilities.add(c));
    return capabilities;
  }
  
  // 4. Members
  if (normalizedOrg === 'member' || normalizedOrg === 'viewer') {
    const memberCaps: MusicScaleCapability[] = [
      'scales.read',
      'bandScales.read',
      'songs.read',
      'musicians.read',
      'notifications.readOwn',
      'scaleResponses.respondOwn'
    ];
    memberCaps.forEach(c => capabilities.add(c));
  }
  
  return capabilities;
}

export function buildEffectiveAccessContext(
  userId: string,
  orgId: string | null,
  systemRole: string | null,
  orgRole: string | null,
  membershipStatus: string | null = 'active',
  musicScaleProfile: { ministryRoles: string[]; instrumentIds: string[]; skillIds: string[] } | null = null
): EffectiveAccessContext & EffectiveEcosystemContext {
  const normalizedSystem = normalizeSystemRole(systemRole);
  const normalizedOrg = orgRole ? normalizeOrganizationRole(orgRole) : null;
  
  const isGlobal = isGlobalMusicScaleAdministrator(normalizedSystem);
  
  let accessSource: 'system_role' | 'organization_owner' | 'organization_role' | 'music_role' | 'membership' | 'none' = 'none';
  let isGlobalAccess = false;
  let isOrganizationAdmin = false;
  let isGlobalFullAccess = false;
  let isOrganizationFullAccess = false;
  let resolutionStatus: 'resolved' | 'incomplete' | 'error' = 'incomplete';
  let capsSet = new Set<MusicScaleCapability>();

  const ALL_CAPS: MusicScaleCapability[] = [
    'scales.read', 'scales.create', 'scales.update', 'scales.delete', 'scales.publish',
    'bandScales.read', 'bandScales.create', 'bandScales.update', 'bandScales.delete',
    'songs.read', 'songs.create', 'songs.update', 'songs.delete',
    'musicians.read', 'musicians.manageMusicalProfile', 'musicians.assignToScale',
    'taxonomy.roles.manage', 'taxonomy.instruments.manage', 'taxonomy.skills.manage',
    'taxonomy.eventTypes.manage', 'taxonomy.eventNames.manage', 'taxonomy.locations.manage', 'taxonomy.tags.manage',
    'notifications.readOwn', 'scaleResponses.respondOwn', 'scaleResponses.readManaged',
    'organization.settings.manage', 'organization.members.manage'
  ];

  if (isGlobal) {
    // 1. Global systemRole (Level 1)
    accessSource = 'system_role';
    isGlobalAccess = true;
    isOrganizationAdmin = true;
    isGlobalFullAccess = true;
    isOrganizationFullAccess = true;
    resolutionStatus = 'resolved';
    ALL_CAPS.forEach(c => capsSet.add(c));
    capsSet.add('musicScale.fullAccess');
  } else if (normalizedOrg === 'owner') {
    // 2. Organization Owner (Level 2)
    accessSource = 'organization_owner';
    isGlobalAccess = false;
    isOrganizationAdmin = true;
    isGlobalFullAccess = false;
    isOrganizationFullAccess = true;
    resolutionStatus = 'resolved';
    ALL_CAPS.forEach(c => capsSet.add(c));
  } else if (normalizedOrg === 'admin') {
    // 3. Organization Admin (Level 3)
    accessSource = 'organization_role';
    isGlobalAccess = false;
    isOrganizationAdmin = true;
    isGlobalFullAccess = false;
    isOrganizationFullAccess = true;
    resolutionStatus = 'resolved';
    ALL_CAPS.forEach(c => capsSet.add(c));
  } else if (normalizedOrg === 'leader') {
    // 4. Music Leadership (Level 4)
    accessSource = 'music_role';
    isGlobalAccess = false;
    isOrganizationAdmin = false;
    isGlobalFullAccess = false;
    isOrganizationFullAccess = false;
    resolutionStatus = 'resolved';
    capsSet = resolveCapabilities(normalizedSystem, normalizedOrg);
  } else if (normalizedOrg === 'member') {
    // 5. Common Member (Level 5)
    accessSource = 'membership';
    isGlobalAccess = false;
    isOrganizationAdmin = false;
    isGlobalFullAccess = false;
    isOrganizationFullAccess = false;
    resolutionStatus = 'resolved';
    capsSet = resolveCapabilities(normalizedSystem, normalizedOrg);
  } else if (normalizedOrg === 'viewer' || normalizedOrg === 'guest' || normalizedOrg === 'visitor') {
    // 6. Explicit Visitor (Level 6)
    accessSource = 'none';
    isGlobalAccess = false;
    isOrganizationAdmin = false;
    isGlobalFullAccess = false;
    isOrganizationFullAccess = false;
    resolutionStatus = 'resolved';
    capsSet = resolveCapabilities(normalizedSystem, normalizedOrg);
  } else {
    // Fallback: Missing or un-resolvable membership (not allowed to default to visitor for non-visitors)
    accessSource = 'none';
    isGlobalAccess = false;
    isOrganizationAdmin = false;
    isGlobalFullAccess = false;
    isOrganizationFullAccess = false;
    resolutionStatus = 'incomplete';
    // Empty capabilities, blocking unauthorized actions
  }

  const effectiveCapabilities = Array.from(capsSet);

  return {
    userId,
    organizationId: orgId,
    systemRole: normalizedSystem,
    organizationRole: normalizedOrg,
    membershipStatus,
    musicScaleProfile,
    isGlobalAccess,
    isOrganizationAdmin,
    isGlobalFullAccess,
    isOrganizationFullAccess,
    capabilities: capsSet,
    effectiveCapabilities,
    accessSource,
    resolutionStatus,
    version: 2
  };
}

export function hasMusicScaleCapability(context: EffectiveAccessContext, capability: MusicScaleCapability): boolean {
  if (context.isGlobalFullAccess) return true;
  if (context.isOrganizationFullAccess) return true; // Safe fallback since orgAdmins get all org capabilities
  return context.capabilities.has(capability);
}

export function canManageMusicScales(context: EffectiveAccessContext): boolean {
  return hasMusicScaleCapability(context, 'scales.create') && hasMusicScaleCapability(context, 'scales.update');
}

export function canManageBandScales(context: EffectiveAccessContext): boolean {
  return hasMusicScaleCapability(context, 'bandScales.create') && hasMusicScaleCapability(context, 'bandScales.update');
}

export function canManageSongs(context: EffectiveAccessContext): boolean {
  return hasMusicScaleCapability(context, 'songs.create') && hasMusicScaleCapability(context, 'songs.update');
}

export function canManageMusicalTaxonomy(context: EffectiveAccessContext): boolean {
  return hasMusicScaleCapability(context, 'taxonomy.roles.manage');
}
