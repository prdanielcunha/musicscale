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

const buildMilestones = (
  currentEssentialStep: FirstValueJourneyStep,
  completedEssentialSteps: number,
  canManageMembers: boolean
): FirstValueJourneyMilestone[] => [
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

export function evaluateFirstValueJourney(input: FirstValueJourneyInput): FirstValueJourneyOutput {
  const {
    songs,
    scales,
    allUsers,
    canEditScales,
    canCreateSongs,
    canManageMembers,
    organizationId,
    loading,
    currentUserId,
    teamDataStatus = 'ready'
  } = input;

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
      teamState: "unavailable",
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
      teamState: "unavailable",
      teamSetupSummary: null,
      canManageMembers
    };
  }

  const hasSongs = Array.isArray(songs) && songs.length > 0;
  const validScales = Array.isArray(scales) ? scales.filter(s => s.status !== 'cancelled') : [];
  const hasValidScales = validScales.length > 0;
  const hasPublishedScale = validScales.some(s => s.status === 'published' || !s.status);

  const drafts = validScales.filter(s => s.status === 'draft');
  const sortedDrafts = [...drafts].sort((a, b) => getScaleTimestamp(b) - getScaleTimestamp(a));
  const mostRecentDraft = sortedDrafts[0] || null;

  const teamDataReady = teamDataStatus === 'ready';
  const teamSetupSummary = teamDataReady
    ? evaluateTeamSetup(Array.isArray(allUsers) ? allUsers : [], currentUserId)
    : null;
  const hasTeam = teamSetupSummary ? teamSetupSummary.additionalMembers > 0 : false;

  let teamState: FirstValueJourneyTeamState = "unavailable";
  if (teamDataReady && canManageMembers && teamSetupSummary) {
    if (teamSetupSummary.isTeamConfigured) {
      teamState = "ready";
    } else if (teamSetupSummary.additionalMembers > 0 && teamSetupSummary.configuredMembers === 0) {
      teamState = "incomplete";
    } else if (teamSetupSummary.additionalMembers === 0) {
      teamState = "empty";
    }
  }

  // Established organizations must never wait for team/user data.
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
      teamState: canManageMembers ? teamState : "unavailable",
      teamSetupSummary,
      canManageMembers
    };
  }

  // These decisions do not depend on the team roster.
  if (!hasSongs) {
    const currentEssentialStep: FirstValueJourneyStep = 'repertoire';
    return {
      isEligible: true,
      isLoading: false,
      isCompleted: false,
      currentEssentialStep,
      completedEssentialSteps: 0,
      totalEssentialSteps,
      milestones: buildMilestones(currentEssentialStep, 0, canManageMembers),
      draftScale: mostRecentDraft,
      hasTeam,
      teamState: canManageMembers ? teamState : "unavailable",
      teamSetupSummary,
      canManageMembers
    };
  }

  if (!hasValidScales) {
    const currentEssentialStep: FirstValueJourneyStep = 'firstScale';
    return {
      isEligible: true,
      isLoading: false,
      isCompleted: false,
      currentEssentialStep,
      completedEssentialSteps: 1,
      totalEssentialSteps,
      milestones: buildMilestones(currentEssentialStep, 1, canManageMembers),
      draftScale: mostRecentDraft,
      hasTeam,
      teamState: canManageMembers ? teamState : "unavailable",
      teamSetupSummary,
      canManageMembers
    };
  }

  if (!canManageMembers) {
    const currentEssentialStep: FirstValueJourneyStep = 'publish';
    return {
      isEligible: true,
      isLoading: false,
      isCompleted: false,
      currentEssentialStep,
      completedEssentialSteps: 2,
      totalEssentialSteps,
      milestones: buildMilestones(currentEssentialStep, 2, false),
      draftScale: mostRecentDraft,
      hasTeam: false,
      teamState: "unavailable",
      teamSetupSummary: null,
      canManageMembers
    };
  }

  // Only the team-vs-publish branch waits for the users roster.
  if (teamDataStatus === 'idle' || teamDataStatus === 'loading') {
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

  // A users-query failure must not fabricate an empty team or freeze the Dashboard.
  if (teamDataStatus === 'error' || !teamSetupSummary) {
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

  const currentEssentialStep: FirstValueJourneyStep = teamSetupSummary.isTeamConfigured ? 'publish' : 'team';
  const completedEssentialSteps = teamSetupSummary.isTeamConfigured ? 3 : 2;

  return {
    isEligible: true,
    isLoading: false,
    isCompleted: false,
    currentEssentialStep,
    completedEssentialSteps,
    totalEssentialSteps,
    milestones: buildMilestones(currentEssentialStep, completedEssentialSteps, canManageMembers),
    draftScale: mostRecentDraft,
    hasTeam,
    teamState,
    teamSetupSummary,
    canManageMembers
  };
}
