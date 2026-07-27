import { UserProfile, Scale, Song } from '../types';
import { evaluateTeamSetup, TeamSetupSummary } from './teamSetup';

export type FirstValueJourneyTeamState = "empty" | "incomplete" | "ready" | "unavailable";

export interface MinimalJourneyScale {
  id: string;
  status?: 'draft' | 'published' | 'cancelled' | 'completed' | string;
  date?: string;
  createdAt?: string | number | { toMillis?: () => number };
  updatedAt?: string | number | { toMillis?: () => number };
  lastModifiedAt?: string | number | { toMillis?: () => number };
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
}

export interface FirstValueJourneyMilestone {
  id: string;
  status: 'completed' | 'current' | 'pending' | 'optional';
}

export interface MinimalDraftScale {
  id: string;
  status?: string;
  date?: string;
  createdAt?: string | number | { toMillis?: () => number };
  updatedAt?: string | number | { toMillis?: () => number };
}

export interface FirstValueJourneyOutput {
  isEligible: boolean;
  isLoading: boolean;
  isCompleted: boolean;
  currentEssentialStep: 'repertoire' | 'firstScale' | 'team' | 'publish' | null;
  completedEssentialSteps: number;
  totalEssentialSteps: number;
  milestones: FirstValueJourneyMilestone[];
  draftScale: MinimalDraftScale | null;
  hasTeam: boolean;
  teamState: FirstValueJourneyTeamState;
  teamSetupSummary: TeamSetupSummary | null;
  canManageMembers: boolean;
}

export function evaluateFirstValueJourney(input: FirstValueJourneyInput): FirstValueJourneyOutput {
  const { songs, scales, allUsers, canEditScales, canCreateSongs, canManageMembers, organizationId, loading, currentUserId } = input;
  
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
  const sortedDrafts = drafts.sort((a, b) => {
    const getTime = (val: any) => val && typeof val.toMillis === 'function' ? val.toMillis() : (val ? new Date(val).getTime() : 0);
    const timeA = getTime(a.updatedAt) || getTime(a.createdAt) || (a.date ? new Date(a.date).getTime() : 0);
    const timeB = getTime(b.updatedAt) || getTime(b.createdAt) || (b.date ? new Date(b.date).getTime() : 0);
    return timeB - timeA;
  });

  const mostRecentDraft = sortedDrafts[0] || null;

  const usersArray = Array.isArray(allUsers) ? allUsers : [];
  const teamSetupSummary = evaluateTeamSetup(usersArray, currentUserId);
  
  const hasTeam = teamSetupSummary.additionalMembers > 0;

  let teamState: FirstValueJourneyTeamState = "empty";
  if (!canManageMembers) {
    teamState = "unavailable";
  } else if (teamSetupSummary.isTeamConfigured) {
    teamState = "ready";
  } else if (teamSetupSummary.additionalMembers > 0 && teamSetupSummary.configuredMembers === 0) {
    teamState = "incomplete";
  } else if (teamSetupSummary.additionalMembers > 0 && teamSetupSummary.configuredMembers > 0) {
    // There's at least one configured member (so isTeamConfigured is true), but the else-if logic
    // actually already matched `isTeamConfigured` above! Wait... evaluateTeamSetup sets isTeamConfigured = true
    // if configuredMembers > 0. So if additionalMembers > 0 and configuredMembers === 0, it's incomplete.
    // If it reaches this block, it must be something else... but it's logically exhausted.
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

  let currentEssentialStep: 'repertoire' | 'firstScale' | 'team' | 'publish' = 'repertoire';
  let completedEssentialSteps = 0;

  if (!hasSongs) {
    currentEssentialStep = 'repertoire';
    completedEssentialSteps = 0;
  } else if (!hasValidScales) {
    currentEssentialStep = 'firstScale';
    completedEssentialSteps = 1;
  } else if (canManageMembers && !teamSetupSummary.isTeamConfigured) {
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
