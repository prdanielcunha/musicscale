import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMusic } from '../contexts/MusicDataContext';
import { useFirstScaleExperience } from './useFirstScaleExperience';
import { useCapability } from './useCapability';
import { 
  evaluateHomeExperience, 
  buildHomeEventSummaries, 
  selectMostRecentDraft, 
  HomeEventSummary 
} from '../utils/homeExperience';
import type { PopulatedScaleWithAssignmentsAndStatus, PopulatedBandScaleWithStatus } from '../utils/homeExperience';

export function useHomeExperience() {
  const { user } = useAuth();
  const { populatedScales, populatedBandScales } = useMusic();
  const firstScaleExperience = useFirstScaleExperience();
  const { hasCapability } = useCapability();
  const canManageScales = hasCapability('musicscale.scales.manage');

  return useMemo(() => {
    const isFirstValueJourneyActive =
      firstScaleExperience &&
      !firstScaleExperience.isLoading &&
      firstScaleExperience.isEligible &&
      !firstScaleExperience.isCompleted &&
      Boolean(firstScaleExperience.currentEssentialStep);

    // REQUISITO 11: Não adicionar upcomingEvents ao modelo HomeExperience. Retornar no hook.
    // REQUISITO 5, 7, 9, 10: Usa os helpers puros
    
    const musicScales = (populatedScales || []) as PopulatedScaleWithAssignmentsAndStatus[];
    const bandScales = (populatedBandScales || []) as PopulatedBandScaleWithStatus[];
    
    const upcomingEvents = buildHomeEventSummaries(musicScales, bandScales, user?.uid);
    const mostRecentDraft = selectMostRecentDraft(musicScales, bandScales, user?.uid);

    console.log("Upcoming events built:", upcomingEvents); const homeExperience = evaluateHomeExperience({
      isFirstValueJourneyActive: !!isFirstValueJourneyActive,
      canManageScales,
      upcomingEvents,
      mostRecentDraft,
      currentUserId: user?.uid,
    });

    return {
      upcomingEvents,
      experience: homeExperience,
      isLoading: firstScaleExperience?.isLoading,
    };
  }, [user?.uid, populatedScales, populatedBandScales, firstScaleExperience, canManageScales]);
}
