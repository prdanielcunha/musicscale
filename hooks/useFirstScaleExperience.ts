import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMusic } from '../contexts/MusicDataContext';
import { useCapability } from './useCapability';
import { evaluateFirstValueJourney, FirstValueJourneyOutput } from '../utils/firstValueJourney';

export function useFirstScaleExperience(): FirstValueJourneyOutput {
  const { organization, user } = useAuth();
  const { songs, scales, allUsers, loading } = useMusic();
  const { hasCapability } = useCapability();
  const canEditScales = hasCapability('musicscale.scales.manage');
  const canManageMembers = hasCapability('musicscale.members.manage');
  const canCreateSongs = hasCapability('musicscale.songs.edit');

  const [state, setState] = useState<FirstValueJourneyOutput>({
    isEligible: false,
    isLoading: true,
    isCompleted: false,
    currentEssentialStep: null,
    completedEssentialSteps: 0,
    totalEssentialSteps: 4,
    milestones: [],
    draftScale: null,
    hasTeam: false,
    teamState: "empty",
    teamSetupSummary: null,
    canManageMembers
  });

  useEffect(() => {
    const result = evaluateFirstValueJourney({
      songs,
      scales,
      allUsers,
      canEditScales,
      canCreateSongs,
      canManageMembers,
      organizationId: organization?.id,
      loading: loading || !user,
      currentUserId: user?.uid
    });
    setState(result);
  }, [songs, scales, allUsers, canEditScales, canCreateSongs, canManageMembers, organization?.id, user, loading]);

  return state;
}
