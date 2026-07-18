import { FirstScaleJourneyCard } from '../components/onboarding/FirstScaleJourneyCard';
import { useFirstScaleExperience } from "../hooks/useFirstScaleExperience";
import React, { useMemo, useState, useEffect } from "react";
import { useMusic } from "../contexts/MusicDataContext";
import { useAuth } from "../contexts/AuthContext";
import { useModals } from "../contexts/ModalContext";
import { useSuggestionsContext } from "../contexts/SuggestionContext";
import Spinner from "../components/common/Spinner";
import Card from "../components/common/Card";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import Button from "../components/common/Button";

import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { PlanUsageCompactCard } from "../components/billing/PlanUsageCompactCard";
import { useMusicScaleEntitlements, useMusicScaleFeature } from "../hooks/useMusicScaleEntitlements";
import { Can } from "../components/auth/Can";
import AddToCalendarButton from "../components/common/AddToCalendarButton";
import { getScaleTitle } from "../utils/scaleHelper";
import AssignmentResponseActions from "../components/scales/AssignmentResponseActions";

// Icons
import { RepertoireIcon } from "../components/icons/RepertoireIcon";
import { CalendarIcon } from "../components/icons/CalendarIcon";
import { SparklesIcon } from "../components/icons/SparklesIcon";
import { UserCheckIcon } from "../components/icons/UserCheckIcon";
import { SuggestionIcon } from "../components/icons/SuggestionIcon";
import { CalendarDaysIcon } from "../components/icons/CalendarDaysIcon";
import { BookOpenIcon } from "../components/icons/BookOpenIcon";
import {
  ArrowRight,
  Play,
  Plus,
  Search,
  Users,
  Music,
  Calendar,
  Clock,
  TrendingUp,
  Moon,
  PlusSquare,
  RefreshCcw,
  Edit2,
  Trash,
  Copy,
} from "lucide-react";

const parseDateOnlyLocal = (dateValue?: string | null): Date | null => {
  if (!dateValue || typeof dateValue !== "string") return null;
  const [yearStr, monthStr, dayStr] = dateValue.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return new Date(year, month - 1, day);
};

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
  const { toast, removeToast } = useToast();
  const { user, organization, isSupportMode } = useAuth();
  const journey = useFirstScaleExperience();
  const [notifiedUser, setNotifiedUser] = useState(false);
  const {
    songs,
    scales,
    bandScales,
    populatedScales,
    populatedBandScales,
    loading: musicLoading,
  } = useMusic();
  const { openScaleForm, openScaleDetail, openBandScaleForm, openBandScaleDetail, openSongDetail, openSongForm } =
    useModals();
  const { suggestions, loading: suggestionsLoading } = useSuggestionsContext();
  const isScaleCloningAllowed = useMusicScaleFeature('scaleCloning');
  const navigate = useNavigate();

  // Progress checks
  const hasSongs = songs && songs.length > 0;
  const hasScales = populatedScales && populatedScales.length > 0;
  const hasTeam = populatedBandScales && populatedBandScales.length > 0; // rough proxy for team
  const isCompletelyEmpty = !hasSongs && !hasScales;

  const [activeScaleTab, setActiveScaleTab] = useState<"all" | "mine">("all");

  const unreadSuggestions = useMemo(() => {
    if (!suggestions) return [];
    return suggestions.filter((s) => !s.isRead && !s.isArchived);
  }, [suggestions]);

  const allUniqueEvents = useMemo(() => {
    if (!populatedScales && !populatedBandScales) return [];
    
    const map = new Map<string, any>();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    populatedScales?.forEach((s) => {
      if (s.status === 'cancelled') return;
      if (new Date(s.date + "T00:00:00") >= now) {
        map.set(s.id, { ...s, type: 'music' });
      }
    });

    populatedBandScales?.forEach((b) => {
      if (b.date && new Date(b.date + "T00:00:00") >= now) {
        if (b.musicScaleId) {
          const parentScale = populatedScales?.find(ps => ps.id === b.musicScaleId);
          if (!parentScale || parentScale.status === 'cancelled') {
             // Parent music scale was deleted or cancelled - do not display this band scale
             return;
          }
          if (map.has(b.musicScaleId)) {
             // covered by parent music scale
             return;
          }
        }
        
        // Add standalone or un-mapped band scale
        map.set(b.id, {
          id: b.id,
          date: b.date,
          observations: b.observations,
          songs: [],
          eventType: b.eventType,
          location: b.location,
          bandScaleId: b.id,
          bandScale: b,
          type: 'band'
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      const timeA = a.time || "00:00";
      const timeB = b.time || "00:00";
      return `${dateA}T${timeA}`.localeCompare(`${dateB}T${timeB}`);
    });
  }, [populatedScales, populatedBandScales]);

  const upcomingScales = allUniqueEvents;
  const nextUpcomingScale = upcomingScales[0] || null;
  const nextThreeScales = upcomingScales.slice(0, 4); // show up to 4 events, including the first one so it's not hidden from the list

  // User's own scheduled scales (upcoming)
  const userUpcomingScales = useMemo(() => {
    if (!allUniqueEvents || !user) return [];

    return allUniqueEvents
      .filter((scale) => {
        // Check new eventAssignments on MusicScale first
        if (scale.type === 'music' && scale.eventAssignments && scale.eventAssignments.length > 0) {
          return scale.eventAssignments.some((assign: any) => assign.userId === user.uid && assign.active !== false);
        }

        const bs = scale.bandScale || populatedBandScales?.find((b: any) => b.musicScaleId === scale.id || b.id === scale.bandScaleId);
        if (!bs) return false;

        return bs.assignments?.some(
          (assign: any) => assign.user?.uid === user.uid
        );
      });
  }, [allUniqueEvents, populatedBandScales, user]);

  const nextUserUpcomingScale = userUpcomingScales[0] || null;

  const userRoleInNextScale = useMemo(() => {
    if (!nextUserUpcomingScale || !user) return null;

    if (nextUserUpcomingScale.type === 'music' && nextUserUpcomingScale.eventAssignments && nextUserUpcomingScale.eventAssignments.length > 0) {
      const myAssignments = nextUserUpcomingScale.eventAssignments.filter((a: any) => a.userId === user.uid && a.active !== false);
      if (myAssignments.length > 0) {
        return myAssignments.map((a: any) => a.functionName).join(', ');
      }
    }

    const bs = nextUserUpcomingScale.bandScale || populatedBandScales?.find(b => b.musicScaleId === nextUserUpcomingScale.id || b.id === nextUserUpcomingScale.bandScaleId);
    if (!bs) return null;
    const myAssignment = bs.assignments?.find(assign => assign.user?.uid === user.uid);
    return myAssignment?.instrument?.name || null;
  }, [nextUserUpcomingScale, populatedBandScales, user]);

  const filteredScalesToShow = useMemo(() => {
    if (activeScaleTab === "mine") {
      return userUpcomingScales;
    }
    return nextThreeScales;
  }, [activeScaleTab, userUpcomingScales, nextThreeScales]);

  const getMyRoleForScale = (scale: any) => {
    if (!user) return null;

    if (scale.type === 'music' && scale.eventAssignments && scale.eventAssignments.length > 0) {
      const myAssignments = scale.eventAssignments.filter((a: any) => a.userId === user.uid && a.active !== false);
      if (myAssignments.length > 0) {
        return myAssignments.map((a: any) => a.functionName).join(', ');
      }
    }

    const bs = scale.bandScale || populatedBandScales?.find(b => b.musicScaleId === scale.id || b.id === scale.bandScaleId);
    if (!bs) return null;
    const assign = bs.assignments?.find(a => a.user?.uid === user.uid);
    return assign?.instrument?.name || null;
  };

  const daysUntilNextScale = useMemo(() => {
    if (!nextUpcomingScale) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const eventDate = new Date(nextUpcomingScale.date + "T00:00:00");
    const diffTime = eventDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [nextUpcomingScale]);

  const recentlyAddedSongs = useMemo(() => {
    if (!songs) return [];
    return [...songs]
      .sort((a, b) => {
        const getDate = (dateVal: any) => {
          if (!dateVal) return 0;
          if (typeof dateVal === "string") return new Date(dateVal).getTime();
          if (dateVal.toMillis) return dateVal.toMillis();
          if (dateVal instanceof Date) return dateVal.getTime();
          return 0;
        };
        return getDate(b.createdAt) - getDate(a.createdAt);
      })
      .slice(0, 5);
  }, [songs]);

  const lastPlayedSongsList = useMemo(() => {
    if (!populatedScales) return [];
    const pastScales = [...populatedScales].filter(s => new Date(s.date + 'T00:00:00') <= new Date()).sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      const timeA = a.time || "00:00";
      const timeB = b.time || "00:00";
      return `${dateB}T${timeB}`.localeCompare(`${dateA}T${timeA}`);
    });
    const list: any[] = [];
    pastScales.forEach(scale => {
       scale.songs.forEach(song => {
          if(!list.find(s => s.id === song.id)) {
              list.push({...song, lastPlayed: scale.date});
          }
       })
    });
    return list.slice(0, 5);
  }, [populatedScales]);

  const suggestedForRehearsal = useMemo(() => {
    if (!songs || !populatedScales) return [];
    
    // count plays
    const counts: Record<string, number> = {};
    populatedScales.forEach((scale) => {
      if (new Date(scale.date + "T00:00:00") <= new Date()) {
        scale.songs.forEach((song) => {
          counts[song.id] = (counts[song.id] || 0) + 1;
        });
      }
    });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recent = [...songs].filter((s) => {
      const dateVal = s.createdAt as any;
      let time = 0;
      if (typeof dateVal === "string") time = new Date(dateVal).getTime();
      else if (dateVal?.toMillis) time = dateVal.toMillis();
      else if (dateVal instanceof Date) time = dateVal.getTime();
      return time > thirtyDaysAgo.getTime();
    });
    
    const played = [...songs].filter(s => counts[s.id] !== undefined).map(s => ({...s, count: counts[s.id]}));
    played.sort((a,b) => a.count - b.count);
    
    const leastPlayed = played.slice(0, 5);
    
    const suggestions = [];
    if (leastPlayed.length > 0) {
        suggestions.push({...leastPlayed[0], reason: 'Pouco tocada', tagColor: 'text-amber-500', tagBg: 'bg-amber-500/10 border-amber-500/20'});
    }
    if (recent.length > 0) {
        suggestions.push({...recent[0], reason: 'Recém-adicionada', tagColor: 'text-teal-400', tagBg: 'bg-teal-500/10 border-teal-500/20'});
    }
    if (leastPlayed.length > 1) {
        suggestions.push({...leastPlayed[1], reason: 'Pouco tocada', tagColor: 'text-amber-500', tagBg: 'bg-amber-500/10 border-amber-500/20'});
    }
    if (leastPlayed.length > 2) {
        suggestions.push({...leastPlayed[2], reason: 'Pouco tocada', tagColor: 'text-amber-500', tagBg: 'bg-amber-500/10 border-amber-500/20'});
    }
    
    if (suggestions.length === 0) {
        return songs.slice(0,4).map(s => ({...s, reason: 'Revisar', tagColor: 'text-blue-400', tagBg: 'bg-blue-500/10 border-blue-500/20'}));
    }

    return suggestions.slice(0, 4);
  }, [songs, populatedScales]);

  const mostSungSongs = useMemo(() => {
    if (!songs || !populatedScales) return [];
    const counts: Record<string, number> = {};
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    populatedScales.forEach((scale) => {
      if (new Date(scale.date + "T00:00:00") <= now) {
        scale.songs.forEach((song) => {
          counts[song.id] = (counts[song.id] || 0) + 1;
        });
      }
    });

    return [...songs]
      .filter((s) => counts[s.id] && counts[s.id] > 0)
      .map((s) => ({ ...s, count: counts[s.id] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [songs, populatedScales]);

  if (musicLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center py-20 min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="relative isolate max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Nenhuma Organização Ativa</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">
            {isSupportMode 
              ? "Esta conta de usuário não possui nenhuma organização vinculada no momento. Você está em modo de assistência."
              : "Sua conta ainda não está vinculada a nenhuma organização. Entre em contato com seu administrador ou configure seu perfil."
            }
          </p>
        </div>

        {isSupportMode && (
          <div className="pt-4">
            <Button
              onClick={() => navigate("/profile")}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold h-11 rounded-xl shadow-md border-transparent text-sm cursor-pointer"
            >
              Acessar Perfil do Usuário para Criar Organização
            </Button>
          </div>
        )}
      </div>
    );
  }

  const YourNextScaleCard = () => {
    if (!nextUserUpcomingScale || nextUserUpcomingScale.id === nextUpcomingScale?.id) return null;
    const localeCode = i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "pt-BR";
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ curve: [0.16, 1, 0.3, 1], duration: 0.5 }}
        className="group relative overflow-hidden bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] border border-indigo-500/20 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 rounded-[28px] p-6 md:p-8 mb-12 isolate"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[60px] opacity-100 -z-10 pointer-events-none translate-x-1/3 -translate-y-1/3" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] uppercase tracking-widest font-black rounded-[8px] border border-indigo-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                {t("dashboard.your_next_scale_title")}
              </span>
              <span className="text-[13px] text-slate-400 font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                {new Date(nextUserUpcomingScale.date + "T00:00:00").toLocaleDateString(localeCode, {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
              </span>
            </div>
            
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                {getScaleTitle(nextUserUpcomingScale)}
              </h3>
              <p className="text-[14px] font-medium text-slate-400 mt-1 flex items-center gap-1.5">
                <span>{nextUserUpcomingScale.location.name}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300 font-medium">
                  {userRoleInNextScale 
                    ? t("dashboard.you_are_scheduled_as", { role: userRoleInNextScale })
                    : t("dashboard.you_are_scheduled_general")
                  }
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0 self-end sm:self-center w-full sm:w-auto mt-4 sm:mt-0">
            {nextUserUpcomingScale.songs.length > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  openSongDetail(
                    nextUserUpcomingScale.songs[0],
                    true,
                    { songs: nextUserUpcomingScale.songs, currentIndex: 0 },
                    true,
                  )
                }
                className="w-full sm:w-auto h-10 px-5 rounded-[14px] text-[13px] font-bold bg-gradient-to-tr from-indigo-500 to-indigo-400 hover:from-indigo-400 hover:to-indigo-300 border border-white/10 text-white shadow-[0_4px_14px_-4px_rgba(99,102,241,0.5),inset_0_1px_rgba(255,255,255,0.2)] transition-all active:scale-[0.98]"
              >
                <Play className="w-3.5 h-3.5 mr-1.5" fill="currentColor" /> {t("dashboard.performance_mode_btn")}
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => nextUserUpcomingScale.type === 'band' ? openBandScaleDetail(nextUserUpcomingScale.bandScale) : openScaleDetail(nextUserUpcomingScale)}
              className="w-full sm:w-auto h-10 px-5 rounded-[14px] text-[13px] font-bold bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.06] text-white shadow-none transition-all active:scale-[0.98]"
            >
              {t("dashboard.open_org_btn")}
            </Button>
          </div>
        </div>
      </motion.div>
    );
  };

  const HeroScale = ({ scale }: { scale: any }) => {
    const heroBandScale = populatedBandScales?.find(
      (bs) => bs.musicScaleId === scale.id,
    );
    const localeCode = i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "pt-BR";

    const hasSongs = scale.songs && scale.songs.length > 0;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ curve: [0.16, 1, 0.3, 1], duration: 0.6 }}
        className="group relative overflow-hidden rounded-[32px] p-6 sm:p-8 md:p-10 mb-10 flex flex-col md:flex-row gap-8 items-start justify-between bg-[#101014] border border-white/[0.08] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] md:hover:shadow-[0_25px_60px_-15px_rgba(59,130,246,0.15)] transition-all duration-500 isolate cursor-default"
      >
        {/* Glow & Radial Gradient */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-500/10 dark:bg-indigo-500/20 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/10 blur-[80px] rounded-full translate-y-1/3 -translate-x-1/3 pointer-events-none" />

        <div className="relative space-y-5 flex-1 z-10 w-full">
          <div className="flex flex-wrap items-center gap-3">
            <span className="px-3 py-1 bg-white/[0.08] text-white text-[10px] uppercase tracking-widest font-black rounded-full border border-white/[0.10] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
              {t("dashboard.upcoming_event") || "Próximo Evento"}
            </span>
            {daysUntilNextScale !== null && (
              <span className="text-white/70 text-[13px] font-bold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                {daysUntilNextScale === 0
                  ? t("dashboard.today_label")
                  : daysUntilNextScale === 1
                    ? t("dashboard.tomorrow_label", "Amanhã")
                    : t("dashboard.in_days", { count: daysUntilNextScale, defaultValue: `Em ${daysUntilNextScale} dias` })}
              </span>
            )}
          </div>

          <div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tighter leading-[1.05] mb-3">
              {getScaleTitle(scale)}
            </h2>
            <p className="text-[15px] sm:text-[16px] text-white/70 font-medium flex items-center flex-wrap gap-2.5">
              {new Date(scale.date + "T00:00:00").toLocaleDateString(localeCode, {
                day: "2-digit",
                month: "long",
              })}{scale.time ? ` ${t("dashboard.at_time", "às")} ${scale.time}` : ''}
              <span className="text-white/20">•</span>
              {scale.location.name}
            </p>
          </div>

          {/* Repertoire Preview */}
          <div className="flex flex-col gap-3 py-2 w-full max-w-sm">
             {hasSongs ? (
                <div className="flex flex-col gap-2 p-3.5 bg-[#18181b]/50 backdrop-blur-md rounded-[20px] border border-white/[0.06] shadow-inner">
                   <div className="flex items-center gap-2 mb-1.5 px-1">
                     <Music className="w-3.5 h-3.5 text-white/40" />
                     <span className="text-white/40 text-[10px] font-bold uppercase tracking-wider">
                        {t("scales.repertoire_ready", "Repertório")} <span className="mx-1.5 opacity-50">•</span> {scale.songs.length} {scale.songs.length === 1 ? t("scales.songs_in_scale_one", "música") : t("scales.songs_in_scale_other", "músicas")}
                     </span>
                   </div>
                   <div className="flex flex-col gap-2">
                     {scale.songs.slice(0, 3).map((song: any, idx: number) => (
                       <div key={song.id || idx} className="flex items-center gap-2.5 px-1">
                         <span className="w-4 flex justify-center text-[10px] font-bold text-white/20">{idx + 1}</span>
                         <span className="text-[13.5px] font-medium text-white/90 truncate leading-none">{song.title}</span>
                         {song.artist && <span className="text-[12px] text-white/30 truncate hidden sm:inline-block leading-none">— {song.artist}</span>}
                         {(song.selectedKey || song.key) && (
                           <span className="ml-auto flex-shrink-0 flex items-center justify-center min-w-[28px] h-[22px] px-2 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold tracking-wider text-indigo-300 shadow-[inset_0_1px_rgba(255,255,255,0.05)]">
                             {song.selectedKey || song.key}
                           </span>
                         )}
                       </div>
                     ))}
                     {scale.songs.length > 3 && (
                       <div className="text-[11px] font-medium text-white/30 mt-1 pl-7">
                         + {scale.songs.length - 3} {scale.songs.length - 3 === 1 ? 'música' : 'músicas'}...
                       </div>
                     )}
                   </div>
                </div>
             ) : (
                <div className="flex items-center gap-3 p-3.5 bg-[#18181b]/50 backdrop-blur-md rounded-[20px] border border-white/[0.06] shadow-inner">
                   <div className="flex items-center justify-center w-8 h-8 rounded-[12px] bg-white/[0.04] text-white/40 border border-white/[0.04]">
                      <Search className="w-4 h-4" />
                   </div>
                   <span className="text-white/50 text-[13px] font-medium pr-2">{t("scales.repertoire_not_defined")}</span>
                </div>
             )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-3 w-full sm:w-auto">
            {hasSongs ? (
              <Button
                onClick={() =>
                  openSongDetail(
                    scale.songs[0],
                    true,
                    { songs: scale.songs, currentIndex: 0 },
                    true,
                  )
                }
                className="w-full sm:w-auto pl-5 pr-6 h-12 sm:h-11 rounded-[16px] bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 border border-white/10 text-white text-[14px] font-bold shadow-[0_8px_20px_-4px_rgba(79,70,229,0.4),inset_0_1px_rgba(255,255,255,0.2)] transition-all active:scale-[0.98]"
              >
                <Play className="w-4 h-4 mr-2" fill="currentColor" /> {t("dashboard.performance_mode_btn")}
              </Button>
            ) : (
              <Button
                onClick={() => scale.type === 'band' ? openBandScaleDetail(scale.bandScale) : openScaleDetail(scale)}
                className="w-full sm:w-auto pl-5 pr-6 h-12 sm:h-11 rounded-[16px] bg-gradient-to-tr from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 border border-white/10 text-white text-[14px] font-bold shadow-[0_8px_20px_-4px_rgba(79,70,229,0.4),inset_0_1px_rgba(255,255,255,0.2)] transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4 mr-2" /> {t("scales.build_repertoire")}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => scale.type === 'band' ? openBandScaleDetail(scale.bandScale) : openScaleDetail(scale)}
              className="w-full sm:w-auto h-12 sm:h-11 rounded-[16px] text-[14px] font-semibold bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.06] text-white shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-all active:scale-[0.98]"
            >
              {t("scales.view_scale_details")}
            </Button>
          </div>
          
          {user && scale.eventAssignments && scale.eventAssignments.some((a: any) => a.userId === user.uid && a.active !== false) && (
             <div className="w-full max-w-sm mt-4">
               <AssignmentResponseActions
                 musicScaleId={scale.id}
                 assignments={scale.eventAssignments.filter((a: any) => a.userId === user.uid && a.active !== false)}
                 eventStart={scale.date ? new Date(`${scale.date}T${scale.time || '00:00'}:00`) : undefined}
               />
             </div>
          )}
        </div>
      </motion.div>
    );
  };

  const QuickActions = () => (
    <section className="mb-14">
      <div className="flex justify-between items-end mb-6 pl-2">
        <h3 className="text-[12px] font-bold text-slate-500 uppercase tracking-widest ml-1">
          {t("dashboard.quick_access_title")}
        </h3>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <button
          onClick={() => openScaleForm()}
          className="relative overflow-hidden bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] md:hover:bg-[#18181b]/70 md:hover:border-white/[0.08] transition-all duration-300 p-5 lg:p-6 rounded-[24px] flex flex-col items-start cursor-pointer group w-full text-left"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
          <div className="w-10 h-10 rounded-[14px] bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.04] flex items-center justify-center text-slate-300 mb-4 transition-all duration-300 md:group-hover:bg-blue-500/15 md:group-hover:text-blue-400 md:group-hover:border-blue-500/20 md:group-hover:scale-110">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-[15px] sm:text-[16px] font-bold text-slate-100 mb-0.5 tracking-tight transition-colors relative z-10 w-full truncate md:group-hover:text-white">
            {t("dashboard.new_scale_card_title")}
          </span>
          <span className="text-[13px] font-medium text-slate-400 leading-relaxed relative z-10 w-full line-clamp-2 transition-colors md:group-hover:text-slate-300">
            {t("dashboard.new_scale_card_desc")}
          </span>
        </button>
        <button
          onClick={() => navigate("/scales")}
          className="relative overflow-hidden bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] md:hover:bg-[#18181b]/70 md:hover:border-white/[0.08] transition-all duration-300 p-5 lg:p-6 rounded-[24px] flex flex-col items-start cursor-pointer group w-full text-left"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
          <div className="w-10 h-10 rounded-[14px] bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.04] flex items-center justify-center text-slate-300 mb-4 transition-all duration-300 md:group-hover:bg-indigo-500/15 md:group-hover:text-indigo-400 md:group-hover:border-indigo-500/20 md:group-hover:scale-110">
            <CalendarDaysIcon className="w-4 h-4" />
          </div>
          <span className="text-[15px] sm:text-[16px] font-bold text-slate-100 mb-0.5 tracking-tight transition-colors relative z-10 w-full truncate md:group-hover:text-white">
            {t("dashboard.view_scales_card_title")}
          </span>
          <span className="text-[13px] font-medium text-slate-400 leading-relaxed relative z-10 w-full line-clamp-2 transition-colors md:group-hover:text-slate-300">
            {t("dashboard.view_scales_card_desc")}
          </span>
        </button>
        <button
          onClick={() => openSongForm()}
          className="relative overflow-hidden bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] md:hover:bg-[#18181b]/70 md:hover:border-white/[0.08] transition-all duration-300 p-5 lg:p-6 rounded-[24px] flex flex-col items-start cursor-pointer group w-full text-left"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
          <div className="w-10 h-10 rounded-[14px] bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.04] flex items-center justify-center text-slate-300 mb-4 transition-all duration-300 md:group-hover:bg-purple-500/15 md:group-hover:text-purple-400 md:group-hover:border-purple-500/20 md:group-hover:scale-110">
            <Music className="w-4 h-4" />
          </div>
          <span className="text-[15px] sm:text-[16px] font-bold text-slate-100 mb-0.5 tracking-tight transition-colors relative z-10 w-full truncate md:group-hover:text-white">
            {t("dashboard.new_song_card_title")}
          </span>
          <span className="text-[13px] font-medium text-slate-400 leading-relaxed relative z-10 w-full line-clamp-2 transition-colors md:group-hover:text-slate-300">
            {t("dashboard.new_song_card_desc")}
          </span>
        </button>
        <button
          onClick={() => navigate("/songs")}
          className="relative overflow-hidden bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] md:hover:bg-[#18181b]/70 md:hover:border-white/[0.08] transition-all duration-300 p-5 lg:p-6 rounded-[24px] flex flex-col items-start cursor-pointer group w-full text-left"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
          <div className="w-10 h-10 rounded-[14px] bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.04] flex items-center justify-center text-slate-300 mb-4 transition-all duration-300 md:group-hover:bg-emerald-500/15 md:group-hover:text-emerald-400 md:group-hover:border-emerald-500/20 md:group-hover:scale-110">
            <BookOpenIcon className="w-4 h-4" />
          </div>
          <span className="text-[15px] sm:text-[16px] font-bold text-slate-100 mb-0.5 tracking-tight transition-colors relative z-10 w-full truncate md:group-hover:text-white">
            {t("dashboard.view_songs_card_title")}
          </span>
          <span className="text-[13px] font-medium text-slate-400 leading-relaxed relative z-10 w-full line-clamp-2 transition-colors md:group-hover:text-slate-300">
            {t("dashboard.view_songs_card_desc")}
          </span>
        </button>
      </div>
    </section>
  );

  const DashboardMetrics = () => {
    const totalSongs = songs?.length || 0;
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newSongsCount = songs?.filter((s) => {
      const dateVal = s.createdAt as any;
      let time = 0;
      if (typeof dateVal === "string") time = new Date(dateVal).getTime();
      else if (dateVal?.toMillis) time = dateVal.toMillis();
      else if (dateVal instanceof Date) time = dateVal.getTime();
      return time > thirtyDaysAgo.getTime();
    }).length || 0;
    
    // For simplicity, Ativas = total, Inativas = 0, as per the mockup unless we compute from scales
    const activeSongsCount = totalSongs;
    const inactiveSongsCount = 0;

    return (
      <section className="mb-14">
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <div className="relative overflow-hidden bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] md:hover:bg-[#1E1E24]/70 transition-all duration-300 flex flex-col justify-between p-5 lg:p-6 rounded-[24px] h-[120px] cursor-pointer group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
               <div className="flex justify-between items-start w-full gap-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 truncate group-hover:text-slate-300 transition-colors">{t("dashboard.total_songs_metric")}</span>
                   <div className="w-8 h-8 rounded-xl bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.04] flex items-center justify-center shrink-0 text-slate-300 group-hover:text-blue-400 group-hover:bg-blue-500/15 group-hover:border-blue-500/20 transition-all duration-300">
                       <BookOpenIcon className="w-4 h-4" /> 
                   </div>
               </div>
               <div className="text-3xl font-black text-white mt-auto tracking-tight">{totalSongs}</div>
            </div>
            
            <div className="relative overflow-hidden bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] md:hover:bg-[#1E1E24]/70 transition-all duration-300 flex flex-col justify-between p-5 lg:p-6 rounded-[24px] h-[120px] cursor-pointer group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
               <div className="flex justify-between items-start w-full gap-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 truncate group-hover:text-slate-300 transition-colors">{t("dashboard.new_songs_metric")}</span>
                   <div className="w-8 h-8 rounded-xl bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.04] flex items-center justify-center shrink-0 text-slate-300 group-hover:text-purple-400 group-hover:bg-purple-500/15 group-hover:border-purple-500/20 transition-all duration-300">
                       <SparklesIcon className="w-4 h-4" /> 
                   </div>
               </div>
               <div className="text-3xl font-black text-white mt-auto tracking-tight">{newSongsCount}</div>
            </div>

            <div className="relative overflow-hidden bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] md:hover:bg-[#1E1E24]/70 transition-all duration-300 flex flex-col justify-between p-5 lg:p-6 rounded-[24px] h-[120px] cursor-pointer group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
               <div className="flex justify-between items-start w-full gap-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 truncate group-hover:text-slate-300 transition-colors">{t("dashboard.active_songs_metric")}</span>
                   <div className="w-8 h-8 rounded-xl bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.04] flex items-center justify-center shrink-0 text-slate-300 group-hover:text-emerald-400 group-hover:bg-emerald-500/15 group-hover:border-emerald-500/20 transition-all duration-300">
                       <TrendingUp className="w-4 h-4" /> 
                   </div>
               </div>
               <div className="text-3xl font-black text-white mt-auto tracking-tight">{activeSongsCount}</div>
            </div>

            <div className="relative overflow-hidden bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] active:scale-[0.98] md:hover:bg-[#1E1E24]/70 transition-all duration-300 flex flex-col justify-between p-5 lg:p-6 rounded-[24px] h-[120px] cursor-pointer group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
               <div className="flex justify-between items-start w-full gap-2">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1 truncate group-hover:text-slate-300 transition-colors">{t("dashboard.inactive_songs_metric")}</span>
                   <div className="w-8 h-8 rounded-xl bg-white/[0.04] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.04] flex items-center justify-center shrink-0 text-slate-300 group-hover:text-orange-400 group-hover:bg-orange-500/15 group-hover:border-orange-500/20 transition-all duration-300">
                       <Moon className="w-4 h-4" /> 
                   </div>
               </div>
               <div className="text-3xl font-black text-white mt-auto tracking-tight">{inactiveSongsCount}</div>
            </div>
         </div>
      </section>
    );
  };

  return (
    <div className="relative isolate max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-fade-in touch-manipulation">
      {/* Mobile Premium Global Background Layer */}

      {journey && !journey.isLoading && journey.isEligible && !journey.isCompleted && Boolean(journey.currentEssentialStep) && (
        <FirstScaleJourneyCard journey={journey} />
      )}

      {nextUpcomingScale && <HeroScale scale={nextUpcomingScale} />}

      <YourNextScaleCard />

      {!(journey && !journey.isLoading && journey.isEligible && !journey.isCompleted && Boolean(journey.currentEssentialStep)) && (
        <QuickActions />
      )}
      
      <DashboardMetrics />

      <div className="mb-14">
        <PlanUsageCompactCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-12">
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pl-2">
              <div className="flex flex-wrap items-center gap-4">
                <h2 className="text-[12px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  {t("dashboard.event_schedule")}
                </h2>
                
                {/* Segmented control for switching lists */}
                <div className="flex bg-slate-100 dark:bg-[#111] p-1 rounded-2xl border border-black/[0.03] dark:border-white/[0.05] relative w-fit">
                  <button
                    onClick={() => setActiveScaleTab("all")}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 relative ${
                      activeScaleTab === "all"
                        ? "bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-[#888] md:hover:text-slate-900 dark:md:hover:text-white"
                    }`}
                  >
                    {t("dashboard.all_events")}
                  </button>
                  <button
                    onClick={() => setActiveScaleTab("mine")}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 relative flex items-center gap-1.5 ${
                      activeScaleTab === "mine"
                        ? "bg-white dark:bg-[#222] text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 dark:text-[#888] md:hover:text-slate-900 dark:md:hover:text-white"
                    }`}
                  >
                    {t("dashboard.my_commitments")}
                    {userUpcomingScales.length > 0 && (
                      <span className="px-1.5 py-0.5 text-[9px] bg-indigo-500 text-white font-extrabold rounded-full">
                        {userUpcomingScales.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => navigate("/scales")}
                className="text-indigo-500 font-bold text-sm md:hover:underline self-end sm:self-auto"
              >
                {t("dashboard.view_calendar_btn")}
              </button>
            </div>

            {filteredScalesToShow.length > 0 ? (
              <div className="space-y-4">
                {filteredScalesToShow.map((scale) => {
                  const myRole = getMyRoleForScale(scale);
                  const bandScale = scale.bandScale || populatedBandScales?.find((b: any) => b.musicScaleId === scale.id || b.id === scale.bandScaleId);
                  
                  let teamCount = 0;
                  if (scale.type === 'music' && scale.eventAssignments && scale.eventAssignments.length > 0) {
                    const uniqueUsers = new Set(scale.eventAssignments.filter((a: any) => a.active !== false).map((a: any) => a.userId));
                    teamCount = uniqueUsers.size;
                  } else {
                    teamCount = bandScale?.assignments?.length || 0;
                  }

                  const displayDate = parseDateOnlyLocal(scale.date);

                  return (
                    <div
                      key={scale.id}
                      onClick={() => scale.type === 'band' ? openBandScaleDetail(scale.bandScale) : openScaleDetail(scale)}
                      className="group flex flex-col sm:flex-row sm:items-start gap-4 p-4 md:p-5 bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] rounded-[24px] transition-all duration-300 md:hover:bg-[#18181b]/80 md:hover:border-white/[0.08] cursor-pointer isolate relative overflow-hidden active:scale-[0.98]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-transparent to-purple-500/5 opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                      
                      <div className="w-[60px] h-[60px] shrink-0 rounded-[18px] bg-white/[0.04] flex flex-col items-center justify-center border border-white/[0.06] transition-colors duration-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] relative z-10 md:group-hover:bg-indigo-500/10 md:group-hover:border-indigo-500/20">
                        <span className="text-[10px] font-bold text-slate-400 md:group-hover:text-indigo-300 uppercase leading-tight mb-0 transition-colors">
                          {displayDate
                            ? displayDate.toLocaleDateString(i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "pt-BR", { month: "short" }).replace(".", "")
                            : "--"}
                        </span>
                        <span className="text-[22px] font-black text-white leading-none">
                          {displayDate
                            ? displayDate.getDate().toString().padStart(2, "0")
                            : "--"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 relative z-10">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-bold text-[16px] text-white leading-tight transition-colors truncate">
                            {getScaleTitle(scale)}
                          </h4>
                          {myRole && (
                            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[11px] font-bold rounded-lg border border-emerald-500/20">
                              {myRole}
                            </span>
                          )}
                        </div>
                        <p className="text-[14px] font-medium text-[#888] flex items-center flex-wrap gap-2 truncate">
                          {scale.time && (
                            <>
                              <span className="flex items-center gap-0.5">
                                {scale.time}
                              </span>
                              <span className="text-white/20">•</span>
                            </>
                          )}
                          {scale.location.name}
                          {scale.songs.length > 0 && (
                            <>
                              <span className="text-white/20">•</span>
                              <span className="flex items-center gap-1">
                                <Music className="w-3.5 h-3.5 text-indigo-400" />
                                {t("dashboard.songs_count", "{{count}} música", { count: scale.songs.length })}
                              </span>
                            </>
                          )}
                          {teamCount > 0 && (
                            <>
                              <span className="text-white/20">•</span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-blue-400" />
                                {t("dashboard.team_count", "{{count}} escalados", { count: teamCount })}
                              </span>
                            </>
                          )}
                          {scale.songs.length === 0 && teamCount === 0 && (
                             <>
                                <span className="text-white/20">•</span>
                                <span className="text-[#888]">{t("dashboard.empty_scale")}</span>
                             </>
                          )}
                        </p>

                        {/* Beautiful preview of the songs on scale */}
                        {scale.songs && scale.songs.length > 0 && (
                          <div className="mt-3.5 flex flex-wrap items-center gap-1.5 overflow-hidden">
                            {scale.songs.map((song: any) => (
                              <span
                                key={song.id}
                                className="inline-flex items-center text-[11px] font-semibold text-slate-300 dark:text-slate-300 bg-white/[0.03] border border-white/[0.06] py-0.5 pl-2.5 pr-1.5 rounded-lg transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.2)] md:group-hover:bg-white/[0.06]"
                              >
                                {song.title}
                                {song.key && (
                                  <span className="ml-2 text-[9px] font-bold text-indigo-300/80 bg-indigo-500/10 px-1.5 rounded-md uppercase tracking-widest">{song.key}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Written details choice option (per user intent) */}
                        <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
                          <div className="flex items-center gap-1 text-[12px] font-bold text-indigo-400 md:group-hover:text-indigo-300 transition-colors">
                            <span>Ver detalhes</span>
                            <ArrowRight className="w-3.5 h-3.5 transform md:group-hover:translate-x-1 transition-transform duration-300" />
                          </div>
                          
                          {/* Scale Quick Actions */}
                          <div className="flex items-center gap-1.5 opacity-100 transition-opacity duration-300 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                              <AddToCalendarButton scale={scale} iconOnly />
                              <Can I="musicscale.scales.manage">
                                  <button onClick={(e) => { e.stopPropagation(); scale.type === 'band' ? openBandScaleForm(bandScale) : openScaleForm(scale); }} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors" title="Editar">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={(e) => { 
                                     e.stopPropagation(); 
                                     if (!isScaleCloningAllowed) {
                                         alert("O recurso de Clonar Escalas requer o plano Pro.");
                                         return;
                                     }
                                     let rawScale = scale.type === 'music' ? scales.find(s => s.id === scale.id) : bandScales.find(s => s.id === scale.id);
                                     if (rawScale) {
                                         const clonedScale = { ...rawScale, id: 'CLONE', date: '' } as any;
                                         if (scale.type === 'music') openScaleForm(clonedScale);
                                         else openBandScaleForm(clonedScale);
                                     }
                                  }} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 transition-colors" title="Clonar">
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); scale.type === 'band' ? openBandScaleDetail(scale.bandScale, 'delete') : openScaleDetail(scale, 'delete'); }} className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/10 flex items-center justify-center text-slate-300 hover:text-red-400 transition-colors" title="Excluir">
                                    <Trash className="w-4 h-4" />
                                  </button>
                              </Can>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <motion.div 
                 initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                 animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                 transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
                 className="p-8 md:p-12 text-center bg-[#111] border border-white/[0.05] rounded-[2.5rem] isolate mt-3"
              >
                <div className="w-16 h-16 mx-auto rounded-[1.5rem] bg-white/[0.04] flex items-center justify-center mb-5 text-indigo-400 border border-white/[0.08] relative z-10 transition-transform duration-500 md:group-hover:scale-105">
                  <Calendar className="w-7 h-7" />
                </div>
                <h3 className="text-[17px] font-bold text-white mb-2 tracking-tight relative z-10">
                  {activeScaleTab === "mine"
                    ? t("dashboard.no_events_scheduled")
                    : t("dashboard.no_upcoming_events")}
                </h3>
                <p className="text-[14px] text-[#888] font-medium mb-6 relative z-10 max-w-sm mx-auto">
                  {activeScaleTab === "mine"
                    ? t("dashboard.empty_events_mine")
                    : t("dashboard.empty_events_all")}
                </p>
                {activeScaleTab !== "mine" && (
                  <div className="relative z-10">
                    <Button
                      onClick={() => openScaleForm()}
                      className="rounded-2xl shadow-sm bg-indigo-600 hover:bg-indigo-500 text-white border-0"
                    >
                      Nova Escala
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </section>

          {/* Biblioteca Viva - Premium Flagship Banner */}
          <section
            onClick={() => navigate("/library")}
            className="group relative overflow-hidden rounded-[24px] md:rounded-[32px] bg-[#0A0A0E] border border-white/[0.08] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] md:hover:shadow-[0_40px_80px_-15px_rgba(59,130,246,0.25)] md:hover:border-white/[0.15] transition-all duration-500 cursor-pointer mb-12 flex flex-col md:flex-row items-stretch mt-12"
          >
            {/* Ambient Backgrounds */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden md:md:mix-blend-screen hidden md:block">
                <div className="absolute -top-[50%] right-[-20%] w-[80%] h-[200%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/30 via-indigo-900/10 to-transparent md:blur-[80px]  md:group-hover:from-blue-500/40 md:group-hover:scale-110 transition-all duration-1000 ease-out"></div>
                <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[100%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-600/10 via-transparent to-transparent md:blur-[60px]  opacity-40 md:group-hover:opacity-60 transition-all duration-1000"></div>
            </div>
            
            {/* Fine Noise */}
            <div className="absolute inset-x-0 inset-y-0 z-0 bg-transparent pointer-events-none"></div>

            {/* Left Content Area */}
            <div className="relative z-10 flex-1 p-8 md:p-12 lg:p-14 flex flex-col items-start justify-center max-w-full md:max-w-[60%]">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] font-bold tracking-[0.15em] uppercase bg-black/5 dark:bg-white/5 md:bg-black/5 dark:bg-white/5 md:backdrop-blur-md shadow-inner transition-colors md:group-hover:bg-blue-500/20 md:group-hover:border-blue-400/30">
                  <SparklesIcon className="w-3.5 h-3.5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,1)]" />
                  {t("dashboard.premium_highlight_badge")}
                </div>
                
                <h3 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-5 tracking-tight leading-[1.05] drop-shadow-sm">
                  {t("dashboard.premium_banner_title1")} <br className="hidden sm:block md:hidden lg:block"/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-white drop-shadow-[0_0_15px_rgba(96,165,250,0.3)]">
                    {t("dashboard.premium_banner_title2")}
                  </span>
                </h3>
                
                <p className="text-slate-400 font-medium text-[15px] sm:text-[16px] md:text-[18px] leading-relaxed mb-8 max-w-[500px] md:group-hover:text-slate-300 transition-colors duration-300">
                  {t("dashboard.premium_banner_desc")}
                </p>

                <Button
                    variant="white"
                    className="w-full sm:w-auto rounded-full h-14 px-8 text-[15px] font-bold shadow-[0_0_30px_rgba(59,130,246,0.15)] md:group-hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] transition-all duration-300 gap-2 border border-white/10 md:hover:border-white/30 md:group-hover:scale-[1.02]"
                >
                    {t("dashboard.explore_library_btn")}
                    <ArrowRight className="w-4 h-4 transition-transform md:group-hover:translate-x-1 flex-shrink-0" />
                </Button>
            </div>

            {/* Right Visual Decorative Area (Desktop Only) */}
            <div className="relative z-10 hidden md:flex flex-1 items-center justify-center p-8 overflow-hidden min-h-[300px]">
                {/* Visual Glassmorphic Elements */}
                <div className="relative w-full max-w-[280px] aspect-[3/4]">
                     {/* Floating Mockup Card Front */}
                     <div className="premium-glass absolute inset-0 rounded-3xl p-6 transition-all duration-700 ease-out flex flex-col overflow-hidden z-20 md:hover:-translate-y-2 md:hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
                          {/* Inner glass highlight */}
                          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.1] to-transparent pointer-events-none rounded-3xl opacity-30 md:opacity-100 md:md:mix-blend-overlay"></div>

                          <div className="flex justify-between items-start relative z-10 mb-6">
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-white flex items-center justify-center shadow-[0_8px_16px_rgba(0,0,0,0.2)]">
                                  <Music className="w-6 h-6 text-blue-600" />
                              </div>
                              <div className="px-3 py-1 text-[9px] font-black text-blue-200 bg-blue-500/20 border border-blue-400/30 rounded-lg tracking-wider shadow-[0_0_15px_rgba(59,130,246,0.3)] uppercase">
                                  {t("dashboard.synchronized_card_tag")}
                              </div>
                          </div>
                          <div className="relative z-10 mt-auto flex flex-col gap-3">
                              <div className="h-4 w-3/4 bg-gradient-to-r from-white to-white/60 rounded-full mb-1"></div>
                              <div className="h-2 w-1/2 bg-white/30 rounded-full mb-4"></div>
                              
                              <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-8 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.6)]"></div>
                                  <div className="h-1.5 w-full bg-white/10 rounded-full"></div>
                              </div>
                              <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-12 bg-purple-400 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
                                  <div className="h-1.5 w-full bg-white/10 rounded-full"></div>
                              </div>
                          </div>
                     </div>
                     
                     {/* Floating Mockup Card Back (Depth) */}
                     <div className="absolute -right-12 -bottom-10 w-full h-[60%] bg-[#151515] md:bg-white/[0.015] md:bg-[#151515] md:bg-white/[0.015] md:backdrop-blur-xl border border-white/[0.05] rounded-3xl shadow-2xl p-5 md:transform md:[-webkit-transform:rotateY(-15deg)_rotateX(8deg)] md:md:[transform:rotateY(-15deg)_rotateX(8deg)] md:group-hover:[-webkit-transform:rotateY(0deg)_rotateX(0deg)_translate(24px,16px)] md:group-hover:md:md:[transform:rotateY(0deg)_rotateX(0deg)_translate(24px,16px)] transition-all duration-700 ease-out opacity-60 z-10 flex flex-col justify-end">
                           <div className="h-2 w-full bg-white/10 rounded-full mb-3"></div>
                           <div className="h-2 w-4/5 bg-white/10 rounded-full mb-2"></div>
                     </div>
                </div>
            </div>
            
            {/* Mobile Gradient Cover */}
            <div className="md:hidden h-24 bg-gradient-to-t from-blue-600/10 to-transparent w-full"></div>
          </section>

          {/* Últimas Músicas Escaladas */}
          {lastPlayedSongsList.length > 0 && (
            <section className="mb-12 bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] rounded-[28px] p-5 sm:p-6 isolate">
                <div className="flex items-center gap-2.5 mb-5 px-1">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <h3 className="text-white font-bold text-[17px] tracking-tight">{t("dashboard.last_played_songs_section")}</h3>
                </div>
                <div className="flex flex-col gap-1.5">
                    {lastPlayedSongsList.map((song, i) => (
                        <div key={`${song.id}-${i}`} onClick={() => openSongDetail(song)} className="flex items-center justify-between p-3.5 bg-white/[0.02] md:hover:bg-white/[0.04] transition-colors rounded-[1.25rem] cursor-pointer premium-interactive">
                           <div className="flex flex-col">
                              <span className="text-white font-bold text-[15px] leading-tight mb-0.5">{song.title}</span>
                              <span className="text-slate-400 text-[13px] font-medium">{song.artist}</span>
                           </div>
                           <div className="text-[13px] font-medium text-slate-500">
                              {new Date(song.lastPlayed + 'T00:00:00').toLocaleDateString(i18n.language === "es" ? "es-ES" : i18n.language === "en" ? "en-US" : "pt-BR", {day: '2-digit', month: '2-digit', year: 'numeric'})}
                           </div>
                        </div>
                    ))}
                </div>
            </section>
          )}
        </div>

        {/* Sidebar Area */}
        <div className="lg:col-span-4 space-y-12">
          {unreadSuggestions.length > 0 && (
            <section className="mb-12">
              <div className="flex justify-between items-end mb-5 pl-2">
                <h3 className="text-[12px] font-bold text-amber-500 uppercase tracking-widest ml-1">
                  {t("dashboard.pending_suggestions_section")}
                </h3>
                <button
                  onClick={() => navigate("/suggestions")}
                  className="text-amber-500 font-bold text-sm flex items-center gap-1 hover:text-amber-400 premium-interactive"
                >
                  {t("dashboard.view_all_suggestions_btn")} <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {unreadSuggestions.slice(0, 3).map((suggestion) => (
                  <div
                    key={suggestion.id}
                    onClick={() => navigate("/suggestions")}
                    className="relative overflow-hidden bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] border border-amber-500/20 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] md:hover:bg-[#1E1E24]/70 active:scale-[0.98] transition-all duration-300 p-4 rounded-3xl flex items-center gap-4 cursor-pointer group"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
                    <div className="w-12 h-12 rounded-[1rem] bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20 transition-colors md:group-hover:bg-amber-500/20">
                      <SuggestionIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="flex-1 min-w-0 pr-2">
                      <h5 className="font-bold text-white truncate text-[14px] leading-tight mb-0.5 md:group-hover:text-amber-400 transition-colors">
                        {suggestion.songs.length === 1
                          ? suggestion.songs[0].title
                          : t("dashboard.songs_suggested_other", { count: suggestion.songs.length })}
                      </h5>
                      <p className="text-[13px] text-slate-400 font-medium truncate">
                        {t("dashboard.by_author_suggestion", { name: suggestion.createdBy.name })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {recentlyAddedSongs.length > 0 && (
            <section className="mb-12 bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] rounded-[28px] p-5 sm:p-6 isolate">
                <div className="flex items-center gap-2.5 mb-5 px-1">
                    <PlusSquare className="w-5 h-5 text-blue-500" />
                    <h3 className="text-white font-bold text-[17px] tracking-tight">{t("dashboard.new_songs_section")}</h3>
                </div>
                <div className="flex flex-col gap-1.5">
                    {recentlyAddedSongs.map((song) => (
                        <div key={song.id} onClick={() => openSongDetail(song)} className="flex items-center justify-between p-3.5 bg-white/[0.02] md:hover:bg-white/[0.04] transition-colors rounded-[1.25rem] cursor-pointer premium-interactive">
                           <div className="flex flex-col">
                              <span className="text-white font-bold text-[15px] leading-tight mb-0.5">{song.title}</span>
                              <span className="text-slate-400 text-[13px] font-medium">{song.artist}</span>
                           </div>
                        </div>
                    ))}
                </div>
            </section>
          )}

          {suggestedForRehearsal.length > 0 && (
            <section className="mb-12 bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] border border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] rounded-[28px] p-5 sm:p-6 isolate">
                <div className="flex items-center gap-2.5 mb-5 px-1">
                    <RefreshCcw className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-white font-bold text-[17px] tracking-tight">{t("dashboard.suggested_rehearsal_section")}</h3>
                </div>
                <div className="flex flex-col gap-1.5">
                    {suggestedForRehearsal.map((song, i) => (
                        <div key={`${song.id}-${i}`} onClick={() => openSongDetail(song)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-white/[0.02] md:hover:bg-white/[0.04] transition-colors rounded-[1.25rem] cursor-pointer premium-interactive">
                           <div className="flex flex-col shrink-0">
                              <span className="text-white font-bold text-[15px] leading-tight mb-0.5">{song.title}</span>
                              <span className="text-slate-400 text-[13px] font-medium">{song.artist}</span>
                           </div>
                           <div className="flex justify-start sm:justify-end border-white/5 pb-1">
                              <span className={`px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase tracking-wider ${song.tagBg} ${song.tagColor} border`}>
                                 {song.reason === "Pouco tocada" 
                                   ? t("dashboard.least_played_reason") 
                                   : song.reason === "Recém-adicionada" 
                                     ? t("dashboard.newly_added_reason") 
                                     : song.reason === "Revisar" 
                                       ? t("dashboard.review_reason") 
                                       : song.reason}
                              </span>
                           </div>
                        </div>
                    ))}
                </div>
            </section>
          )}
        </div>
      </div>
      <SupportRuntimeInspector />
    </div>
  );
};

export default DashboardPage;
