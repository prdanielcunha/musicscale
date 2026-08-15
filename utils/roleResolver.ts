import { UserProfile, Organization } from '../types';

export interface DisplayRole {
  label: string;
  scope: 'ecosystem' | 'organization';
  priority: number;
  badgeVariant: string;
}

export function getPrimaryDisplayRole(
  userProfile?: UserProfile | any | null,
  organization?: Organization | any | null,
  canonicalEcosystemRole?: string | null
): DisplayRole {
  const systemRole = String(canonicalEcosystemRole || userProfile?.systemRole || '').toLowerCase();
  
  // Organization role string usually comes from userProfile or organizations/{orgId}/members doc
  let orgRoleStr = '';
  if (userProfile?.musicscaleRole) {
      orgRoleStr = userProfile.musicscaleRole.toLowerCase();
  } else if (userProfile?.organizationRole) {
      orgRoleStr = userProfile.organizationRole.toLowerCase();
  } else if (userProfile?.role) {
      orgRoleStr = userProfile.role.toLowerCase();
  }

  // 1. Ecosystem Owner
  if (systemRole.includes('owner') || systemRole.includes('ecosystem_owner') || systemRole.includes('founder') || systemRole === 'dono') {
    return {
      label: 'Dono do Ecossistema MillionsNest',
      scope: 'ecosystem',
      priority: 1,
      badgeVariant: 'ecosystemOwner'
    };
  }

  // 2. Ecosystem CEO
  if (systemRole.includes('ceo')) {
    return {
      label: 'CEO do Ecossistema MillionsNest',
      scope: 'ecosystem',
      priority: 2,
      badgeVariant: 'ecosystemCeo'
    };
  }

  // 3. Ecosystem Admin
  if (systemRole.includes('admin') || systemRole.includes('global_admin')) {
    return {
      label: 'Administrador do Ecossistema MillionsNest',
      scope: 'ecosystem',
      priority: 3,
      badgeVariant: 'ecosystemAdmin'
    };
  }

  // Fallback to local organization roles

  // 4. Organization Owner
  if (orgRoleStr.includes('owner') || orgRoleStr.includes('dono') || (organization?.ownerUserId && organization.ownerUserId === userProfile?.uid)) {
    return {
      label: 'Dono da Organização',
      scope: 'organization',
      priority: 4,
      badgeVariant: 'organizationOwner'
    };
  }

  // 5. Organization CEO
  if (orgRoleStr.includes('ceo')) {
    return {
      label: 'CEO da Organização',
      scope: 'organization',
      priority: 5,
      badgeVariant: 'organizationCeo'
    };
  }

  // 6. Organization Admin
  if (orgRoleStr.includes('admin') || orgRoleStr.includes('administrador')) {
    return {
      label: 'Administrador da Organização',
      scope: 'organization',
      priority: 6,
      badgeVariant: 'organizationAdmin'
    };
  }

  // 7. Organization Leader
  if (orgRoleStr.includes('leader') || orgRoleStr.includes('líder') || orgRoleStr.includes('lider')) {
    return {
      label: 'Líder / Ministro',
      scope: 'organization',
      priority: 7,
      badgeVariant: 'leader'
    };
  }

  // 8. Organization Musician/Vocal
  if (orgRoleStr.includes('músico') || orgRoleStr.includes('musician') || orgRoleStr.includes('musico') || orgRoleStr.includes('vocal')) {
      return {
        label: 'Músico / Vocal',
        scope: 'organization',
        priority: 8,
        badgeVariant: 'member'
      };
  }

  // 9. Member
  return {
    label: 'Membro',
    scope: 'organization',
    priority: 9,
    badgeVariant: 'member'
  };
}

export function getRoleBadgeStyles(variant: string): string {
    switch(variant) {
        case 'ecosystemOwner':
            return 'bg-gradient-to-r from-[#FFD700]/20 to-[#FFA500]/20 text-[#FFD700] border border-[#FFD700]/40 shadow-[0_0_15px_rgba(255,215,0,0.2)] font-bold';
        case 'ecosystemCeo':
            return 'bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30 shadow-[0_0_10px_rgba(255,215,0,0.15)] font-semibold';
        case 'ecosystemAdmin':
            return 'bg-red-500/10 text-red-500 border border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.15)] font-semibold';
        case 'organizationOwner':
            return 'bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/30 shadow-[0_0_10px_rgba(168,85,247,0.15)]';
        case 'organizationCeo':
            return 'bg-[#A855F7]/10 text-[#A855F7] border border-[#A855F7]/20';
        case 'organizationAdmin':
            return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
        case 'leader':
            return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
        case 'member':
        default:
            return 'bg-slate-500/10 text-slate-500 border border-slate-500/20 dark:bg-slate-400/10 dark:text-slate-400 dark:border-slate-400/20';
    }
}
