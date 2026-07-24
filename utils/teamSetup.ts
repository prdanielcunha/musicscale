import { UserProfile } from '../types';

export interface TeamMemberSetupStatus {
  userId: string;
  hasAccessProfile: boolean;
  hasMinistryFunctions: boolean;
  isConfigured: boolean;
}

export interface TeamSetupSummary {
  totalMembers: number;
  additionalMembers: number;
  membersWithAccessProfile: number;
  membersWithMinistryFunctions: number;
  configuredMembers: number;
  incompleteMemberIds: string[];
  memberStatuses: TeamMemberSetupStatus[];
  isTeamConfigured: boolean;
}

export function evaluateTeamSetup(
  users: readonly UserProfile[],
  currentUserId?: string
): TeamSetupSummary {
  const summary: TeamSetupSummary = {
    totalMembers: 0,
    additionalMembers: 0,
    membersWithAccessProfile: 0,
    membersWithMinistryFunctions: 0,
    configuredMembers: 0,
    incompleteMemberIds: [],
    memberStatuses: [],
    isTeamConfigured: false
  };

  const currentUserIdTrimmed = typeof currentUserId === 'string' ? currentUserId.trim() : '';

  const processedUids = new Set<string>();

  for (const user of users) {
    if (!user || typeof user.uid !== 'string') continue;
    const uid = user.uid.trim();
    if (!uid || processedUids.has(uid)) continue;

    processedUids.add(uid);
    summary.totalMembers++;

    if (uid === currentUserIdTrimmed) {
      continue;
    }

    summary.additionalMembers++;

    const hasAccessProfile = 
      (typeof user.roleId === 'string' && user.roleId.trim().length > 0) ||
      (typeof user.musicscaleRole === 'string' && user.musicscaleRole.trim().length > 0);

    const hasMinistryFunctions = 
      Array.isArray(user.specialtyIds) &&
      user.specialtyIds.some(id => typeof id === 'string' && id.trim().length > 0);

    const isConfigured = hasAccessProfile && hasMinistryFunctions;

    summary.memberStatuses.push({
      userId: uid,
      hasAccessProfile,
      hasMinistryFunctions,
      isConfigured
    });

    if (hasAccessProfile) {
      summary.membersWithAccessProfile++;
    }
    if (hasMinistryFunctions) {
      summary.membersWithMinistryFunctions++;
    }
    if (isConfigured) {
      summary.configuredMembers++;
      summary.isTeamConfigured = true;
    } else {
      summary.incompleteMemberIds.push(uid);
    }
  }

  return summary;
}
