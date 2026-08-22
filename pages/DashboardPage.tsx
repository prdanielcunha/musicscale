import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useMusic } from '../contexts/MusicDataContext';
import { useHomeExperience } from '../hooks/useHomeExperience';
import { useCapability } from '../hooks/useCapability';
import { useModals } from '../contexts/ModalContext';
import { useToast } from '../contexts/ToastContext';
import { useSuggestionsContext } from '../contexts/SuggestionContext';
import { HomeFocusCard } from '../components/dashboard/HomeFocusCard';
import { HomeUpcomingEvents } from '../components/dashboard/HomeUpcomingEvents';
import { HomeSecondaryContent } from '../components/dashboard/HomeSecondaryContent';
import { FirstScaleJourneyCard } from '../components/onboarding/FirstScaleJourneyCard';
import { PlanUsageCompactCard } from '../components/billing/PlanUsageCompactCard';
import AssignmentResponseActions from '../components/scales/AssignmentResponseActions';
import { Calendar, ArrowRight, MessageSquare as SuggestionIcon, PlusSquare, RefreshCcw } from 'lucide-react';
import type { HomeEventSummary, HomeAttentionItem } from '../utils/homeExperience';
import { resolveHomeAttentionTarget } from '../utils/homeExperience';
import type { EventAssignment, PopulatedScale, PopulatedBandScale, Scale, BandScale } from '../types';


const SupportRuntimeInspector = () => {
  const { user, organization, isSupportMode } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const { permissions } = useAuth();
  const ecoContext = (window as any).__ECOSYSTEM_CONTEXT__;
  
  if (!isSupportMode) return null;
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl max-w-sm w-[90vw] overflow-auto max-h-[80vh]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-amber-500 flex items-center gap-2">
              <span>🛠️ Support Inspector</span>
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <div className="space-y-4 text-xs font-mono">
            <div>
              <p className="text-slate-400 font-bold mb-1">Ecosystem Context:</p>
              <pre className="whitespace-pre-wrap break-all text-amber-400 bg-slate-950 p-2 rounded">{JSON.stringify(ecoContext, null, 2)}</pre>
            </div>
            <div>
              <p className="text-slate-400 font-bold mb-1">Organization:</p>
              <pre className="whitespace-pre-wrap break-all text-blue-400 bg-slate-950 p-2 rounded">{JSON.stringify(organization, null, 2)}</pre>
            </div>
            <div>
              <p className="text-slate-400 font-bold mb-1">Permissions:</p>
              <pre className="whitespace-pre-wrap break-all text-purple-400 bg-slate-950 p-2 rounded">{JSON.stringify(permissions ? Object.keys(permissions).filter(k => !!(permissions as any)[k]) : "none", null, 2)}</pre>
            </div>
            <div>
              <p className="text-slate-400 font-bold mb-1">User Profile:</p>
              <pre className="whitespace-pre-wrap break-all text-green-400 bg-slate-950 p-2 rounded">{JSON.stringify(user, null, 2)}</pre>
            </div>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className={`shadow-lg px-4 py-2 rounded-full font-bold tracking-widest text-[10px] uppercase flex items-center gap-2 transition-all duration-300 ${organization?.slug === 'support-mode-slug' ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
        >
          <span>🛠️ Inspect Support</span>
          {organization?.slug === 'support-mode-slug' && <span>(FALLBACK)</span>}
        </button>
      )}
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, organization, isOwner } = useAuth();
  const { populatedScales, populatedBandScales, songs, loading: musicLoading, error: musicError } = useMusic();
  const { suggestions, loading: suggestionsLoading } = useSuggestionsContext();
  const { openSongDetail, openScaleDetail, openBandScaleDetail, openScaleForm, openBandScaleForm, openAiSongImport } = useModals();
  const { toast } = useToast();
  const { hasCapability } = useCapability();
  const canUsePerformance = hasCapability('musicscale.performance.use');
  const canImportSongs = hasCapability('musicscale.songs.edit');
  
  const { experience, upcomingEvents, isLoading: experienceLoading } = useHomeExperience();

  const canOpenExplorePerformance = Boolean(
    canUsePerformance &&
    experience.event &&
    experience.event.type === 'music' &&
    experience.event.songCount > 0
  );

  const handleExplorePerformance = () => {
    if (canOpenExplorePerformance && experience.event) {
      handleOpenPerformance(experience.event);
      return;
    }
    navigate('/scales');
  };

  // Secondary content calculations (kept as before)
  const unreadSuggestions = useMemo(() => {
    if (suggestionsLoading || !suggestions) return [];
    return suggestions.filter((s) => !s.isRead && !s.isArchived);
  }, [suggestions, suggestionsLoading]);

  const recentlyAddedSongs = useMemo(() => {
    if (!songs) return [];
    return [...songs]
      .sort((a, b) => {
        const getDate = (dateVal: any) => {
          if (!dateVal) return 0;
          if (typeof dateVal === 'string') return new Date(dateVal).getTime();
          if (dateVal.toDate) return dateVal.toDate().getTime();
          if (dateVal.seconds) return dateVal.seconds * 1000;
          return 0;
        };
        return getDate(b.createdAt) - getDate(a.createdAt);
      })
      .slice(0, 3);
  }, [songs]);

  const suggestedForRehearsal = useMemo(() => {
    if (!songs || !populatedScales) return [];
    const counts: Record<string, number> = {};
    populatedScales.forEach((scale) => {
      if (scale.status === 'cancelled') return;
      scale.songs?.forEach((song: any) => {
        counts[song.id] = (counts[song.id] || 0) + 1;
      });
    });
    const withPlayCount = songs.map(s => ({
      ...s,
      playCount: counts[s.id] || 0
    }));
    const result = [];
    const activeSongs = withPlayCount.filter(s => s.status === 'active');
    
    if (activeSongs.length > 5) {
      const leastPlayed = [...activeSongs].sort((a, b) => a.playCount - b.playCount)[0];
      if (leastPlayed && leastPlayed.playCount < 3) {
        result.push({
          ...leastPlayed,
          reasonCode: "least-played",
          tagBg: "bg-blue-500/10 dark:bg-blue-500/20",
          tagColor: "text-blue-600 dark:text-blue-400 border-blue-500/20"
        });
      }
    }
    const recent = recentlyAddedSongs[0];
    if (recent && !result.find(s => s.id === recent.id)) {
      result.push({
        ...recent,
        reasonCode: "newly-added",
        tagBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
        tagColor: "text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      });
    }
    const toReview = activeSongs.find(s => s.playCount > 10 && !result.find(r => r.id === s.id));
    if (toReview) {
      result.push({
        ...toReview,
        reasonCode: "review",
        tagBg: "bg-amber-500/10 dark:bg-amber-500/20",
        tagColor: "text-amber-600 dark:text-amber-400 border-amber-500/20"
      });
    }
    return result.slice(0, 3);
  }, [songs, populatedScales, recentlyAddedSongs]);

  if (experienceLoading || musicLoading) {
    return (
      <div className="relative isolate max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-fade-in" aria-busy="true" aria-label={t('dashboard.loading', 'Carregando...')}>
        <header className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
          <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        </header>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pt-2">
          <div className="lg:col-span-8 xl:col-span-8 space-y-6">
            <div className="h-48 w-full bg-slate-200 dark:bg-slate-800 rounded-3xl animate-pulse"></div>
          </div>
          <div className="lg:col-span-4 xl:col-span-4 space-y-6">
            <div className="h-32 w-full bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (musicError) return <div>{t('updates.error', 'Ocorreu um erro')}</div>;
  if (!organization) {
    return (
      <div className="relative isolate max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('dashboard.noOrgTitle')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md">
          {t('dashboard.noOrgDesc')}
        </p>
      </div>
    );
  }

  const handleOpenEvent = (eventSummary: HomeEventSummary) => {
    if (eventSummary.type === 'music') {
      const scale = populatedScales?.find(s => s.id === eventSummary.id);
      if (scale) openScaleDetail(scale as PopulatedScale);
    } else {
      const scale = populatedBandScales?.find(s => s.id === eventSummary.id);
      if (scale) openBandScaleDetail(scale as PopulatedBandScale);
    }
  };

  const handleOpenPerformance = (eventSummary: HomeEventSummary) => {
    if (eventSummary.type === 'music') {
      const scale = populatedScales?.find(s => s.id === eventSummary.id);
      if (scale && scale.songs && scale.songs.length > 0) {
        openSongDetail(
          scale.songs[0],
          true,
          { songs: scale.songs, currentIndex: 0 },
          true
        );
      }
    }
  };

  const handleResolveAttention = (eventSummary: HomeEventSummary, firstAttentionItem?: HomeAttentionItem) => {
    const firstAttention = firstAttentionItem || experience.attentionItems?.[0];
    if (!firstAttention) {
      handleOpenEvent(eventSummary);
      return;
    }

    let musicScale: any = undefined;
    let linkedBandScale: any = undefined;

    if (eventSummary.type === 'music') {
      musicScale = populatedScales?.find(s => s.id === eventSummary.id);
      if (musicScale?.bandScaleId) {
        linkedBandScale = populatedBandScales?.find(b => b.id === musicScale.bandScaleId);
      }
    } else if (eventSummary.type === 'band') {
      linkedBandScale = populatedBandScales?.find(b => b.id === eventSummary.id);
    }

    const runFallback = (reason: string) => {
      console.warn(`[AttentionResolutionWarning] Fallback triggered. Reason: ${reason}. Event ID: ${eventSummary.id}`);
      toast({
        type: 'error',
        message: t(
          'dashboard.attention.fallbackMessage',
          'Não foi possível abrir a edição diretamente. Revise os detalhes da escala.'
        )
      });
      handleOpenEvent(eventSummary);
    };

    if (!hasCapability('musicscale.scales.manage')) {
      runFallback('User lacks musicscale.scales.manage capability');
      return;
    }

    if (eventSummary.type === 'music' && !musicScale) {
      runFallback('Music scale not found in populatedScales');
      return;
    }
    if (eventSummary.type === 'band' && !linkedBandScale) {
      runFallback('Band scale not found in populatedBandScales');
      return;
    }

    const target = resolveHomeAttentionTarget({
      event: eventSummary,
      attentionItem: firstAttention,
      musicScale,
      linkedBandScale,
    });

    if (!target || !target.action) {
      runFallback('Target or action could not be resolved');
      return;
    }

    switch (target.action) {
      case 'edit-music-scale': {
        if (musicScale) {
          openScaleForm(musicScale as Scale, undefined, {
            initialStep: target.step,
            focusTarget: target.focusTarget,
          });
        } else {
          runFallback('Music scale missing during action edit-music-scale');
        }
        break;
      }
      case 'edit-band-scale': {
        if (linkedBandScale) {
          openBandScaleForm(linkedBandScale as BandScale, undefined, {
            initialStep: target.step,
            focusTarget: target.focusTarget,
          });
        } else {
          runFallback('Linked band scale missing during action edit-band-scale');
        }
        break;
      }
      case 'open-music-scale-details': {
        if (musicScale) {
          openScaleDetail(musicScale as PopulatedScale);
        } else {
          runFallback('Music scale missing during action open-music-scale-details');
        }
        break;
      }
      case 'open-band-scale-details': {
        if (linkedBandScale) {
          openBandScaleDetail(linkedBandScale as PopulatedBandScale);
        } else {
          runFallback('Linked band scale missing during action open-band-scale-details');
        }
        break;
      }
      default:
        handleOpenEvent(eventSummary);
    }
  };

  const getResponseActions = (eventSummary: HomeEventSummary | null) => {
    if (!eventSummary || eventSummary.type !== 'music') return null;
    const scale = populatedScales?.find(s => s.id === eventSummary.id);
    if (!scale) return null;

    const userAssignments = ((scale as any).eventAssignments || []).filter((a: EventAssignment) => a.userId === user?.uid && a.active !== false);
    if (userAssignments.length === 0) return null;

    const eventStart = new Date(`${eventSummary.date}T${eventSummary.time || '00:00'}:00`);

    return (
      <AssignmentResponseActions
        musicScaleId={scale.id}
        assignments={userAssignments}
        eventStart={eventStart}
        compact={true}
      />
    );
  };

  const firstName = user?.displayName?.split(' ')[0] || '';

  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';
  const getContextualGreeting = () => {
    const today = new Date();
    const todayWeekday = today.toLocaleDateString(locale, { weekday: 'long' });
    const capitalizedTodayWeekday = todayWeekday.charAt(0).toUpperCase() + todayWeekday.slice(1);
    
    let title = t('dashboard.greeting', { name: firstName });
    let subtitle = t('dashboard.subtitle', 'Veja o que precisa da sua atenção hoje.');

    if (experience.mode === 'assigned-event' && experience.event) {
      const eventDateStr = experience.event.date;
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      
      if (eventDateStr === todayStr) {
         title = t('dashboard.greetings.assigned_today_title', { name: firstName });
         subtitle = t('dashboard.greetings.assigned_today_subtitle');
      } else {
         const target = new Date(eventDateStr + 'T12:00:00');
         const tomorrow = new Date(today);
         tomorrow.setDate(tomorrow.getDate() + 1);
         const tomorrowStr = tomorrow.getFullYear() + '-' + String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrow.getDate()).padStart(2, '0');

         if (eventDateStr === tomorrowStr) {
           title = t('dashboard.greetings.assigned_tomorrow_title', { name: firstName });
           subtitle = t('dashboard.greetings.assigned_tomorrow_subtitle');
         } else {
           const weekday = target.toLocaleDateString(locale, { weekday: 'long' });
           const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
           title = t('dashboard.greetings.assigned_future_title', { weekday: capitalized, name: firstName });
           subtitle = t('dashboard.greetings.assigned_future_subtitle', { targetWeekday: weekday });
         }
      }
    } else if (experience.mode === 'leader-attention' || experience.mode === 'leader-prepared') {
      const eventDateStr = experience.event?.date;
      const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      
      if (eventDateStr === todayStr) {
         title = t('dashboard.greetings.leader_today_title', { name: firstName });
         subtitle = t('dashboard.greetings.leader_today_subtitle');
      } else {
         title = t('dashboard.greetings.leader_future_title', { weekday: capitalizedTodayWeekday, name: firstName });
         subtitle = t('dashboard.greetings.leader_future_subtitle');
      }
    } else if (experience.mode === 'continue-draft') {
      title = t('dashboard.greetings.draft_title', { name: firstName });
      subtitle = t('dashboard.greetings.draft_subtitle');
    }

    return { title, subtitle };
  };

  const { title: contextualTitle, subtitle: contextualSubtitle } = getContextualGreeting();


  return (
    <div className="relative isolate max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24 sm:pt-8 sm:pb-12 lg:pb-8 space-y-6 sm:space-y-8 animate-fade-in touch-manipulation">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {contextualTitle}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base mt-1">
          {contextualSubtitle}
        </p>
      </header>

      {experience.mode === 'first-value' ? (
        <FirstScaleJourneyCard />
      ) : (
        <HomeFocusCard 
          experience={experience} 
          canUsePerformance={canUsePerformance}
          responseActions={getResponseActions(experience.event)}
          onOpenEvent={handleOpenEvent}
          onOpenPerformance={handleOpenPerformance}
          onCreateScale={() => {
            if (!hasCapability('musicscale.scales.manage')) {
              toast({ type: 'error', message: t('dashboard.attention.fallbackMessage', 'Não foi possível abrir a edição diretamente. Revise os detalhes da escala.') });
              return;
            }
            openScaleForm();
          }}
          onChooseScaleToRepeat={() => navigate('/scales')}
          onResolveAttention={handleResolveAttention}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        {experience.mode !== 'first-value' && experience.mode !== 'no-upcoming-event' && experience.mode !== 'create-next-event' && (
          <div className="pt-2">
            <HomeUpcomingEvents events={upcomingEvents} onOpenEvent={handleOpenEvent} />
          </div>
        )}
      </div>

      <div className="pt-2">
        <HomeSecondaryContent
          onOpenLibrary={() => navigate('/library')}
          onOpenAiImport={openAiSongImport}
          onOpenPerformance={handleExplorePerformance}
          canImportSongs={canImportSongs}
          canOpenPerformance={canOpenExplorePerformance}
        >
          {unreadSuggestions.length > 0 && (
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-white/[0.05] p-4 shadow-sm flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/15 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-500">
                    <SuggestionIcon className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                    {t("dashboard.secondaryContent.pending_suggestions_section")}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/suggestions")}
                  className="text-amber-600 dark:text-amber-500 font-medium text-xs flex items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded px-1"
                >
                  {t("dashboard.viewAll")} <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex flex-col">
                {unreadSuggestions.slice(0, 3).map((suggestion, i) => (
                  <div key={suggestion.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => navigate("/suggestions")}
                      className="w-full text-left py-2.5 px-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] active:bg-slate-100 dark:active:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 min-h-[44px]"
                    >
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">
                          {suggestion.songs.length === 1
                            ? suggestion.songs[0].title
                            : t("dashboard.secondaryContent.songs_suggested_other", { count: suggestion.songs.length })}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {t("dashboard.secondaryContent.by_author_suggestion", { name: suggestion.createdBy.name })}
                        </p>
                      </div>
                    </button>
                    {i !== Math.min(unreadSuggestions.length, 3) - 1 && <div className="h-px bg-slate-100 dark:bg-slate-800/60 mx-3 my-0.5" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentlyAddedSongs.length > 0 && (
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-white/[0.05] p-4 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/15 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-500">
                  <PlusSquare className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {t("dashboard.secondaryContent.new_songs_section")}
                </h4>
              </div>
              <div className="flex flex-col">
                {recentlyAddedSongs.map((song, i) => (
                  <div key={song.id} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => openSongDetail(song)}
                      className="w-full text-left py-2.5 px-3 rounded-xl flex items-center gap-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] active:bg-slate-100 dark:active:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[44px]"
                    >
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">{song.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{song.artist}</p>
                      </div>
                    </button>
                    {i !== recentlyAddedSongs.length - 1 && <div className="h-px bg-slate-100 dark:bg-slate-800/60 mx-3 my-0.5" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestedForRehearsal.length > 0 && (
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-white/[0.05] p-4 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/15 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                  <RefreshCcw className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {t("dashboard.secondaryContent.suggested_rehearsal_section")}
                </h4>
              </div>
              <div className="flex flex-col">
                {suggestedForRehearsal.map((song, i) => (
                  <div key={`${song.id}-${i}`} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => openSongDetail(song as any)}
                      className="w-full text-left py-2.5 px-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] active:bg-slate-100 dark:active:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[44px]"
                    >
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="font-semibold text-[15px] text-slate-900 dark:text-white truncate">{song.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{song.artist}</p>
                      </div>
                      <span className={`self-start sm:self-auto px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${song.tagBg} ${song.tagColor} border border-transparent mt-1 sm:mt-0`}>
                        {song.reasonCode === "least-played"
                          ? t("dashboard.secondaryContent.least_played_reason")
                          : song.reasonCode === "newly-added"
                            ? t("dashboard.secondaryContent.newly_added_reason")
                            : song.reasonCode === "review"
                              ? t("dashboard.secondaryContent.review_reason")
                              : song.reasonCode}
                      </span>
                    </button>
                    {i !== suggestedForRehearsal.length - 1 && <div className="h-px bg-slate-100 dark:bg-slate-800/60 mx-3 my-0.5" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </HomeSecondaryContent>
      </div>

      {isOwner && (
        <div className="pt-4">
          <PlanUsageCompactCard />
        </div>
      )}
      
      <SupportRuntimeInspector />
    </div>
  );
};

export default DashboardPage;
