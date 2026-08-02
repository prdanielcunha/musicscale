import { StarterRepertoireModal } from '../components/onboarding/StarterRepertoireModal';
import { StarterPackAllowanceCard } from '../components/onboarding/StarterPackAllowanceCard';
import { useStarterPackAllowance } from '../hooks/useStarterPackAllowance';
import { useTranslation } from "react-i18next";
import { logger } from "../lib/logger";

import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import type { PopulatedSong, Tag } from "../types";
import { useMusic } from "../contexts/MusicDataContext";
import { useModals } from "../contexts/ModalContext";
import { useLimits, useAuth } from "../contexts/AuthContext";
import { useApi } from "../contexts/ApiContext";
import Spinner from "../components/common/Spinner";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import SongCard from "../components/songs/SongCard";
import ConfirmationModal from "../components/common/ConfirmationModal";
import Modal from "../components/common/Modal";
import { Can } from "../components/auth/Can";
import { XCircleIcon } from "../components/icons/XCircleIcon";
import { RepertoireIcon } from "../components/icons/RepertoireIcon";
import { FilterIcon } from "../components/icons/FilterIcon";
import { CheckIcon } from "../components/icons/CheckIcon";
import { MoreVerticalIcon } from "../components/icons/MoreVerticalIcon";
import { GridIcon } from "../components/icons/GridIcon";
import { ListIcon } from "../components/icons/ListIcon";
import { ArrowRight, BookOpen, ListRestart } from "lucide-react";
import { SparklesIcon } from "../components/icons/SparklesIcon";
import { useMusicScaleFeature } from "../hooks/useMusicScaleEntitlements";
import { LockedActionButton } from "../components/billing/LockedActionButton";
import { Lock, AlertTriangle } from "lucide-react";
import { UpgradePlanModal } from "../components/premium/EntitlementGates";
import { RepertoireMetricsView } from "../components/songs/RepertoireMetricsView";
import { RepertoireAuditorModal } from "../components/songs/RepertoireAuditorModal";
import { getSongFreshnessStatus } from "../utils/songHelpers";
import { updateSongFreshnessInBatch, updateSongLanguageInBatch, updateSongTagIdsInBatch } from "../services/musicBatchHelpers";
import { FreshnessStatus } from "../types";
import { BulkManagePanel, PendingBulkChanges } from "../components/songs/BulkManagePanel";
import { buildSearchIndex, searchSongs, getSearchSnippet } from "../utils/searchEngine";

// Icons
const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
      clipRule="evenodd"
    />
  </svg>
);

const searchInputClass = "input-base pl-11 pr-10";

const Popover: React.FC<{
  triggerRef: React.RefObject<HTMLElement>;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  popoverRef: React.RefObject<HTMLDivElement>;
}> = ({ triggerRef, isOpen, onClose, children, className, popoverRef }) => {
  const [style, setStyle] = useState<React.CSSProperties>({
    opacity: 0,
    position: "fixed",
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, popoverRef, triggerRef]);

  useLayoutEffect(() => {
    const calculatePosition = () => {
      if (isOpen && triggerRef.current && popoverRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const popoverEl = popoverRef.current;

        const popoverWidth = popoverEl.offsetWidth;
        const popoverHeight = popoverEl.offsetHeight;

        let top = rect.bottom + 8;
        let left = rect.left;

        if (left + popoverWidth > window.innerWidth - 16) {
          left = rect.right - popoverWidth;
        }
        if (left < 16) {
          left = 16;
        }
        if (top + popoverHeight > window.innerHeight - 16) {
          top = rect.top - popoverHeight - 8;
        }
        if (top < 16) {
          top = 16;
        }

        setStyle({
          position: "fixed",
          top: `${top}px`,
          left: `${left}px`,
          opacity: 1,
          transition: "opacity 0.1s ease-out, transform 0.1s ease-out",
          transform: "translateY(0)",
        });
      }
    };

    if (isOpen) {
      // Position it off-screen first to measure, then calculate
      setStyle({
        position: "fixed",
        top: "-9999px",
        left: "-9999px",
        opacity: 0,
        transform: "translateY(-10px)",
      });
      // RAF to ensure the DOM is updated before we measure
      requestAnimationFrame(() => {
        calculatePosition();
      });
    } else {
      setStyle({
        ...style,
        opacity: 0,
        transform: "translateY(-10px)",
        pointerEvents: "none",
      });
    }

    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition, true);

    return () => {
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition, true);
    };
  }, [isOpen, triggerRef, popoverRef]);

  return createPortal(
    <div ref={popoverRef} style={style} className={className}>
      {children}
    </div>,
    document.body,
  );
};

const SongsPage: React.FC = () => {
  const { songs, tags, loading, error, refreshData } = useMusic();
  const { openSongForm, openAiSongImport, openSongDetail, openDeleteSongConfirmation } =
    useModals();
  const { limits, effectivePlan } = useLimits();
  const { userProfile, permissions } = useAuth();
  const canManageRepertoire = !!(permissions?.manageSongs || permissions?.['musicScale.manageSongs'] || permissions?.['musicscale.songs.edit']);
  const api = useApi();
  const isOverLimit = songs.length >= limits.maxSongs;
  const isAiImportAllowed = useMusicScaleFeature('aiImport');
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { allowance, refreshAllowance, loading: allowanceLoading, error: allowanceError } = useStarterPackAllowance();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [isConfirmBulkDeleteOpen, setIsConfirmBulkDeleteOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [contentFilters, setContentFilters] = useState<{
    chords: "all" | "has" | "has_not";
    lyrics: "all" | "has" | "has_not";
  }>({ chords: "all", lyrics: "all" });
  const [tagFilterIds, setTagFilterIds] = useState<string[]>([]);
  const [languageFilter, setLanguageFilter] = useState<"all" | "pt" | "en" | "es" | "other" | "unknown">("all");
  const [freshnessFilter, setFreshnessFilter] = useState<"all" | "new" | "old">("all");

  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [renderLimit, setRenderLimit] = useState(30);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isStarterModalOpen, setIsStarterModalOpen] = useState(false);

  const openedFromFirstValueJourney = location.state?.starterRepertoireOrigin === 'first-value-journey';

  // Se a organização for trocada enquanto o modal estiver aberto:
  // fechar o modal e descartar a origem antiga
  useEffect(() => {
    if (isStarterModalOpen) {
      setIsStarterModalOpen(false);
      setSearchParams(prev => {
         prev.delete('starterPack');
         return prev;
      }, { replace: true, state: {} });
    }
  }, [userProfile?.organizationId]);

  useEffect(() => {
    if (!loading && searchParams.get('starterPack') === '1' && canManageRepertoire) {
       setIsStarterModalOpen(true);
       // We DO NOT remove starterPack from URL immediately if it's from the journey,
       // otherwise we lose the URL context when closing (or we can rely purely on location.state).
       // Actually, it's safer to remove it but keep state.
       setSearchParams(prev => {
          prev.delete('starterPack');
          return prev;
       }, { replace: true, state: location.state });
    }
  }, [loading, searchParams, canManageRepertoire, setSearchParams, location.state]);

  const handleStarterRepertoireCancel = () => {
    setIsStarterModalOpen(false);
    if (openedFromFirstValueJourney) {
      navigate('/', { replace: true });
    } else {
      setSearchParams(prev => {
         prev.delete('starterPack');
         return prev;
      }, { replace: true, state: {} });
    }
  };

  const handleStarterRepertoireCompleted = async () => {
    setIsStarterModalOpen(false);
    
    try {
      await refreshData();
      await refreshAllowance();
      
      if (openedFromFirstValueJourney) {
        navigate('/', { replace: true });
        return;
      }
      
      setSearchParams(prev => {
         prev.delete('starterPack');
         return prev;
      }, { replace: true, state: {} });
    } catch (error) {
      console.error("Failed to refresh data after starter pack import:", error);
      setSearchParams(prev => {
         prev.delete('starterPack');
         return prev;
      }, { replace: true, state: {} });
    }
  };
  const [isBulkMoreOpen, setIsBulkMoreOpen] = useState(false);

  // Intersection observer to load more songs as user scrolls
  const loaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setRenderLimit((prev) => prev + 30);
        }
      },
      { rootMargin: "200px" }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, []);

  // Reset limit when filters change
  useEffect(() => {
    setRenderLimit(30);
  }, [searchTerm, statusFilter, contentFilters, tagFilterIds, languageFilter, freshnessFilter]);
  const [isBulkManageOpen, setIsBulkManageOpen] = useState(false);
  const [isBulkApplyConfirmOpen, setIsBulkApplyConfirmOpen] = useState(false);
  const [pendingBulkChanges, setPendingBulkChanges] = useState<PendingBulkChanges | null>(null);
  
  
  
  
  
  const [isAuditorOpen, setIsAuditorOpen] = useState(false);

  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePopoverRef = useRef<HTMLDivElement>(null);
  
  

  // Deep Link Handling
  useEffect(() => {
    const songId = searchParams.get("openSongId");
    if (songId && !loading && songs.length > 0) {
      const song = songs.find((s) => s.id === songId);
      if (song) {
        openSongDetail(song);
        // Clean URL without reloading
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, loading, songs, openSongDetail, setSearchParams]);

  const searchIndex = useMemo(() => buildSearchIndex(songs), [songs]);

  const filteredAndSortedSongsWithMatch = useMemo(() => {
    let processedSongs = [...songs];

    if (statusFilter !== "all") {
      processedSongs = processedSongs.filter(
        (song) => song.status === statusFilter,
      );
    }

    if (contentFilters.chords === "has") {
      processedSongs = processedSongs.filter(
        (song) => !!song.chords || !!song.chordsUrl,
      );
    } else if (contentFilters.chords === "has_not") {
      processedSongs = processedSongs.filter(
        (song) => !song.chords && !song.chordsUrl,
      );
    }

    if (contentFilters.lyrics === "has") {
      processedSongs = processedSongs.filter((song) => !!song.lyrics);
    } else if (contentFilters.lyrics === "has_not") {
      processedSongs = processedSongs.filter((song) => !song.lyrics);
    }
    
    if (languageFilter !== "all") {
        processedSongs = processedSongs.filter(song => song.language === languageFilter || (!song.language && languageFilter === 'unknown'));
    }

    if (freshnessFilter !== "all") {
        processedSongs = processedSongs.filter(song => getSongFreshnessStatus(song) === freshnessFilter);
    }

    if (tagFilterIds.length > 0) {
      processedSongs = processedSongs.filter((song) =>
        tagFilterIds.every((tagId) => song.tagIds.includes(tagId)),
      );
    }

    let results = processedSongs.map(song => ({ song, searchMatch: undefined as import("../utils/searchEngine").SearchMatch | undefined }));

    if (searchTerm) {
      const allowedIds = new Set(processedSongs.map(song => song.id));
      const documents = searchIndex.filter(doc => allowedIds.has(doc.song.id));
      const matches = searchSongs(documents, searchTerm);
      results = matches.map(match => ({
        song: match.document.song as PopulatedSong,
        searchMatch: match
      }));
    } else {
      results.sort((a, b) => a.song.title.localeCompare(b.song.title));
    }

    return results;
  }, [songs, searchIndex, statusFilter, contentFilters, searchTerm, tagFilterIds, languageFilter, freshnessFilter]);

  const filteredAndSortedSongs = useMemo(() => filteredAndSortedSongsWithMatch.map(r => r.song), [filteredAndSortedSongsWithMatch]);

  const filterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "all") count++;
    if (contentFilters.chords !== "all") count++;
    if (contentFilters.lyrics !== "all") count++;
    if (languageFilter !== "all") count++;
    if (freshnessFilter !== "all") count++;
    count += tagFilterIds.length;
    return count;
  }, [statusFilter, contentFilters, tagFilterIds, languageFilter, freshnessFilter]);

  const selectedFilterTags = useMemo(() => {
    return tagFilterIds
      .map((id) => tags.find((t) => t.id === id))
      .filter(Boolean) as Tag[];
  }, [tagFilterIds, tags]);

  const availableFilterTags = useMemo(() => {
    return tags
      .filter((t) => !tagFilterIds.includes(t.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tagFilterIds, tags]);

  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev);
    setSelectedSongIds([]);
  };

  const handleSongSelect = (songId: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId],
    );
  };

  const handleSelectAll = () => {
    if (selectedSongIds.length === filteredAndSortedSongs.length) {
      setSelectedSongIds([]);
    } else {
      setSelectedSongIds(filteredAndSortedSongs.map((s) => s.id));
    }
  };

  
  const handleBulkManageApply = (changes: PendingBulkChanges) => {
    setPendingBulkChanges(changes);
    setIsBulkManageOpen(false);
    setIsBulkApplyConfirmOpen(true);
  };

  const handleBulkApplyConfirm = async () => {
    if (!pendingBulkChanges || selectedSongIds.length === 0 || !userProfile?.organizationId || !canManageRepertoire) {
      return;
    }
    
    setIsUpdating(true);
    try {
      const orgId = userProfile.organizationId;
      const { freshnessStatus, language, tagsToAdd, tagsToRemove } = pendingBulkChanges;
      
      // Execute each change (wait sequentially for safety)
      if (freshnessStatus) {
         await updateSongFreshnessInBatch(orgId, selectedSongIds, freshnessStatus, 'manual');
      }
      if (language) {
         await updateSongLanguageInBatch(orgId, selectedSongIds, language);
      }
      if ((tagsToAdd && tagsToAdd.length > 0) || (tagsToRemove && tagsToRemove.length > 0)) {
         await updateSongTagIdsInBatch(orgId, selectedSongIds, tagsToAdd || [], tagsToRemove || []);
      }
      
      await refreshData();
      setIsSelectionMode(false);
      setSelectedSongIds([]);
      setPendingBulkChanges(null);
    } catch (e) {
      logger.error("Bulk apply failed", e);
    } finally {
      setIsUpdating(false);
      setIsBulkApplyConfirmOpen(false);
    }
  };

  const handleDeleteSelected = () => {
    setIsBulkManageOpen(false);
    setIsBulkMoreOpen(false);
    setIsConfirmBulkDeleteOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (!api || !canManageRepertoire) return;
    setIsUpdating(true);
    try {
      await api.songs.deleteMany(selectedSongIds);
      await refreshData();
      setIsSelectionMode(false);
    } catch (e) {
      logger.error("Bulk delete failed", e);
    } finally {
      setIsUpdating(false);
      setIsConfirmBulkDeleteOpen(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner />
      </div>
    );
  if (error) return <div className="text-red-500 text-center">{error}</div>;

  const isCompletelyEmpty = songs.length === 0;

  const allSelected =
    selectedSongIds.length > 0 &&
    selectedSongIds.length === filteredAndSortedSongs.length;

  if (isCompletelyEmpty) {
    const showStarterPack = canManageRepertoire && allowance && !allowance.completed && allowance.remaining > 0;
    
    return (
      <>
        <div className="max-w-4xl mx-auto py-12 md:py-20 px-4 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-[2rem] flex items-center justify-center mx-auto mb-8 text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-primary/10 relative">
            <div className="absolute inset-0 bg-white/40 dark:bg-[#111111]/40 backdrop-blur-xl rounded-[2rem] -z-10"></div>
            <RepertoireIcon className="w-12 h-12 relative z-10" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-4 animate-slide-up-sheet">
            Seu repertório está vazio
          </h2>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto mb-12 leading-relaxed font-medium animate-fade-in text-balance">
            Comece a estruturar as músicas do seu ministério. Você pode adicionar
            manualmente ou importar arranjos prontos da Biblioteca Viva em
            segundos.
          </p>

          <div className="mb-12" id="starter-pack-container">
            {canManageRepertoire && (!allowance?.completed || allowanceLoading || allowanceError) && (
              <StarterPackAllowanceCard 
                allowance={allowance} 
                loading={allowanceLoading}
                error={allowanceError}
                onRetry={refreshAllowance}
                onOpen={() => setIsStarterModalOpen(true)} 
                variant="empty-repertoire" 
              />
            )}
          </div>
          
          {(showStarterPack || allowanceLoading || allowanceError) && (
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6 text-left" id="other-ways-to-start">
              {t('starterPackAllowance.otherWaysToStart', 'Outras formas de começar')}
            </h3>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card
              onClick={() => openSongForm()}
              className="p-8 cursor-pointer flex flex-col items-start transition-all duration-300 hover:border-slate-300 dark:hover:border-white/10 border-black/5 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] group bg-gradient-to-br from-slate-50 to-transparent dark:from-white/[0.02]"
            >
              <div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-100 transition-opacity">
                <PlusIcon className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-left">
                Adicionar Manualmente
              </h3>
              <p className="text-slate-500 font-medium text-[15px] leading-relaxed text-left mb-8 flex-1">
                Insira a letra, anexe o link da cifra ou crie do zero.
              </p>
              <div className="flex items-center text-[14px] text-slate-700 dark:text-slate-300 font-bold group-hover:translate-x-1 transition-transform bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
                Criar Nova Música <ArrowRight className="w-4 h-4 ml-1.5" />
              </div>
            </Card>

            <Card
              onClick={() => navigate("/library")}
              className="p-8 cursor-pointer flex flex-col items-start transition-all duration-300 hover:border-primary/30 border-black/5 dark:border-white/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group bg-gradient-to-br from-slate-50 to-transparent dark:from-white/[0.02]"
            >
              <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-left group-hover:text-primary transition-colors">
                Biblioteca Viva
              </h3>
              <p className="text-slate-500 font-medium text-[15px] leading-relaxed text-left mb-8 flex-1">
                Músicas prontas com cifras e tons configurados para sua equipe.
              </p>
              <div className="flex items-center text-[14px] text-primary font-bold group-hover:translate-x-1 transition-transform bg-primary/5 px-3 py-1.5 rounded-full">
                Acessar Acervo <ArrowRight className="w-4 h-4 ml-1.5" />
              </div>
            </Card>

            <Card
              onClick={openAiSongImport}
              className="p-8 cursor-pointer flex flex-col items-start transition-all duration-300 hover:border-indigo-500/50 border-indigo-500/20 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group bg-gradient-to-br from-indigo-500/10 to-transparent dark:from-indigo-500/5"
            >
              <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                <SparklesIcon className="w-6 h-6 text-indigo-500" />
              </div>
              <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 mb-2 text-left">
                Importar com IA
              </h3>
              <p className="text-slate-500 font-medium text-[15px] leading-relaxed text-left mb-8 flex-1">
                Dê uma cifra ou letra bagunçada, a IA limpa e estrutura tudo pra você.
              </p>
              <div className="flex items-center text-[14px] text-indigo-600 dark:text-indigo-400 font-bold group-hover:translate-x-1 transition-transform bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full">
                Criação Inteligente <ArrowRight className="w-4 h-4 ml-1.5" />
              </div>
            </Card>
          </div>
        </div>
        <StarterRepertoireModal
          isOpen={isStarterModalOpen}
          onCancel={() => setIsStarterModalOpen(false)}
          onCompleted={async () => {
            setIsStarterModalOpen(false);
            if (typeof refreshData === 'function') {
              await refreshData();
            }
            if (typeof refreshAllowance === 'function') {
              await refreshAllowance();
            }
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {canManageRepertoire && (!allowance?.completed || allowanceLoading || allowanceError) && (
        <StarterPackAllowanceCard 
          allowance={allowance} 
          loading={allowanceLoading}
          error={allowanceError}
          onRetry={refreshAllowance}
          onOpen={() => setIsStarterModalOpen(true)} 
          variant="compact" 
        />
      )}
      <RepertoireMetricsView songs={songs} mode="repertoire" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex-grow min-w-[250px] relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="search"
            placeholder="Buscar por título ou artista..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1A1A1C]/80 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-[15px] font-medium text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all shadow-sm h-[48px]"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <Button
              ref={filterButtonRef}
              variant="secondary"
              onClick={() => setIsFilterOpen((o) => !o)}
              leftIcon={<FilterIcon className="w-4 h-4" />}
            >
              Filtros{" "}
              {filterCount > 0 && (
                <span className="ml-2 bg-primary text-white text-xs font-bold rounded-full px-2 py-0.5">
                  {filterCount}
                </span>
              )}
            </Button>
            <Popover
              triggerRef={filterButtonRef}
              isOpen={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
              popoverRef={filterPopoverRef}
              className="w-72 bg-white dark:bg-[#1A1A1C]/95 dark:backdrop-blur-3xl border border-slate-200 dark:border-white/[0.08] rounded-3xl shadow-2xl z-[60] overflow-hidden"
            >
              <div className="p-5 space-y-5">
                <div>
                  <h4 className="text-[12px] font-bold mb-3 text-slate-500 uppercase tracking-widest">
                    Status
                  </h4>
                  <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
                    {(["all", "active", "inactive"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`flex-1 text-[13px] py-1.5 px-2 font-bold rounded-xl transition-all ${statusFilter === status ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md dark:shadow-black/50" : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white"}`}
                      >
                        {status === "all"
                          ? "Todas"
                          : status === "active"
                            ? "Ativas"
                            : "Inativas"}
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="border-slate-100 dark:border-white/5" />
                <div>
                  <h4 className="text-[12px] font-bold mb-3 text-slate-500 uppercase tracking-widest">
                    Nova/Antiga
                  </h4>
                  <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
                    {(["all", "new", "old"] as const).map((fresh) => (
                      <button
                        key={fresh}
                        onClick={() => setFreshnessFilter(fresh)}
                        className={`flex-1 text-[13px] py-1.5 px-2 font-bold rounded-xl transition-all ${freshnessFilter === fresh ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md dark:shadow-black/50" : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white"}`}
                      >
                        {fresh === "all" ? "Todas" : fresh === "new" ? "Novas" : "Antigas"}
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="border-slate-100 dark:border-white/5" />
                <div>
                  <h4 className="text-[12px] font-bold mb-3 text-slate-500 uppercase tracking-widest">
                    Cifra
                  </h4>
                  <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
                    {(["all", "has", "has_not"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() =>
                          setContentFilters((prev) => ({ ...prev, chords: f }))
                        }
                        className={`flex-1 text-[13px] py-1.5 px-2 font-bold rounded-xl transition-all ${contentFilters.chords === f ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md dark:shadow-black/50" : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white"}`}
                      >
                        {f === "all" ? "Todas" : f === "has" ? "Com" : "Sem"}
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="border-slate-100 dark:border-white/5" />
                <div>
                  <h4 className="text-[12px] font-bold mb-3 text-slate-500 uppercase tracking-widest">
                    Letra
                  </h4>
                  <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
                    {(["all", "has", "has_not"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() =>
                          setContentFilters((prev) => ({ ...prev, lyrics: f }))
                        }
                        className={`flex-1 text-[13px] py-1.5 px-2 font-bold rounded-xl transition-all ${contentFilters.lyrics === f ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md dark:shadow-black/50" : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white"}`}
                      >
                        {f === "all" ? "Todas" : f === "has" ? "Com" : "Sem"}
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="border-slate-100 dark:border-white/5" />
                <div>
                  <h4 className="text-[12px] font-bold mb-3 text-slate-500 uppercase tracking-widest">
                    Idioma
                  </h4>
                  <div className="flex flex-wrap gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-2xl">
                    {(["all", "pt", "en", "es", "other", "unknown"] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguageFilter(lang)}
                        className={`flex-1 min-w-[30%] text-[13px] py-1.5 px-2 font-bold rounded-xl transition-all ${languageFilter === lang ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-md dark:shadow-black/50" : "text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white"}`}
                      >
                        {lang === "all" ? "Todos" : lang === "pt" ? "PT" : lang === "en" ? "EN" : lang === "es" ? "ES" : lang === "other" ? "Outros" : "N/D"}
                      </button>
                    ))}
                  </div>
                </div>
                <hr className="border-slate-100 dark:border-white/5" />
                <div>
                  <h4 className="text-[12px] font-bold mb-3 text-slate-500 uppercase tracking-widest">
                    Tags
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-white/5 rounded-2xl min-h-[44px]">
                    {selectedFilterTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center gap-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-[11px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-xl shadow-sm border border-slate-200/50 dark:border-white/5"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span>{tag.name}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setTagFilterIds((prev) =>
                              prev.filter((id) => id !== tag.id),
                            )
                          }
                          className="hover:text-red-500 transition-colors ml-0.5"
                          aria-label={`Remover tag ${tag.name}`}
                        >
                          <XCircleIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="relative flex-grow">
                      <select
                        value=""
                        onChange={(e) => {
                          const newId = e.target.value;
                          if (newId && !tagFilterIds.includes(newId)) {
                            setTagFilterIds((prev) => [...prev, newId]);
                          }
                        }}
                        className="w-full appearance-none bg-transparent border-none outline-none focus:ring-0 text-[13px] font-bold text-primary dark:text-primary-light p-1 cursor-pointer"
                        disabled={availableFilterTags.length === 0}
                      >
                        <option value="" disabled>
                          {availableFilterTags.length > 0
                            ? "+ Add Tag"
                            : "Sem tags"}
                        </option>
                        {availableFilterTags.map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </Popover>
          </div>

          {isSelectionMode && selectedSongIds.length === 0 ? (
            <Button variant="secondary" onClick={handleToggleSelectionMode}>
              Cancelar
            </Button>
          ) : !isSelectionMode ? (
            <Button onClick={handleToggleSelectionMode} variant="secondary">
              Selecionar
            </Button>
          ) : null}

          {canManageRepertoire && (
            <Button
              variant="secondary"
              onClick={() => setIsAuditorOpen(true)}
              leftIcon={<ListRestart className="w-4 h-4 text-indigo-500" />}
            >
              Auditoria de repertório
            </Button>
          )}

          <div className="inline-flex items-center rounded-xl p-1 bg-slate-100 dark:bg-[#1A1A1C]/80 border border-slate-200 dark:border-white/5 shadow-sm">
            <button
              onClick={() => setViewMode("cards")}
              title="Visão em Cards"
              className={`p-2 rounded-lg transition-colors ${viewMode === "cards" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm dark:shadow-black/50" : "text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white"}`}
            >
              <GridIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Visão em Tabela"
              className={`p-2 rounded-lg transition-colors ${viewMode === "table" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm dark:shadow-black/50" : "text-slate-500 hover:text-slate-900 dark:text-white/50 dark:hover:text-white"}`}
            >
              <ListIcon className="w-5 h-5" />
            </button>
          </div>

          <Can I="musicscale.songs.edit">
            <LockedActionButton
              label="Importar IA"
              isLocked={!isAiImportAllowed}
              featureKey="aiImport"
              requiredPlan="pro"
              onClick={
                isOverLimit ? () => setShowLimitModal(true) : () => openAiSongImport()
              }
              onLockedClick={
                isOverLimit ? () => setShowLimitModal(true) : undefined
              }
              leftIcon={
                isOverLimit || !isAiImportAllowed ? (
                  <Lock className="w-4 h-4 text-amber-300" />
                ) : (
                  <SparklesIcon className="w-4 h-4 text-white" />
                )
              }
              variant="primary"
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 border-0 shadow-lg shadow-purple-500/20"
            />
            
            <Button
              onClick={
                isOverLimit ? () => setShowLimitModal(true) : () => openSongForm()
              }
              leftIcon={isOverLimit ? <AlertTriangle className="w-4 h-4" /> : <PlusIcon />}
              variant={isOverLimit ? "secondary" : "primary"}
            >
              Nova Música
            </Button>
          </Can>
        </div>
      </div>

      {filteredAndSortedSongs.length > 0 ? (
        viewMode === "cards" ? (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAndSortedSongsWithMatch.slice(0, renderLimit).map(({ song, searchMatch }) => (
                <SongCard
                  key={song.id}
                  song={song}
                  onView={openSongDetail}
                  onEdit={openSongForm}
                  onDelete={openDeleteSongConfirmation}
                  onCreateScale={(s) =>
                    navigate("/scales", { state: { preselectedSongIds: [s.id] } })
                  }
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedSongIds.includes(song.id)}
                  onSelectToggle={handleSongSelect}
                  searchMatch={searchMatch}
                  searchTerm={searchTerm}
                />
              ))}
            </div>
            {renderLimit < filteredAndSortedSongs.length && (
              <div ref={loaderRef} className="h-20 w-full flex items-center justify-center mt-6">
                <Spinner size="md" />
              </div>
            )}
          </div>
        ) : (
          <>
            <Card className="overflow-x-auto border-black/[0.04] dark:border-white/[0.08] dark:bg-[#0A0A0C]/60 dark:backdrop-blur-3xl">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-white/[0.06]">
              <thead className="bg-slate-50 dark:bg-black/40">
                <tr>
                  {isSelectionMode && (
                    <th scope="col" className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleSelectAll}
                        className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/50"
                      />
                    </th>
                  )}
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Título
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Artista
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Tom
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    BPM
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Conteúdo
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                  >
                    Origem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/[0.04] bg-white dark:bg-transparent">
                {filteredAndSortedSongsWithMatch.slice(0, renderLimit).map(({ song, searchMatch }) => {
                  const hasLyrics = !!song.lyrics?.trim();
                  const hasChords = !!song.chords?.trim();
                  
                  let contentStatus = { label: "INCOMPLETA", color: "text-slate-500 bg-slate-100 dark:bg-white/5 dark:text-slate-400" };
                  if (hasLyrics && hasChords) contentStatus = { label: "COMPLETA", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20 shadow-sm" };
                  else if (hasChords) contentStatus = { label: "SÓ CIFRA", color: "text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-500/20 shadow-sm" };
                  else if (hasLyrics) contentStatus = { label: "SÓ LETRA", color: "text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/20 shadow-sm" };

                  const freshnessStatus = getSongFreshnessStatus(song);

                  return (
                  <tr
                    key={song.id}
                    onClick={() =>
                      isSelectionMode
                        ? handleSongSelect(song.id)
                        : openSongDetail(song)
                    }
                    className={`transition-colors ${isSelectionMode ? "cursor-pointer" : ""} ${selectedSongIds.includes(song.id) ? "bg-primary/5" : "hover:bg-slate-50 dark:hover:bg-white/5 group"}`}
                  >
                    {isSelectionMode && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedSongIds.includes(song.id)}
                          onChange={() => handleSongSelect(song.id)}
                          className="rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/50"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          {song.language && song.language !== 'unknown' && song.language !== 'other' && (
                             <span className="text-[14px] leading-none drop-shadow-sm" title={`Idioma: ${song.language.toUpperCase()}`}>
                               {song.language === 'pt' ? '🇧🇷' : song.language === 'en' ? '🇺🇸' : song.language === 'es' ? '🇪🇸' : ''}
                             </span>
                          )}
                          <span className="text-[14px] font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                            {song.title}
                          </span>
                        </div>
                        {searchMatch?.matchOrigin === 'lyrics' && searchTerm && (
                          <span className="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-[200px]">
                            Na letra: "{getSearchSnippet(song.lyrics, searchTerm)}"
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[14px] text-slate-500 dark:text-slate-400 font-medium">
                      {song.artist}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[13px] text-center font-mono font-medium text-slate-600 dark:text-slate-300">
                      {searchMatch && searchTerm ? (
                        <span className="font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">{song.selectedKey || song.key || song.originalKey || "-"}</span>
                      ) : (
                        song.key || "-"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[13px] text-center font-mono font-medium text-slate-600 dark:text-slate-300">
                      {song.bpm || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className={`px-2 py-0.5 inline-flex text-[10px] tracking-wider font-bold rounded-md border border-transparent ${contentStatus.color}`}>
                        {contentStatus.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap flex items-center gap-1.5 h-[52px]">
                      {freshnessStatus === 'new' && (
                        <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[10px] tracking-wider font-bold rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" title="Música Nova">
                          NOVA
                        </span>
                      )}
                      {freshnessStatus === 'old' && (
                        <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[10px] tracking-wider font-bold rounded-md bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" title="Música Antiga">
                          ANTIGA
                        </span>
                      )}
                      
                      {song.originGlobalSongId ? (
                        <span className="px-2 py-0.5 inline-flex text-[10px] tracking-wider font-bold rounded-md bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                          B. VIVA
                        </span>
                      ) : song.aiProcessed ? (
                        <span className="px-2 py-0.5 inline-flex text-[10px] tracking-wider font-bold rounded-md bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
                          IA
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 inline-flex text-[10px] tracking-wider font-bold rounded-md bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                          LOCAL
                        </span>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </Card>
          {renderLimit < filteredAndSortedSongs.length && (
            <div ref={loaderRef} className="h-20 w-full flex items-center justify-center border-t border-slate-200 dark:border-white/10 mt-4">
              <Spinner size="md" />
            </div>
          )}
        </>
        )
      ) : (
        searchTerm || statusFilter !== "all" ? (
        <EmptyState
          icon={<RepertoireIcon className="w-8 h-8" />}
          title="Nenhuma música encontrada"
          description="Tente ajustar os filtros, buscar por outro termo ou adicione uma nova música ao seu repertório."
          action={
            <Button
              onClick={
                isOverLimit ? () => setShowLimitModal(true) : () => openSongForm()
              }
              leftIcon={isOverLimit ? <AlertTriangle className="w-4 h-4" /> : <PlusIcon />}
              variant={isOverLimit ? "secondary" : "primary"}
            >
              Nova Música
            </Button>
          }
        />
      ) : canManageRepertoire ? (
        <div className="p-8 sm:p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center text-center max-w-2xl mx-auto mt-12 animate-fade-in shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-indigo-100 dark:border-indigo-500/20">
             <BookOpen className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-3">Comece com um repertório pronto</h3>
          <p className="text-slate-500 dark:text-zinc-400 text-sm sm:text-base mb-8 max-w-lg leading-relaxed">
            Selecionamos 10 músicas da Biblioteca Viva para sua equipe começar. Você poderá revisar tudo antes de adicionar.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
            <button 
              type="button"
              onClick={() => setIsStarterModalOpen(true)}
              className="px-6 py-3 bg-indigo-600 dark:bg-white text-white dark:text-zinc-900 text-sm font-bold rounded-xl hover:bg-indigo-700 dark:hover:bg-zinc-100 transition-colors shadow-sm"
            >
              Adicionar repertório inicial
            </button>
            <button 
              type="button"
              onClick={() => isAiImportAllowed ? openAiSongImport() : openSongForm()}
              className="px-6 py-3 bg-white dark:bg-zinc-800 text-slate-700 dark:text-white text-sm font-bold rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
            >
              {isAiImportAllowed ? 'Importar com IA' : 'Adicionar manualmente'}
            </button>
            {isAiImportAllowed && (
              <button 
                type="button"
                onClick={() => openSongForm()}
                className="px-6 py-3 bg-transparent text-slate-500 dark:text-zinc-400 text-sm font-bold rounded-xl hover:text-slate-700 dark:hover:text-zinc-300 transition-colors hidden sm:block"
              >
                Adicionar manualmente
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="p-8 sm:p-12 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center text-center max-w-2xl mx-auto mt-12 animate-fade-in shadow-sm">
          <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-100 dark:border-zinc-700">
             <RepertoireIcon className="w-8 h-8 text-slate-400 dark:text-zinc-500" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-3">Repertório Vazio</h3>
          <p className="text-slate-500 dark:text-zinc-400 text-sm sm:text-base max-w-lg leading-relaxed">
            Nenhuma música foi adicionada ainda. O repertório é gerenciado pela liderança do ministério.
          </p>
        </div>
      )
      )}

      <ConfirmationModal
        isOpen={isConfirmBulkDeleteOpen}
        onClose={() => setIsConfirmBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title="Excluir Músicas Selecionadas"
        message={`Tem certeza que deseja excluir as ${selectedSongIds.length} músicas selecionadas? Esta ação não pode ser desfeita.`}
        isLoading={isUpdating}
      />
      
      
      <Modal
        isOpen={isBulkManageOpen}
        onClose={() => setIsBulkManageOpen(false)}
        title=""
        fullWidth
        isFullScreenMobile // Mobile behavior as bottom sheet or full screen
      >
        <BulkManagePanel key={isBulkManageOpen ? "open" : "closed"}
           selectedCount={selectedSongIds.length}
           availableTags={tags} // tags from contexts/MusicDataContext
           onApply={handleBulkManageApply}
           onCancel={() => setIsBulkManageOpen(false)}
           onDelete={handleDeleteSelected}
        />
      </Modal>

      <ConfirmationModal
        isOpen={isBulkApplyConfirmOpen}
        title="Aplicar alterações às músicas selecionadas?"
        message={`As alterações selecionadas serão aplicadas a ${selectedSongIds.length} música(s).`}
        confirmLabel="Confirmar alterações"
        cancelLabel="Voltar"
        onConfirm={handleBulkApplyConfirm}
        onCancel={() => setIsBulkApplyConfirmOpen(false)}
        isLoading={isUpdating}
      />


      {/* Dynamic Floating Actions Bar */}
      {isSelectionMode && selectedSongIds.length > 0 && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 z-[50] flex items-center justify-between sm:justify-start gap-1 sm:gap-3 px-1.5 py-1.5 sm:px-6 sm:py-4 rounded-2xl bg-white/95 dark:bg-[#1C1C1D]/95 dark:backdrop-blur-3xl border border-slate-200/80 dark:border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.30)] w-[calc(100vw-1rem)] max-w-[360px] sm:w-auto sm:max-w-max animate-slide-up">
          
          <div className="flex items-center shrink-1 min-w-0 mr-auto sm:mr-0">
            <div className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white border-none sm:border-r sm:border-solid border-slate-200 dark:border-white/10 px-1.5 sm:px-0 sm:pr-3 sm:mr-1 shrink-0 flex items-center gap-1.5 h-6">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="truncate text-ellipsis">{selectedSongIds.length} <span className="hidden sm:inline">selecionadas</span></span>
            </div>

            <Button 
              size="sm" 
              variant="secondary" 
              onClick={handleSelectAll} 
              aria-label={allSelected ? "Desmarcar todas" : "Marcar todas"}
              title={allSelected ? "Desmarcar todas" : "Marcar todas"}
              className="text-xs py-1.5 px-0 sm:px-3 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 shrink-0 border-none sm:border-solid shadow-none sm:shadow-sm bg-transparent sm:bg-white dark:sm:bg-transparent active:bg-slate-100 dark:active:bg-white/10"
            >
              <CheckIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5 sm:mr-1 text-slate-500 dark:text-slate-400" />
              <span className="hidden sm:inline">{allSelected ? "Desmarcar" : "Marcar"} todas</span>
            </Button>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsBulkManageOpen(true)}
              className="text-xs py-1 px-2.5 sm:py-1.5 sm:px-3 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 shrink-0"
            >
              Gerenciar
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigate("/scales", { state: { preselectedSongIds: selectedSongIds } });
                setIsSelectionMode(false);
                setSelectedSongIds([]);
              }}
              className="text-xs py-1 px-2.5 sm:py-1.5 sm:px-3 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 shrink-0 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-slate-100 dark:hover:bg-white/5"
            >
              <span className="sm:hidden">Escala</span>
              <span className="hidden sm:inline">Criar escala</span>
            </Button>

            <div className="relative">
              <Button
                ref={moreButtonRef}
                variant="secondary"
                size="sm"
                onClick={() => setIsBulkMoreOpen(o => !o)}
                className="text-xs py-1 px-2.5 sm:py-1.5 sm:px-3 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 shrink-0 border-none sm:border-solid shadow-none sm:shadow-sm"
              >
                •••
              </Button>
              <Popover
                triggerRef={moreButtonRef}
                isOpen={isBulkMoreOpen}
                onClose={() => setIsBulkMoreOpen(false)}
                popoverRef={morePopoverRef}
                className="w-48 bg-white dark:bg-[#1A1A1C]/95 dark:backdrop-blur-3xl border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl z-[60] py-2"
              >
                <button
                  onClick={handleDeleteSelected}
                  className="w-full text-left px-4 py-2.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 font-bold"
                  disabled={selectedSongIds.length === 0}
                >
                  Excluir selecionadas
                </button>
              </Popover>
            </div>
            
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={handleToggleSelectionMode} 
              aria-label="Cancelar seleção"
              title="Cancelar seleção"
              className="text-xs py-1.5 px-0 sm:px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 shrink-0 border-none sm:border-solid shadow-none sm:shadow-sm bg-transparent sm:bg-white dark:sm:bg-transparent active:bg-slate-100 dark:active:bg-white/10 flex items-center justify-center p-0"
            >
              <span className="hidden sm:inline">Cancelar</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        </div>
      )}

      <UpgradePlanModal 
        isOpen={showLimitModal} 
        onClose={() => setShowLimitModal(false)}
        featureKey={"songsLimit" as any} 
      />

      <RepertoireAuditorModal
        isOpen={isAuditorOpen}
        onClose={() => setIsAuditorOpen(false)}
        songs={songs}
        organizationId={userProfile?.organizationId || ""}
        canManageRepertoire={canManageRepertoire}
        refreshSongs={refreshData}
      />

      <StarterRepertoireModal
          isOpen={isStarterModalOpen}
          onCancel={handleStarterRepertoireCancel}
          onCompleted={handleStarterRepertoireCompleted}
        />
    </div>
  );
};

export default SongsPage;
