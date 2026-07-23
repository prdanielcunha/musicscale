import { UserProfile, Instrument } from "../types";

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
  isTeamConfigured: boolean;
}

export function evaluateTeamSetup(
  users: UserProfile[],
  currentUserId?: string
): TeamSetupSummary {
  let additionalMembers = 0;
  let membersWithAccessProfile = 0;
  let membersWithMinistryFunctions = 0;
  let configuredMembers = 0;
  const incompleteMemberIds: string[] = [];

  const validUsers = users.filter((u) => u.uid);

  validUsers.forEach((user) => {
    if (user.uid === currentUserId) return;

    additionalMembers++;

    const hasAccessProfile = !!(user.roleId || user.musicscaleRole);
    const hasMinistryFunctions = Array.isArray(user.specialtyIds) && user.specialtyIds.some(id => !!id);
    const isConfigured = hasAccessProfile && hasMinistryFunctions;

    if (hasAccessProfile) membersWithAccessProfile++;
    if (hasMinistryFunctions) membersWithMinistryFunctions++;
    if (isConfigured) configuredMembers++;
    else incompleteMemberIds.push(user.uid);
  });

  return {
    totalMembers: validUsers.length,
    additionalMembers,
    membersWithAccessProfile,
    membersWithMinistryFunctions,
    configuredMembers,
    incompleteMemberIds,
    isTeamConfigured: configuredMembers > 0
  };
}

export function groupMinistryFunctions(
  instruments: Instrument[]
): {
  ministers: Instrument[];
  vocals: Instrument[];
  instruments: Instrument[];
} {
  const ministers = instruments.filter(i => i.category === 'Ministro').sort((a, b) => a.name.localeCompare(b.name));
  const vocals = instruments.filter(i => i.category === 'Voz').sort((a, b) => a.name.localeCompare(b.name));
  const otherInstruments = instruments.filter(i => i.category === 'Instrumento').sort((a, b) => a.name.localeCompare(b.name));

  return {
    ministers,
    vocals,
    instruments: otherInstruments
  };
}
