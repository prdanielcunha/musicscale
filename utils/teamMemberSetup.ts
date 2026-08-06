import { UserProfile, Instrument } from "../types";
import { evaluateTeamSetup } from "./teamSetup";

export interface ExistingMemberSetupItem {
  user: UserProfile;
  isCurrentUser: boolean;
  hasAccessProfile: boolean;
  hasMinistryFunctions: boolean;
  isConfigured: boolean;
}

export type AccessLockReason = "owner" | "self" | "hierarchy" | null;

export interface TeamMemberAccessPolicy {
  canEditAccess: boolean;
  lockReason: AccessLockReason;
  reason?: string;
  allowedRoleIds: string[];
}

export interface TeamMemberSetupDraft {
  userId: string;
  roleId: string;
  specialtyIds: string[];
}

export interface TeamMemberSetupPayload {
  roleId?: string;
  musicscaleRole?: string;
  specialtyIds: string[];
}

export function isTeamMemberDraftDirty(
  initialDraft: TeamMemberSetupDraft | null,
  currentDraft: TeamMemberSetupDraft | null
): boolean {
  if (!initialDraft && !currentDraft) return false;
  if (!initialDraft || !currentDraft) return true;

  if (initialDraft.userId !== currentDraft.userId) return true;
  if (initialDraft.roleId !== currentDraft.roleId) return true;

  const initialSpecialties = normalizeSpecialtyIds(initialDraft.specialtyIds).sort();
  const currentSpecialties = normalizeSpecialtyIds(currentDraft.specialtyIds).sort();

  if (initialSpecialties.length !== currentSpecialties.length) return true;

  for (let i = 0; i < initialSpecialties.length; i++) {
    if (initialSpecialties[i] !== currentSpecialties[i]) return true;
  }

  return false;
}

export function buildExistingMemberSetupItems(
  users: readonly UserProfile[],
  currentUserId?: string
): ExistingMemberSetupItem[] {
  const map = new Map<string, UserProfile>();
  for (const user of users) {
    if (user && typeof user.uid === 'string') {
      const trimmed = user.uid.trim();
      if (trimmed && !map.has(trimmed)) {
        map.set(trimmed, user);
      }
    }
  }

  const evaluation = evaluateTeamSetup(users);
  
  const items: ExistingMemberSetupItem[] = [];
  const currentUserIdTrimmed = typeof currentUserId === 'string' ? currentUserId.trim() : '';

  for (const status of evaluation.memberStatuses) {
    const user = map.get(status.userId);
    if (!user) continue;

    items.push({
      user,
      isCurrentUser: status.userId === currentUserIdTrimmed,
      hasAccessProfile: status.hasAccessProfile,
      hasMinistryFunctions: status.hasMinistryFunctions,
      isConfigured: status.isConfigured
    });
  }

  return items.sort((a, b) => {
    if (!a.isConfigured && b.isConfigured) return -1;
    if (a.isConfigured && !b.isConfigured) return 1;
    
    if (a.isCurrentUser && !b.isCurrentUser) return 1;
    if (!a.isCurrentUser && b.isCurrentUser) return -1;
    
    return 0;
  });
}

export function groupTeamFunctions(
  instruments: readonly Instrument[]
): {
  ministers: Instrument[];
  vocals: Instrument[];
  instruments: Instrument[];
} {
  const map = new Map<string, Instrument>();
  
  for (const inst of instruments) {
    if (inst && typeof inst.id === 'string') {
      const trimmedId = inst.id.trim();
      if (trimmedId && !map.has(trimmedId)) {
        map.set(trimmedId, inst);
      }
    }
  }

  const result = {
    ministers: [] as Instrument[],
    vocals: [] as Instrument[],
    instruments: [] as Instrument[]
  };

  for (const inst of map.values()) {
    if (inst.category === "Ministro") {
      result.ministers.push(inst);
    } else if (inst.category === "Voz") {
      result.vocals.push(inst);
    } else if (inst.category === "Instrumento") {
      result.instruments.push(inst);
    }
  }

  const sortByName = (a: Instrument, b: Instrument) => 
    (a.name || "").localeCompare(b.name || "");

  result.ministers.sort(sortByName);
  result.vocals.sort(sortByName);
  result.instruments.sort(sortByName);

  return result;
}

export function normalizeSpecialtyIds(
  specialtyIds: readonly string[]
): string[] {
  const set = new Set<string>();
  const result: string[] = [];
  
  for (const id of specialtyIds) {
    if (typeof id === 'string') {
      const trimmed = id.trim();
      if (trimmed && !set.has(trimmed)) {
        set.add(trimmed);
        result.push(trimmed);
      }
    }
  }
  
  return result;
}
