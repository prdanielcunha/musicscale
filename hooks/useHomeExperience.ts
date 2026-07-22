import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useMusic } from '../contexts/MusicDataContext';
import { useFirstScaleExperience } from './useFirstScaleExperience';
import { useCapability } from './useCapability';
import { evaluateHomeExperience, HomeEventSummary } from '../utils/homeExperience';

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

    // Combine scales and bandScales
    const allEvents = [
      ...(populatedScales || []).map(s => ({ ...s, eventTypeObj: 'music' as const })),
      ...(populatedBandScales || []).map(s => ({ ...s, eventTypeObj: 'band' as const }))
    ];

    // Filter upcoming (not cancelled)
    const now = new Date();
    // Normalizing today at midnight to avoid timezone date shifts if needed
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const validEvents = allEvents.filter(e => {
      if ((e as any).status === 'cancelled') return false;
      const dateStr = (e as any).date;
      if (!dateStr) return false;
      const eventDate = new Date(dateStr);
      return eventDate >= today;
    });

    // Sort by date and time
    validEvents.sort((a, b) => {
      const dateA = (a as any).date || '';
      const dateB = (b as any).date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const timeA = (a as any).time || '23:59';
      const timeB = (b as any).time || '23:59';
      return timeA.localeCompare(timeB);
    });

    const toEventSummary = (e: any): HomeEventSummary => {
      // Find user assignments
      const userAssignments = e.assignments ? e.assignments.filter((a: any) => a.userId === user?.uid && a.status === 'active') : [];
      const userFunctionNames = userAssignments.map((a: any) => a.roleName || a.instrumentName || 'Integrante').filter(Boolean);
      
      const teamCount = e.assignments ? e.assignments.filter((a: any) => a.status === 'active').length : 0;
      const songCount = e.songs ? e.songs.length : 0;

      return {
        id: e.id,
        type: e.eventTypeObj,
        title: e.eventName || 'Evento sem título',
        date: e.date,
        time: e.time,
        locationName: e.locationName,
        songCount,
        teamCount,
        status: e.status,
        userFunctionNames,
        isUserAssigned: userAssignments.length > 0,
      };
    };

    const upcomingEvents = validEvents.map(toEventSummary);

    // Find most recent draft
    let mostRecentDraft: HomeEventSummary | null = null;
    const drafts = allEvents.filter(e => (e as any).status === 'draft');
    if (drafts.length > 0) {
      drafts.sort((a, b) => {
        const updateA = (a as any).lastModifiedAt || (a as any).createdAt || (a as any).updatedAt;
        const updateB = (b as any).lastModifiedAt || (b as any).createdAt || (b as any).updatedAt;
        const tA = updateA ? new Date(updateA).getTime() : 0;
        const tB = updateB ? new Date(updateB).getTime() : 0;
        return tB - tA; // Descending
      });
      mostRecentDraft = toEventSummary(drafts[0]);
    }

    const homeExperience = evaluateHomeExperience({
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
  }, [user, populatedScales, populatedBandScales, firstScaleExperience, canManageScales]);
}
