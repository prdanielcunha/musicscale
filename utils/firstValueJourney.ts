import { UserProfile, Song } from '../types';
import { evaluateTeamSetup, TeamSetupSummary } from './teamSetup';

export type FirstValueJourneyStep =
  | "repertoire"
  | "firstScale"
  | "team"
  | "publish";

export type FirstValueJourneyTeamState =
  | "empty"
  | "incomplete"
  | "ready"
  | "unavailable";

export type FirstValueJourneyTeamDataStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

export type FirstValueJourneyMilestoneId =
  | "repertoire"
  | "firstScale"
  | "team"
  | "publish";

export interface FirstValueJourneyMilestone {
  id: FirstValueJourneyMilestoneId;
  status:
    | "completed"
    | "current"
    | "pending"
    | "optional";
}

export type JourneyTimestamp =
  | number
  | string
  | Date
  | {
      toMillis?: () => number;
      toDate?: () => Date;
      seconds?: number;
    };

export interface MinimalJourneyScale {
  id: string;
  status?: string;
  date?: string;
  createdAt?: JourneyTimestamp;
  updatedAt?: JourneyTimestamp;
  lastModifiedAt?: JourneyTimestamp;
}

export interface FirstValueJourneyInput {
  songs: Song[] | null | undefined;
  scales: MinimalJourneyScale[] | null | undefined;
  allUsers: UserProfile[] | null | undefined;
  canEditScales: boolean;
  canCreateSongs: boolean;
  canManageMembers: boolean;
  organizationId: string | undefined;
  loading: boolean;
  currentUserId?: string;
  teamDataStatus?: FirstValueJourneyTeamDataStatus;
}

export interface MinimalDraftScale {
  id: string;
  status?: string;
  date?: string;
  createdAt?: JourneyTimestamp;
  updatedAt?: JourneyTimestamp;
}

export interface FirstValueJourneyOutput {
  isEligible: boolean;
  isLoading: boolean;
  isCompleted: boolean;
  currentEssentialStep: FirstValueJourneyStep | null;
  completedEssentialSteps: number;
  totalEssentialSteps: number;
  milestones: FirstValueJourneyMilestone[];
  draftScale: MinimalDraftScale | null;
  hasTeam: boolean;
  teamState: FirstValueJourneyTeamState;
  teamSetupSummary: TeamSetupSummary | null;
  canManageMembers: boolean;
}

export function getJourneyTimestampValue(
  value: JourneyTimestamp | null | undefined
): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  if (typeof value === "object") {
    try {
      if (typeof value.toMillis === "function") {
        const timestamp = value.toMillis();
        if (Number.isFinite(timestamp)) {
          return timestamp;
        }
      }
    } catch {
      // formato externo inválido
    }
    try {
      if (typeof value.toDate === "function") {
        const date = value.toDate();
        if (date instanceof Date) {
          const timestamp = date.getTime();
          if (Number.isFinite(timestamp)) {
            return timestamp;
          }
        }
      }
    } catch {
      // formato externo inválido
    }
    if (typeof value.seconds === "number" && Number.isFinite(value.seconds)) {
      return value.seconds * 1000;
    }
  }
  if (typeof value === "string") {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  return 0;
}

const getScaleTimestamp = (
  scale: MinimalJourneyScale
): number =>
  getJourneyTimestampValue(
    scale.lastModifiedAt
  ) ||
  getJourneyTimestampValue(
    scale.updatedAt
  ) ||
  getJourneyTimestampValue(
    scale.createdAt
  ) ||
  getJourneyTimestampValue(
    scale.date
  );

export function evaluateFirstValueJourney(input: FirstValueJourneyInput): FirstValueJourneyOutput {
  const { songs, scales, allUsers, canEditScales, canCreateSongs, canManageMembers, organizationId, loading, currentUserId, teamDataStatus = 'ready' } = input;
  
  const totalEssentialSteps = 4;
  
  if (loading || !organizationId) {
    return {
      isEligible: false,
      isLoading: true,
      isCompleted: false,
      currentEssentialStep: null,
      completedEssentialSteps: 0,
      totalEssentialSteps,
      milestones: [],
      draftScale: null,
      hasTeam: false,
      teamState: "empty",
      teamSetupSummary: null,
      canManageMembers
    };
  }

  // Se não tiver essas duas permissões, não recebe a jornada administrativa
  if (!canEditScales || !canCreateSongs) {
    return {
      isEligible: false,
      isLoading: false,
      isCompleted: false,
      currentEssentialStep: null,
      completedEssentialSteps: 0,
      totalEssentialSteps,
      milestones: [],
      draftScale: null,
      hasTeam: false,
      teamState: "empty",
      teamSetupSummary: null,
      canManageMembers
    };
  }

  const hasSongs = Array.isArray(songs) && songs.length > 0;
  
  const validScales = Array.isArray(scales) ? scales.filter(s => s.status !== 'cancelled') : [];
  const hasValidScales = validScales.length > 0;
  
  const hasPublishedScale = validScales.some(s => s.status === 'published' || !s.status);
  
  const drafts = validScales.filter(s => s.status === 'draft');
  const sortedDrafts = [...drafts].sort((a, b) => {
    return getScaleTimestamp(b) - getScaleTimestamp(a);
  });

  const mostRecentDraft = sortedDrafts[0] || null;

  const requiresTeamData = hasSongs && hasValidScales && !hasPublishedScale && canManageMembers;

  if (hasPublishedScale && teamDataStatus !== 'ready') {
    return {
      isEligible: true,
      isLoading: false,
      isCompleted: true,
      currentEssentialStep: null,
      completedEssentialSteps: totalEssentialSteps,
      totalEssentialSteps,
      milestones: [],
      draftScale: null,
      hasTeam: false,
      teamState: "unavailable",
      teamSetupSummary: null,
      canManageMembers
    };
  }

  if (requiresTeamData && (teamDataStatus === 'idle' || teamDataStatus === 'loading')) {
    return {
      isEligible: true,
      isLoading: true,
      isCompleted: false,
      currentEssentialStep: null,
      completedEssentialSteps: 2,
      totalEssentialSteps,
      milestones: [],
      draftScale: mostRecentDraft,
      hasTeam: false,
      teamState: "unavailable",
      teamSetupSummary: null,
      canManageMembers
    };
  }

  if (requiresTeamData && teamDataStatus === 'error') {
    return {
      isEligible: false,
      isLoading: false,
      isCompleted: false,
      currentEssentialStep: null,
      completedEssentialSteps: 2,
      totalEssentialSteps,
      milestones: [],
      draftScale: mostRecentDraft,
      hasTeam: false,
      teamState: "unavailable",
      teamSetupSummary: null,
      canManageMembers
    };
  }

  const usersArray = Array.isArray(allUsers) ? allUsers : [];
  // Usa evaluateTeamSetup para derivar estado da equipe
  const teamSetupSummary = evaluateTeamSetup(usersArray, currentUserId);
  
  const hasTeam = teamSetupSummary.additionalMembers > 0;

  let teamState: FirstValueJourneyTeamState = "empty";
  if (!canManageMembers) {
    teamState = "unavailable";
  } else if (teamSetupSummary.isTeamConfigured) {
    teamState = "ready";
  } else if (teamSetupSummary.additionalMembers > 0 && teamSetupSummary.configuredMembers === 0) {
    teamState = "incomplete";
  } else if (teamSetupSummary.additionalMembers === 0) {
    teamState = "empty";
  }

  if (hasPublishedScale) {
    return {
      isEligible: true,
      isLoading: false,
      isCompleted: true,
      currentEssentialStep: null,
      completedEssentialSteps: totalEssentialSteps,
      totalEssentialSteps,
      milestones: [],
      draftScale: null,
      hasTeam,
      teamState,
      teamSetupSummary,
      canManageMembers
    };
  }

  let currentEssentialStep: FirstValueJourneyStep = 'repertoire';
  let completedEssentialSteps = 0;

  if (!hasSongs) {
    currentEssentialStep = 'repertoire';
    completedEssentialSteps = 0;
  } else if (!hasValidScales) {
    currentEssentialStep = 'firstScale';
    completedEssentialSteps = 1;
  } else if (!canManageMembers) {
    currentEssentialStep = 'publish';
    completedEssentialSteps = 2;
  } else if (!teamSetupSummary.isTeamConfigured) {
    currentEssentialStep = 'team';
    completedEssentialSteps = 2;
  } else {
    currentEssentialStep = 'publish';
    completedEssentialSteps = 3;
  }

  const milestones: FirstValueJourneyMilestone[] = [
    {
      id: 'repertoire',
      status: completedEssentialSteps >= 1 ? 'completed' : 'current'
    },
    {
      id: 'firstScale',
      status: completedEssentialSteps >= 2 ? 'completed' : (currentEssentialStep === 'firstScale' ? 'current' : 'pending')
    },
    {
      id: 'team',
      status: !canManageMembers ? 'optional' : (completedEssentialSteps >= 3 ? 'completed' : (currentEssentialStep === 'team' ? 'current' : 'pending'))
    },
    {
      id: 'publish',
      status: currentEssentialStep === 'publish' ? 'current' : 'pending'
    }
  ];

  return {
    isEligible: true,
    isLoading: false,
    isCompleted: false,
    currentEssentialStep,
    completedEssentialSteps,
    totalEssentialSteps,
    milestones,
    draftScale: mostRecentDraft,
    hasTeam,
    teamState,
    teamSetupSummary,
    canManageMembers
  };
}
