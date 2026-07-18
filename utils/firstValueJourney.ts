export interface FirstValueJourneyInput {
  songs: any[] | null | undefined;
  scales: any[] | null | undefined;
  allUsers: any[] | null | undefined;
  canEditScales: boolean;
  canCreateSongs: boolean;
  canManageMembers: boolean;
  organizationId: string | undefined;
  loading: boolean;
}

export interface FirstValueJourneyMilestone {
  id: string;
  status: 'completed' | 'current' | 'pending' | 'optional';
}

export interface FirstValueJourneyOutput {
  isEligible: boolean;
  isLoading: boolean;
  isCompleted: boolean;
  currentEssentialStep: 'repertoire' | 'firstScale' | 'publish' | null;
  completedEssentialSteps: number;
  totalEssentialSteps: number;
  milestones: FirstValueJourneyMilestone[];
  draftScale: any | null;
  hasTeam: boolean;
}

export function evaluateFirstValueJourney(input: FirstValueJourneyInput): FirstValueJourneyOutput {
  const { songs, scales, allUsers, canEditScales, canCreateSongs, canManageMembers, organizationId, loading } = input;

  const totalEssentialSteps = 3;

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
      hasTeam: false
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
      hasTeam: false
    };
  }

  const hasSongs = Array.isArray(songs) && songs.length > 0;
  
  const validScales = Array.isArray(scales) ? scales.filter(s => s.status !== 'cancelled') : [];
  const hasValidScales = validScales.length > 0;
  
  const hasPublishedScale = validScales.some(s => s.status === 'published' || !s.status);
  
  const drafts = validScales.filter(s => s.status === 'draft');
  const sortedDrafts = drafts.sort((a, b) => {
    const timeA = (a.updatedAt?.toMillis ? a.updatedAt.toMillis() : a.updatedAt) || (a.createdAt?.toMillis ? a.createdAt.toMillis() : a.createdAt) || (a.date ? new Date(a.date).getTime() : 0);
    const timeB = (b.updatedAt?.toMillis ? b.updatedAt.toMillis() : b.updatedAt) || (b.createdAt?.toMillis ? b.createdAt.toMillis() : b.createdAt) || (b.date ? new Date(b.date).getTime() : 0);
    return timeB - timeA;
  });
  const mostRecentDraft = sortedDrafts[0] || null;

  const hasTeam = Array.isArray(allUsers) && allUsers.length > 1;

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
      hasTeam
    };
  }

  let currentEssentialStep: 'repertoire' | 'firstScale' | 'publish' = 'repertoire';
  let completedEssentialSteps = 0;

  if (!hasSongs) {
    currentEssentialStep = 'repertoire';
    completedEssentialSteps = 0;
  } else if (!hasValidScales) {
    currentEssentialStep = 'firstScale';
    completedEssentialSteps = 1;
  } else {
    currentEssentialStep = 'publish';
    completedEssentialSteps = 2;
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
      status: hasTeam ? 'completed' : 'optional'
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
    hasTeam
  };
}
