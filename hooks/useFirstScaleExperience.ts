import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMusic } from '../contexts/MusicDataContext';
import { useCapability } from './useCapability';

export type OnboardingState = 
  | 'needsStarterRepertoire'
  | 'needsFirstScale'
  | 'needsPublish'
  | 'needsTeam'
  | 'completed'
  | 'loading';

export function useFirstScaleExperience() {
  const { organization, user } = useAuth();
  const { songs, scales, allUsers, loading } = useMusic();
  const { hasCapability } = useCapability();

  const canEditScales = hasCapability('musicscale.scales.manage');
  const canManageMembers = hasCapability('musicscale.members.manage');
  const canCreateSongs = hasCapability('musicscale.songs.edit');
  
  const [state, setState] = useState<OnboardingState>('loading');

  useEffect(() => {
    if (!organization || !user || loading) {
      setState('loading');
      return;
    }

    if (!canEditScales || !canCreateSongs) {
      setState('completed');
      return;
    }

    const hasSongs = songs && songs.length > 0;
    const hasScales = scales && scales.length > 0;
    const hasPublishedScale = scales && scales.some(s => s.status === 'published');
    const hasTeam = allUsers && allUsers.length > 1;

    const dismissedTeamKey = `musicscale_first_scale_v1_team_dismissed_${user.uid}_${organization.id}`;
    const dismissedTeam = localStorage.getItem(dismissedTeamKey) === 'true';

    if (hasPublishedScale) {
      setState('completed');
    } else if (!hasSongs) {
      setState('needsStarterRepertoire');
    } else if (!hasTeam && !dismissedTeam && canManageMembers) {
      setState('needsTeam');
    } else if (!hasScales) {
      setState('needsFirstScale');
    } else {
       setState('needsPublish');
    }
  }, [organization, user, songs, scales, allUsers, loading, canEditScales, canCreateSongs, canManageMembers]);

  const dismissTeamStep = () => {
     if (user && organization) {
       localStorage.setItem(`musicscale_first_scale_v1_team_dismissed_${user.uid}_${organization.id}`, 'true');
       setState(prev => prev === 'needsTeam' ? 'needsFirstScale' : prev);
     }
  };

  return {
    state,
    isLoading: state === 'loading',
    isCompleted: state === 'completed',
    dismissTeamStep
  };
}
