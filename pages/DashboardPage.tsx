import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useMusic } from "../contexts/MusicDataContext";
import { useSuggestionsContext } from "../contexts/SuggestionContext";
import { useHomeExperience } from "../hooks/useHomeExperience";
import { FirstScaleJourneyCard } from "../components/onboarding/FirstScaleJourneyCard";
import { HomeFocusCard } from "../components/dashboard/HomeFocusCard";
import { HomeUpcomingEvents } from "../components/dashboard/HomeUpcomingEvents";
import { HomeSecondaryContent } from "../components/dashboard/HomeSecondaryContent";
import { PlanUsageCompactCard } from "../components/billing/PlanUsageCompactCard";
import Spinner from "../components/common/Spinner";
import { ArrowRight, PlusSquare, RefreshCcw, Search, Calendar } from "lucide-react";
import { SuggestionIcon } from "../components/icons/SuggestionIcon";
import { useModals } from "../contexts/ModalContext";

export const SupportRuntimeInspector = () => {
  const { user, userProfile, organization, permissions, isSupportMode } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!isSupportMode) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[9999]">
      {isOpen ? (
        <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl max-w-sm max-h-[60vh] overflow-y-auto text-xs font-mono">
          <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
            <span className="font-bold text-white text-sm">🕵️ Runtime Inspector</span>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white px-2 py-1 bg-slate-800 rounded">X</button>
          </div>
          
          {organization?.slug === 'support-mode-slug' && (
            <div className="mb-4 bg-amber-500/10 border border-amber-500/50 rounded-lg p-3 text-amber-500">
               <p className="font-bold flex items-center gap-2 mb-1">
                 <span className="text-lg">⚠️</span> ATENÇÃO: DADOS INCOMPLETOS
               </p>
               <p className="leading-relaxed">
                 O documento real desta organização está ausente ou incompleto no Firestore. 
                 Um Tenant Virtual (fallback in-memory) foi criado para evitar a tela quebrada. 
                 <br/><br/>
                 O plano "Pro" exibido aqui não foi salvo no servidor e não afeta o billing do cliente.
               </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <p className="text-slate-400 font-bold mb-1">Organization:</p>
              <pre className="whitespace-pre-wrap break-all text-green-400 bg-slate-950 p-2 rounded">{JSON.stringify(organization, null, 2)}</pre>
            </div>
            <div>
              <p className="text-slate-400 font-bold mb-1">Permissions (Extracted Keys):</p>
              <pre className="whitespace-pre-wrap break-all text-green-400 bg-slate-950 p-2 rounded">{JSON.stringify(permissions ? Object.keys(permissions).filter(k => !!(permissions as any)[k]) : "none", null, 2)}</pre>
            </div>
            <div>
              <p className="text-slate-400 font-bold mb-1">User Profile:</p>
              <pre className="whitespace-pre-wrap break-all text-green-400 bg-slate-950 p-2 rounded">{JSON.stringify(userProfile, null, 2)}</pre>
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

const DashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, organization, isSupportMode, isOwner } = useAuth();
  const { songs, populatedScales, loading: musicLoading } = useMusic();
  const { suggestions, loading: suggestionsLoading } = useSuggestionsContext();
  const { openSongDetail } = useModals();

  const { experience, isLoading: experienceLoading } = useHomeExperience();

  // Secondary content calculations
  const unreadSuggestions = useMemo(() => {
    if (!suggestions) return [];
    return suggestions.filter((s) => !s.isRead && !s.isArchived);
  }, [suggestions]);

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
    
    // count plays
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

  if (experienceLoading || musicLoading || suggestionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="relative isolate max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('dashboard.noOrgTitle', 'Nenhuma organização conectada')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md">
          {t('dashboard.noOrgDesc', 'As organizações e acessos são administrados pelo MillionsNest. Verifique seus convites ou faça login novamente.')}
        </p>
      </div>
    );
  }

  const firstName = user?.displayName?.split(' ')[0] || '';

  return (
    <div className="relative isolate max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-fade-in touch-manipulation">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('dashboard.greeting', 'Olá, {{name}}', { name: firstName })}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          {t('dashboard.subtitle', 'Veja o que precisa da sua atenção hoje.')}
        </p>
      </header>

      {experience.mode === 'first-value' ? (
        <FirstScaleJourneyCard />
      ) : (
        <HomeFocusCard experience={experience} />
      )}

      {experience.mode !== 'first-value' && experience.mode !== 'no-upcoming-event' && experience.mode !== 'create-next-event' && (
        <div className="pt-2">
          <HomeUpcomingEvents events={experience.upcomingEvents} />
        </div>
      )}

      {(unreadSuggestions.length > 0 || recentlyAddedSongs.length > 0 || suggestedForRehearsal.length > 0) && (
        <HomeSecondaryContent>
          {unreadSuggestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h4 className="text-sm font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest">
                  {t("dashboard.pending_suggestions_section", "Sugestões pendentes")}
                </h4>
                <button
                  onClick={() => navigate("/suggestions")}
                  className="text-amber-600 dark:text-amber-500 font-medium text-sm flex items-center gap-1 hover:underline"
                >
                  {t("dashboard.view_all", "Ver todas")} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {unreadSuggestions.slice(0, 3).map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => navigate("/suggestions")}
                    className="w-full text-left bg-white dark:bg-[#1A1A1F] border border-amber-200 dark:border-amber-500/20 rounded-xl p-3 flex items-center gap-3 hover:border-amber-300 dark:hover:border-amber-500/40 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 flex items-center justify-center shrink-0">
                      <SuggestionIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">
                        {suggestion.songs.length === 1
                          ? suggestion.songs[0].title
                          : t("dashboard.songs_suggested_other", "{{count}} músicas sugeridas", { count: suggestion.songs.length })}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {t("dashboard.by_author_suggestion", "Por {{name}}", { name: suggestion.createdBy.name })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentlyAddedSongs.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <PlusSquare className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {t("dashboard.new_songs_section", "Recém adicionadas")}
                </h4>
              </div>
              <div className="space-y-2">
                {recentlyAddedSongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => openSongDetail(song)}
                    className="w-full text-left bg-slate-50 dark:bg-white/[0.02] border border-transparent hover:border-slate-200 dark:hover:border-white/[0.05] rounded-xl p-3 flex flex-col transition-colors"
                  >
                    <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">{song.title}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{song.artist}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {suggestedForRehearsal.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <RefreshCcw className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  {t("dashboard.suggested_rehearsal_section", "Sugeridas para ensaio")}
                </h4>
              </div>
              <div className="space-y-2">
                {suggestedForRehearsal.map((song, i) => (
                  <button
                    key={`${song.id}-${i}`}
                    onClick={() => openSongDetail(song as any)}
                    className="w-full text-left bg-slate-50 dark:bg-white/[0.02] border border-transparent hover:border-slate-200 dark:hover:border-white/[0.05] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">{song.title}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{song.artist}</span>
                    </div>
                    <span className={`self-start sm:self-auto px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${song.tagBg} ${song.tagColor} border`}>
                      {song.reasonCode === "least-played"
                        ? t("dashboard.least_played_reason", "Pouco tocada")
                        : song.reasonCode === "newly-added"
                          ? t("dashboard.newly_added_reason", "Recém-adicionada")
                          : song.reasonCode === "review"
                            ? t("dashboard.review_reason", "Revisar")
                            : song.reasonCode}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </HomeSecondaryContent>
      )}

      {isOwner && (
        <PlanUsageCompactCard />
      )}
      
      <SupportRuntimeInspector />
    </div>
  );
};

export default DashboardPage;
