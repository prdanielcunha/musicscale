import { logger } from "../lib/logger";
import React, { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, useFeatures } from "../contexts/AuthContext";
import { useMusicScaleUsage, useMusicScaleEntitlements } from "../hooks/useMusicScaleEntitlements";
import { entitlementsService } from "../services/entitlementsService";
import {
  getGlobalSongs,
  incrementGlobalSongImportCount,
  updateGlobalSongStatus,
  deleteGlobalSong,
  updateGlobalSong,
  getGlobalLibraryMetrics,
  updateGlobalSongFreshnessInBatch,
  updateGlobalSongLanguageInBatch,
} from "../services/globalLibraryService";
import { db } from "../services/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import type { GlobalSong, Song, PopulatedSong } from "../types";
import { useEcosystemAdmin } from "../hooks/useEcosystemAdmin";
import { useMusic } from "../contexts/MusicDataContext";
import { useApi } from "../contexts/ApiContext";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import AiSongImportModal from "../components/songs/AiSongImportModal";
import SongForm from "../components/songs/SongForm";
import { SparklesIcon } from "../components/icons/SparklesIcon";
import { MusicNoteIcon } from "../components/icons/MusicNoteIcon";
import {
  Search,
  Loader2,
  Plus,
  Upload,
  Sparkles,
  LayoutGrid,
  List,
  Library,
  Music,
  FileText,
  ChevronDown,
  Check,
  Download,
} from "lucide-react";
import { ImportGlobalSongsModal } from "../components/library/ImportGlobalSongsModal";
import { LibrarySongCard } from "../components/library/LibrarySongCard";
import { LibrarySongListRow } from "../components/library/LibrarySongListRow";
import { LibraryPreviewDrawer } from "../components/library/LibraryPreviewDrawer";
import { LibraryUsageBanner } from "../components/billing/LibraryUsageBanner";
import { StarterPackAllowanceCard } from "../components/onboarding/StarterPackAllowanceCard";
import { StarterRepertoireModal } from "../components/onboarding/StarterRepertoireModal";
import { useStarterPackAllowance } from "../hooks/useStarterPackAllowance";
import { LockedLibraryPreview } from "../components/library/LockedLibraryPreview";

import { DuplicateSongModal, DuplicateMatch } from "../components/songs/DuplicateSongModal";
import { BulkDuplicateSongModal } from "../components/songs/BulkDuplicateSongModal";
import { getSongSimilarityScore } from "../lib/songMatch";
import { useTranslation } from "react-i18next";
import { AdminCrossOrgImportModal } from "../components/admin/AdminCrossOrgImportModal";
import { buildSearchIndex, searchSongs } from "../utils/searchEngine";

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
      setStyle({
        position: "fixed",
        top: "-9999px",
        left: "-9999px",
        opacity: 0,
        transform: "translateY(-10px)",
      });
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

export default function LibraryPage() {
  const { user, userProfile, organization } = useAuth();
  const { t } = useTranslation();
  const { canAccessGlobalLibrary } = useFeatures();
  const { isEcosystemAdmin } = useEcosystemAdmin();
  const { refreshData, songs: localSongs } = useMusic();
  const { usage, limits } = useMusicScaleUsage();
  const { entitlements, refresh: refreshEntitlements } = useMusicScaleEntitlements();
  const api = useApi();
  const navigate = useNavigate();

  const { allowance, loading: allowanceLoading, error: allowanceError, refreshAllowance } = useStarterPackAllowance();
  const [isStarterModalOpen, setIsStarterModalOpen] = useState(false);
  const hasAccess = canAccessGlobalLibrary();

  const [songs, setSongs] = useState<GlobalSong[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [importingId, setImportingId] = useState<string | null>(null);

  // Initialize importedIds from local songs to accurate reflect DB status
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (localSongs) {
      const globalIds = new Set(
        localSongs
          .filter((s) => s.originGlobalSongId)
          .map((s) => s.originGlobalSongId as string),
      );
      setImportedIds(globalIds);
    }
  }, [localSongs]);

  const [isFocused, setIsFocused] = useState(false);

  // Pagination bounds
  const [lastVisible, setLastVisible] = useState<
    QueryDocumentSnapshot<DocumentData> | undefined
  >(undefined);
  const [hasMore, setHasMore] = useState(true);
  const requestGenerationRef = useRef(0);
  const pageLoadInFlightRef = useRef(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  // New precise state
  const [viewMode, setViewMode] = useState<"grid" | "list">(
    () =>
      (localStorage.getItem("libraryViewMode") as "grid" | "list") || "grid",
  );
  const [activeFilter, setActiveFilter] = useState<
    "tudo" | "completa" | "cifra" | "letra" | "importada" | "nao-importada"
  >("tudo");

  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportIntent, setPendingImportIntent] = useState(false);

  // Handle intent=import
  useEffect(() => {
    if (searchParams.get("intent") === "import" && hasAccess) {
      // Clean up the URL by removing the intent parameter but keeping others
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("intent");
      setSearchParams(newParams, { replace: true });

      setActiveFilter("nao-importada");
      setPendingImportIntent(true);
    }
  }, [searchParams, hasAccess, setSearchParams]);

  useEffect(() => {
    if (pendingImportIntent && searchInputRef.current) {
      searchInputRef.current.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setPendingImportIntent(false);
    }
  }, [pendingImportIntent]);

  const [sortBy, setSortBy] = useState<"importCount" | "title" | "newest">(
    "importCount",
  );

  // Mass Import & Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [isImportingMultiple, setIsImportingMultiple] = useState(false);

  // Bulk Updates State
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const [isLanguagePopoverOpen, setIsLanguagePopoverOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const statusTriggerRef = useRef<HTMLButtonElement>(null);
  const statusPopoverRef = useRef<HTMLDivElement>(null);
  const languageTriggerRef = useRef<HTMLButtonElement>(null);
  const languagePopoverRef = useRef<HTMLDivElement>(null);

  const handleBulkStatus = async (status: 'default' | 'new' | 'old') => {
    if (selectedSongIds.size === 0) return;
    if (!isEcosystemAdmin) {
      showToast(t("library.no_permission", "Sem permissão para esta ação."), "error");
      return;
    }
    setIsBulkUpdating(true);
    try {
      await updateGlobalSongFreshnessInBatch(
        Array.from(selectedSongIds),
        status,
        userProfile?.systemRole || '',
        isEcosystemAdmin
      );
      showToast(t("library.bulk_status_success", "Status atualizado em lote na Biblioteca Viva!"));
      setSelectedSongIds(new Set());
      setIsSelectionMode(false);
      setIsStatusPopoverOpen(false);
      loadSongs(true);
    } catch (err: any) {
      logger.error("Error bulk updating status", err);
      showToast("Erro ao atualizar status: " + (err.message || err), "error");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkLanguage = async (language: 'pt' | 'en' | 'es' | 'other' | 'unknown') => {
    if (selectedSongIds.size === 0) return;
    if (!isEcosystemAdmin) {
      showToast(t("library.no_permission", "Sem permissão para esta ação."), "error");
      return;
    }
    setIsBulkUpdating(true);
    try {
      await updateGlobalSongLanguageInBatch(
        Array.from(selectedSongIds),
        language,
        userProfile?.systemRole || '',
        isEcosystemAdmin
      );
      showToast(t("library.bulk_language_success", "Idioma atualizado em lote na Biblioteca Viva!"));
      setSelectedSongIds(new Set());
      setIsSelectionMode(false);
      setIsLanguagePopoverOpen(false);
      loadSongs(true);
    } catch (err: any) {
      logger.error("Error bulk updating language", err);
      showToast("Erro ao atualizar idioma: " + (err.message || err), "error");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Interactive preview
  const [previewSong, setPreviewSong] = useState<GlobalSong | null>(null);


  // Modals
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAdminImportModalOpen, setIsAdminImportModalOpen] = useState(false);
  const [adminImportContext, setAdminImportContext] = useState<GlobalSong[]>([]);
  const [songToEdit, setSongToEdit] = useState<GlobalSong | null>(null);
  const [limitBlockMeta, setLimitBlockMeta] = useState<{ title: string; text: string; cta: string } | null>(null);
  const [duplicateSingleInfo, setDuplicateSingleInfo] = useState<{ candidate: GlobalSong, matches: DuplicateMatch[] } | null>(null);
  const [duplicateBulkInfo, setDuplicateBulkInfo] = useState<{ candidates: GlobalSong[], originalSelection: GlobalSong[], duplicates: { candidate: any, matches: DuplicateMatch[] }[] } | null>(null);

  const [metrics, setMetrics] = useState({ total: 0, completa: 0, cifra: 0, letra: 0 });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    localStorage.setItem("libraryViewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (hasAccess) {
      getGlobalLibraryMetrics().then(setMetrics).catch(console.error);
    }
  }, [hasAccess]);

  const loadSongs = async (
    isFirstPage: boolean = false,
    term: string = searchTerm,
  ) => {
    if (!isFirstPage && (!hasMore || pageLoadInFlightRef.current)) return;

    const requestGeneration = isFirstPage
      ? ++requestGenerationRef.current
      : requestGenerationRef.current;

    if (!isFirstPage) {
      pageLoadInFlightRef.current = true;
    }

    setLoading(true);
    try {
      const result = await getGlobalSongs(
        term,
        isFirstPage ? undefined : lastVisible,
        30,
      );

      // A slower, older search must never replace a newer result set.
      if (requestGenerationRef.current !== requestGeneration) return;

      setSongs((prev) => {
        if (isFirstPage) return result.songs;

        const seen = new Set(prev.map(song => song.id));
        const appended = result.songs.filter(song => !seen.has(song.id));
        return [...prev, ...appended];
      });
      setLastVisible(result.lastVisible || undefined);
      setHasMore(result.hasMore ?? result.songs.length === 30);
    } catch (error) {
      if (requestGenerationRef.current === requestGeneration) {
        logger.error("Error loading library", error);
      }
    } finally {
      if (requestGenerationRef.current === requestGeneration) {
        setLoading(false);
      }
      if (!isFirstPage) {
        pageLoadInFlightRef.current = false;
      }
    }
  };

  // One canonical first-page request: immediate for the default list, debounced
  // only while the user is typing. This removes the previous duplicate mount
  // request and prevents stale searches from winning a race.
  useEffect(() => {
    if (!hasAccess) {
      requestGenerationRef.current++;
      pageLoadInFlightRef.current = false;
      setSongs([]);
      setLastVisible(undefined);
      setHasMore(true);
      return;
    }

    const delay = searchTerm.trim() ? 250 : 0;
    const handler = window.setTimeout(() => {
      void loadSongs(true, searchTerm);
    }, delay);

    return () => window.clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, searchTerm]);

  // Prefetch the next global-library window before the user reaches the end.
  // The button remains as an accessible/manual fallback.
  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasAccess || !hasMore || !!searchTerm.trim()) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          void loadSongs(false, "");
        }
      },
      { rootMargin: "1200px 0px", threshold: 0.01 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccess, hasMore, searchTerm, lastVisible]);

    const executeImport = async (globalSong: GlobalSong) => {
    if (!organization?.id || !user || !entitlements) return;
    try {
      const { importGlobalLibrarySongsWithUsageCheck } = await import("../services/usageService");
      
      const result = await importGlobalLibrarySongsWithUsageCheck(
        organization.id,
        user.uid,
        user.displayName || t("user", "Usuário"),
        [globalSong],
        entitlements.plan,
        entitlements.limits,
        entitlements.features,
        false,
        userProfile?.systemRole || ''
      );

      if (!result.success) {
        if (result.errorCode === 'STARTER_BLOCKED') {
          setLimitBlockMeta({
            title: t("library.limit_block.starter_title", "Biblioteca Viva disponível no Advanced"),
            text: t("library.limit_block.starter_text", "Importe músicas prontas, com letra, cifra, tom e BPM, e acelere a preparação do repertório."),
            cta: t("library.limit_block.starter_cta", "Fazer upgrade para Advanced — R$ 29,90/mês")
          });
        } else if (result.errorCode === 'ADVANCED_LIMIT_REACHED') {
          setLimitBlockMeta({
            title: t("library.limit_block.advanced_title", "Limite mensal de importações atingido"),
            text: t("library.limit_block.advanced_text", "Sua organização já usou as 10 importações permitidas este mês no plano Advanced. Faça upgrade para o Pro para ter importações ilimitadas."),
            cta: t("library.limit_block.advanced_cta", "Fazer upgrade para Pro — R$ 34,90/mês")
          });
        }
        return;
      }

      setImportedIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(globalSong.id);
        return newSet;
      });
      refreshData();
      refreshEntitlements();
    } catch (error) {
      logger.error("Error importing song", error);
    } finally {
      setImportingId(null);
    }
  };

  const handleImport = async (globalSong: GlobalSong, e?: React.MouseEvent, force = false) => {
    if (e) e.stopPropagation();
    if (!organization?.id || !user || !entitlements) return;

    setImportingId(globalSong.id);

    if (!force) {
        let matches: DuplicateMatch[] = [];
        for (const s of localSongs) {
          const score = getSongSimilarityScore(globalSong, s);
          if (score >= 0.7) {
             matches.push({
               song: s,
               score,
               matchType: score === 1.0 ? 'exact' : (score >= 0.85 ? 'probable' : 'possible'),
               location: 'repertoire'
             });
          }
        }
        matches.sort((a, b) => b.score - a.score);

        if (matches.length > 0) {
            setDuplicateSingleInfo({ candidate: globalSong, matches });
            return;
        }
    }

    await executeImport(globalSong);
  };

  const executeImportMultiple = async (validSongs: GlobalSong[]) => {
    setIsImportingMultiple(true);

    try {
      const { importGlobalLibrarySongsWithUsageCheck } = await import("../services/usageService");
      
      const result = await importGlobalLibrarySongsWithUsageCheck(
        organization!.id,
        user!.uid,
        user!.displayName || t("user", "Usuário"),
        validSongs,
        entitlements!.plan,
        entitlements!.limits,
        entitlements!.features,
        false,
        userProfile?.systemRole || ''
      );

      if (!result.success) {
        if (result.errorCode === 'STARTER_BLOCKED') {
          setLimitBlockMeta({
            title: t("library.limit_block.starter_title", "Biblioteca Viva disponível no Advanced"),
            text: t("library.limit_block.starter_text", "Importe músicas prontas, com letra, cifra, tom e BPM, e acelere a preparação do repertório."),
            cta: t("library.limit_block.starter_cta", "Fazer upgrade para Advanced — R$ 29,90/mês")
          });
        } else if (result.errorCode === 'ADVANCED_LIMIT_REACHED') {
          setLimitBlockMeta({
            title: t("library.limit_block.advanced_title", "Limite mensal de importações atingido"),
            text: t("library.limit_block.advanced_text", "Sua organização já usou as 10 importações permitidas este mês no plano Advanced. Faça upgrade para o Pro para ter importações ilimitadas."),
            cta: t("library.limit_block.advanced_cta", "Fazer upgrade para Pro — R$ 34,90/mês")
          });
        } else if (result.errorCode === 'INSUFFICIENT_IMPORT_QUOTA') {
          showToast(result.errorMessage || t("library.limit_exceeded", "Limite excedido."), "error");
        }
        return;
      }

      setImportedIds((prev) => {
        const newSet = new Set(prev);
        validSongs.forEach(s => newSet.add(s.id));
        return newSet;
      });
      
      refreshData();
      refreshEntitlements();
      showToast(t("library.imported_successfully", "{{count}} música(s) importada(s) com sucesso.", { count: result.importedCount }), "success");
      setSelectedSongIds(new Set());
      setIsSelectionMode(false);
    } catch (error) {
      logger.error("Error mass importing songs", error);
      showToast(t("library.import_error", "Ocorreu um erro ao importar algumas músicas. Tente novamente."), "error");
    } finally {
      setIsImportingMultiple(false);
    }
  };

  const handleImportMultiple = async (songsToImport: GlobalSong[], force = false) => {
    if (!organization?.id || !user || !entitlements) return;
    
    // Filter out already imported purely by id
    const validSongs = songsToImport.filter(s => !importedIds.has(s.id));
    if (validSongs.length === 0) {
      showToast(t("library.no_new_songs", "Nenhuma música nova para importar."), "info");
      return;
    }

    if (!force) {
        let duplicates: { candidate: any, matches: DuplicateMatch[] }[] = [];
        
        for (const candidate of validSongs) {
            let matches: DuplicateMatch[] = [];
            for (const s of localSongs) {
              const score = getSongSimilarityScore(candidate, s);
              if (score >= 0.7) {
                 matches.push({
                   song: s,
                   score,
                   matchType: score === 1.0 ? 'exact' : (score >= 0.85 ? 'probable' : 'possible'),
                   location: 'repertoire'
                 });
              }
            }
            if (matches.length > 0) {
               matches.sort((a, b) => b.score - a.score);
               duplicates.push({ candidate, matches });
            }
        }
        
        if (duplicates.length > 0) {
            setDuplicateBulkInfo({ candidates: validSongs, originalSelection: songsToImport, duplicates });
            return;
        }
    }

    await executeImportMultiple(validSongs);
  };

  const reloadData = async () => {
    loadSongs(true);
    getGlobalLibraryMetrics().then(setMetrics).catch(console.error);
  };

  const handleSaveGlobalSong = async (
    songData:
      | Omit<Song, "id" | "createdAt" | "lastPlayed" | "createdBy">
      | Song,
    options: { saveToOrganization: boolean; saveToGlobalLibrary: boolean },
  ) => {
    if (!api || !userProfile) return;
    try {
      if (songToEdit) {
        await updateGlobalSong(
          songToEdit.id,
          songData as any,
          userProfile.systemRole,
          true,
        );
      } else {
        if (options.saveToGlobalLibrary) {
          await api.submitToGlobal(userProfile, songData);
        }
        if (options.saveToOrganization) {
          await api.songs.create(songData as any);
          refreshData();
        }
      }
      setIsFormModalOpen(false);
      setSongToEdit(null);
      reloadData();
    } catch (e) {
      logger.error("Error saving global song", e);
    }
  };

  const handleDeleteGlobalSong = async (
    song: GlobalSong,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!userProfile) return;
    if (
      !window.confirm(
        t("library.confirm_delete_global", "Tem certeza que deseja excluir '{{title}}' da Biblioteca Viva? Esta ação não pode ser desfeita.", { title: song.title })
      )
    )
      return;

    try {
      await deleteGlobalSong(song.id, userProfile.systemRole, true);
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
      getGlobalLibraryMetrics().then(setMetrics).catch(console.error);
    } catch (err: any) {
      logger.error("Error deleting global song", err);
    }
  };

  const handleEditGlobalSong = (song: GlobalSong, e: React.MouseEvent) => {
    e.stopPropagation();
    setSongToEdit(song);
    setIsFormModalOpen(true);
  };

  const searchIndex = useMemo(() => buildSearchIndex(songs), [songs]);

  const processedSongsWithMatch = useMemo(() => {
    let list = songs;

    // Filters
    if (activeFilter === "completa") {
      list = list.filter((s) => !!s.lyrics?.trim() && !!s.chords?.trim());
    } else if (activeFilter === "cifra") {
      list = list.filter((s) => !!s.chords?.trim());
    } else if (activeFilter === "letra") {
      list = list.filter((s) => !!s.lyrics?.trim());
    } else if (activeFilter === "importada") {
      list = list.filter((s) => importedIds.has(s.id));
    } else if (activeFilter === "nao-importada") {
      list = list.filter((s) => !importedIds.has(s.id));
    }

    let results = list.map(song => ({ song, searchMatch: undefined as import("../utils/searchEngine").SearchMatch | undefined }));

    if (searchTerm) {
      const allowedIds = new Set(list.map(song => song.id));
      const documents = searchIndex.filter(doc => allowedIds.has(doc.song.id));
      const matches = searchSongs(documents, searchTerm);
      results = matches.map(match => ({
        song: match.document.song as GlobalSong,
        searchMatch: match
      }));
    } else {
      results.sort((a, b) => {
        if (sortBy === "importCount") {
          return (b.song.importCount || 0) - (a.song.importCount || 0);
        } else if (sortBy === "newest") {
          return new Date(b.song.createdAt).getTime() - new Date(a.song.createdAt).getTime();
        } else {
          return a.song.title.localeCompare(b.song.title);
        }
      });
    }

    return results;
  }, [songs, searchTerm, activeFilter, sortBy, importedIds, searchIndex]);

  const processedSongs = useMemo(() => processedSongsWithMatch.map(r => r.song), [processedSongsWithMatch]);



  const isGlobalAdmin = ['owner', 'ecosystem_owner', 'founder', 'ceo', 'admin', 'global_admin'].includes(userProfile?.systemRole?.toLowerCase() || '');

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 dark:bg-[#070709] pb-24 md:pb-0">
      {/* Premium Hero */}
      <div className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-white dark:bg-[#0A0A0C] border-b border-black/5 dark:border-white/[0.02] relative overflow-hidden">
        {/* Subtle Ambient Glows */}
        <div className="absolute top-[0%] left-[0%] w-[50%] h-[100%] bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent rounded-full blur-[120px] pointer-events-none mix-blend-screen"></div>
        <div className="absolute bottom-[0%] right-[0%] w-[40%] h-[80%] bg-gradient-to-tl from-blue-500/5 via-cyan-500/5 to-transparent rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col gap-10 lg:gap-12">
          <div className="animate-fade-in-up w-full max-w-4xl">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/5 dark:bg-white/[0.03] border border-black/10 dark:border-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] backdrop-blur-xl text-slate-800 dark:text-slate-200 font-bold uppercase tracking-[0.2em] text-[10px] mb-8 ring-1 ring-white/10 dark:ring-white/[0.05] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-blue-500/10"></div>
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 relative z-10" />
              <span className="relative z-10">{t("library.premium_badge", "Acervo premium do MusicScale")}</span>
            </div>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tighter mb-6 leading-[1.05]">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-blue-500 dark:from-indigo-400 dark:to-cyan-400">
                Biblioteca Viva
              </span>
              <br className="hidden sm:block" />
              <span className="text-slate-800 dark:text-[#f8f8f8]"> MusicScale</span>
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl font-medium leading-relaxed">
              Um acervo premium e atualizado para sua equipe importar, ensaiar e ministrar com excelência.{' '}
              <span className="text-slate-900 dark:text-white font-semibold">Menos tempo procurando. Mais tempo adorando.</span>
            </p>
          </div>

          {/* Admin / Actions */}
          {isEcosystemAdmin && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 animate-fade-in-up w-full">
              <div className="w-full sm:w-auto flex flex-col sm:flex-row bg-black/5 dark:bg-white/[0.03] p-1.5 rounded-[22px] sm:rounded-[20px] items-stretch sm:items-center gap-1 border border-black/10 dark:border-white/[0.08] backdrop-blur-xl">
                <Button
                  onClick={() => setIsImportModalOpen(true)}
                  variant="ghost"
                  className="w-full sm:w-auto flex-1 justify-center text-[12px] h-12 font-bold uppercase tracking-wider px-4 sm:px-5 hover:bg-white dark:hover:bg-white/10 rounded-[16px] transition-all text-slate-700 dark:text-slate-300 min-w-0"
                >
                  <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 flex-shrink-0 opacity-70" />
                  <span className="text-center">{t("library.import_file", "Importar Arquivo")}</span>
                </Button>
                <div className="h-[1px] w-full sm:h-6 sm:w-[1px] bg-black/10 dark:bg-white/10 my-1 sm:my-0 sm:mx-1 flex-shrink-0"></div>
                <Button
                  onClick={() => setIsAiModalOpen(true)}
                  variant="ghost"
                  className="group relative w-full sm:w-auto flex-1 justify-center text-[12px] h-12 font-bold uppercase tracking-wider px-4 sm:px-5 hover:bg-white/50 dark:hover:bg-white/5 rounded-[16px] transition-all min-w-0 overflow-hidden"
                >
                  {/* Subtle magic background glow on hover */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-indigo-500/10 to-purple-500/0 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-700"></div>
                  
                  <Sparkles className="relative z-10 w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 flex-shrink-0 text-indigo-500 dark:text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors" />
                  
                  <span className="text-center relative z-10 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent group-hover:from-indigo-500 group-hover:to-purple-500 transition-colors">
                    {t("library.create_ai", "Criar por IA")}
                  </span>
                  
                  {/* Expanding line effect on hover */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-500 dark:via-indigo-400 to-transparent group-hover:w-3/4 transition-all duration-500 opacity-0 group-hover:opacity-100"></div>
                </Button>
              </div>

              <Button
                onClick={() => setIsFormModalOpen(true)}
                variant="primary"
                className="relative overflow-hidden bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white shadow-[0_8px_30px_rgba(79,70,229,0.3)] text-[12px] h-[60px] px-8 rounded-[20px] font-black uppercase tracking-widest border border-indigo-700/50 dark:border-indigo-400/30 transition-all active:scale-[0.98] group"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                <div className="flex items-center relative z-10 w-full justify-center">
                  <Plus className="w-4 h-4 mr-2" />
                  <span>{t("library.create_global", "Criar Música Global")}</span>
                </div>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        <div className="animate-fade-in-up space-y-4">
          <h2 className="text-xs font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-widest pl-1">
            {t('starterPackAllowance.accessOverviewTitle', 'SEUS ACESSOS')}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            {(!allowance?.completed || allowanceLoading || allowanceError) && (
              <div className="flex flex-col h-full">
                <StarterPackAllowanceCard 
                  allowance={allowance} 
                  loading={allowanceLoading}
                  error={allowanceError}
                  onRetry={refreshAllowance}
                  onOpen={() => setIsStarterModalOpen(true)}
                  variant="library"
                />
              </div>
            )}
            <div className="flex flex-col h-full">
              <LibraryUsageBanner />
            </div>
          </div>
        </div>

        {/* Quick Metrics */}
        {hasAccess && metrics.total > 0 && (
          <div
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            <div className="relative overflow-hidden bg-white dark:bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] border border-black/5 dark:border-white/[0.05] rounded-[24px] p-5 lg:p-6 flex flex-col gap-5 xl:gap-8 group transition-all duration-300 hover:border-black/10 dark:hover:bg-[#18181b]/70 md:hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
              <div className="w-12 h-12 rounded-[16px] bg-slate-100 dark:bg-white/[0.04] shadow-none dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-black/5 dark:border-white/[0.04] flex items-center justify-center text-slate-800 dark:text-slate-300">
                <Library className="w-6 h-6" />
              </div>
              <div>
                <p className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1.5 transition-transform group-hover:scale-[1.02] origin-left">
                  {metrics.total}
                </p>
                <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest opacity-80">
                  {t("library.songs_in_pool", "Músicas no Acervo")}
                </p>
              </div>
            </div>
            {metrics.completa > 0 && (
              <div className="relative overflow-hidden bg-white dark:bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] border border-black/5 dark:border-white/[0.05] rounded-[24px] p-5 lg:p-6 flex flex-col gap-5 xl:gap-8 group transition-all duration-300 hover:border-black/10 dark:hover:bg-[#18181b]/70 md:hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
                <div className="w-12 h-12 rounded-[16px] bg-indigo-50 dark:bg-indigo-500/10 shadow-none dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Check className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1.5 transition-transform group-hover:scale-[1.02] origin-left">
                    {metrics.completa}
                  </p>
                  <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest opacity-80">
                    {t("library.complete_metric", "Completas")}
                  </p>
                </div>
              </div>
            )}
            {metrics.cifra > 0 && (
              <div className="relative overflow-hidden bg-white dark:bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] border border-black/5 dark:border-white/[0.05] rounded-[24px] p-5 lg:p-6 md:flex flex flex-col gap-5 xl:gap-8 hidden group transition-all duration-300 hover:border-black/10 dark:hover:bg-[#18181b]/70 md:hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/10 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
                <div className="w-12 h-12 rounded-[16px] bg-sky-50 dark:bg-sky-500/10 shadow-none dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-sky-100 dark:border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <Music className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1.5 transition-transform group-hover:scale-[1.02] origin-left">
                    {metrics.cifra}
                  </p>
                  <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest opacity-80">
                    {t("library.with_chords", "Com Cifra")}
                  </p>
                </div>
              </div>
            )}
            {metrics.letra > 0 && (
              <div className="relative overflow-hidden bg-white dark:bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] border border-black/5 dark:border-white/[0.05] rounded-[24px] p-5 lg:p-6 md:flex flex flex-col gap-5 xl:gap-8 hidden group transition-all duration-300 hover:border-black/10 dark:hover:bg-[#18181b]/70 md:hover:-translate-y-1">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[30px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none" />
                <div className="w-12 h-12 rounded-[16px] bg-emerald-50 dark:bg-emerald-500/10 shadow-none dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none mb-1.5 transition-transform group-hover:scale-[1.02] origin-left">
                    {metrics.letra}
                  </p>
                  <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest opacity-80">
                    {t("library.with_lyrics", "Com Letra")}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {!hasAccess ? <div className="mt-8"><LockedLibraryPreview /></div> : (
          <>
        {/* Premium Search & Filters & View Toggle */}
        <div
          className="flex flex-col gap-4 animate-fade-in-up"
          style={{ animationDelay: "150ms" }}
        >
          <div className="relative group max-w-4xl">
            <div
              className={`absolute -inset-1 bg-gradient-to-r from-slate-200 to-slate-100 dark:from-white/10 dark:to-transparent rounded-[32px] blur-md opacity-0 transition-opacity duration-700 ${isFocused ? "opacity-100" : ""}`}
            ></div>
            <div
              className={`relative flex items-center bg-white dark:bg-[#121214]/80 backdrop-blur-2xl rounded-[28px] border transition-all duration-300 overflow-hidden shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] ${isFocused ? "border-slate-300 dark:border-white/20 ring-4 ring-black/5 dark:ring-white/5" : "border-black/5 dark:border-white/[0.08]"}`}
            >
              <div className="pl-6 pr-4 py-5 md:py-6">
                <Search
                  className={`w-6 h-6 transition-colors ${isFocused ? "text-slate-900 dark:text-white" : "text-slate-500"}`}
                />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t("library.search_placeholder", "Buscar por música, artista, trecho da letra, tom ou BPM...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                className="flex-1 bg-transparent border-0 py-5 md:py-6 pr-6 lg:text-xl font-medium text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-0 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-6 w-full relative">
            {/* Filters (Scrollable on Mobile & Desktop) */}
            <div className="flex-1 min-w-0 w-full relative">
              <div className="overflow-x-auto pb-2 md:pb-0 hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                <div className="flex items-center gap-2 min-w-max pr-12 lg:pr-8">
                  {[
                    { id: "tudo", label: t("library.filter_all", "Todas") },
                    { id: "completa", label: t("library.complete", "Completas") },
                    { id: "cifra", label: t("library.with_chords_label", "Com Cifra") },
                    { id: "letra", label: t("library.with_lyrics_label", "Com Letra") },
                    { id: "importada", label: t("library.imported", "Já Importadas") },
                    { id: "nao-importada", label: t("library.not_imported", "Não Importadas") },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id as any)}
                      className={`h-10 px-5 rounded-full text-[13px] font-bold tracking-wide transition-all shrink-0 ${
                        activeFilter === filter.id
                          ? "bg-slate-900 text-white dark:bg-white dark:text-black shadow-md"
                          : "bg-white text-slate-600 border border-black/[0.06] hover:bg-slate-50 dark:bg-[#1A1A1C]/60 dark:text-slate-400 dark:border-white/[0.06] dark:hover:bg-white/[0.08] dark:hover:text-slate-200"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Premium Scroll Fade Indicators */}
              <div className="absolute top-0 right-0 bottom-0 md:bottom-0 w-12 bg-gradient-to-l from-white dark:from-[#0A0A0C] to-transparent pointer-events-none z-10" />
            </div>

            {/* Selection & Sort Controls */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {!isSelectionMode ? (
                <>
                  <button
                    onClick={() => {
                        const confirmImportAll = window.confirm(
                          `${t("library.confirm_import_all_title", "Importar músicas da Biblioteca Viva?")}\n\n${t("library.confirm_import_all_desc", "Vamos adicionar ao seu repertório as músicas visíveis que ainda não estão nele. Músicas já adicionadas serão ignoradas automaticamente.")}`
                        );
                        if (confirmImportAll) {
                          handleImportMultiple(processedSongs);
                        }
                    }}
                    disabled={processedSongs.length === 0 || isImportingMultiple}
                    className="h-10 px-4 flex items-center gap-2 rounded-xl text-[13px] font-bold bg-white dark:bg-[#1A1A1C]/60 border border-black/[0.06] dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-blue-600 dark:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImportingMultiple ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    {t("library.import_all", "Importar Todas")}
                  </button>
                  <button 
                    onClick={() => setIsSelectionMode(true)}
                    className="h-10 px-4 rounded-xl text-[13px] font-bold bg-white dark:bg-[#1A1A1C]/60 border border-black/[0.06] dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/5 transition-all outline-none"
                  >
                    {t("library.select", "Selecionar")}
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedSongIds(new Set());
                  }}
                  className="h-10 px-4 flex items-center gap-2 rounded-xl text-[13px] font-bold bg-slate-200 text-slate-800 dark:bg-white/10 dark:text-white hover:bg-slate-300 dark:hover:bg-white/20 transition-all outline-none"
                >
                  {t("library.cancel_selection", "Cancelar Seleção")}
                </button>
              )}

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none h-10 w-full pl-4 pr-10 rounded-xl bg-white dark:bg-[#1A1A1C]/60 border border-black/[0.06] dark:border-white/[0.06] shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)] text-[13px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <option value="importCount">{t("library.most_imported", "Mais importadas")}</option>
                  <option value="newest">{t("library.newest", "Mais recentes")}</option>
                  <option value="title">{t("library.alphabetical", "A-Z")}</option>
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>

              <div className="flex bg-slate-200/50 dark:bg-white/[0.04] p-1 rounded-xl items-center border border-black/[0.04] dark:border-white/[0.04]">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  title={t("library.grid_view", "Visualização em Grade")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                  title={t("library.list_view", "Visualização em Lista")}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Mass Selection Action Bar */}
          {isSelectionMode && (
             <div className="sticky top-20 z-30 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-[20px] bg-white/95 dark:bg-[#151515]/95 backdrop-blur-xl border border-blue-500/20 dark:border-blue-400/20 shadow-[0_8px_30px_rgba(59,130,246,0.12)]">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                   <div className="flex items-center justify-center bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-black h-10 px-4 rounded-xl text-sm">
                      {selectedSongIds.size === 1 
                        ? t("library.selected_one", "1 selecionada") 
                        : t("library.selected_other", "{{count}} selecionadas", { count: selectedSongIds.size })}
                   </div>
                   <div className="flex gap-2">
                     <button
                       onClick={() => {
                         const availableToSelect = processedSongs.filter(s => !importedIds.has(s.id)).map(s => s.id);
                         setSelectedSongIds(new Set(availableToSelect));
                       }}
                       className="text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                     >
                       {t("library.select_all", "Selecionar Todas")}
                     </button>
                     <span className="text-slate-300 dark:text-slate-700">|</span>
                     <button
                       onClick={() => setSelectedSongIds(new Set())}
                       className="text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                     >
                       {t("library.none", "Nenhuma")}
                     </button>
                   </div>
                </div>
                
                <div className="w-full sm:w-auto flex flex-col sm:flex-row flex-wrap gap-2 justify-end">
                   {isEcosystemAdmin && (
                     <>
                       <div className="relative w-full sm:w-auto">
                         <button
                           ref={statusTriggerRef}
                           disabled={selectedSongIds.size === 0 || isBulkUpdating}
                           onClick={() => setIsStatusPopoverOpen((prev) => !prev)}
                           className="flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E1E24]/90 dark:backdrop-blur-md px-5 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-white/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           {isBulkUpdating ? (
                             <Loader2 className="size-4 animate-spin" />
                           ) : (
                             <>
                               <span>Status</span>
                               <ChevronDown className="size-4 opacity-70" />
                             </>
                           )}
                         </button>

                         <Popover
                           triggerRef={statusTriggerRef}
                           isOpen={isStatusPopoverOpen}
                           onClose={() => setIsStatusPopoverOpen(false)}
                           popoverRef={statusPopoverRef}
                           className="w-48 bg-white dark:bg-[#1A1A1C]/95 dark:backdrop-blur-3xl border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl z-[60] py-2"
                         >
                           <button
                             onClick={() => handleBulkStatus("default")}
                             className="w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-white/5 font-medium flex items-center gap-2 text-slate-700 dark:text-slate-200"
                           >
                             <span>⚪</span> {t("songs.no_status", "Sem status")}
                           </button>
                           <button
                             onClick={() => handleBulkStatus("new")}
                             className="w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-white/5 font-medium flex items-center gap-2 text-slate-700 dark:text-slate-200"
                           >
                             <span className="text-emerald-500 font-bold">●</span> {t("songs.new_badge", "Nova")}
                           </button>
                           <button
                             onClick={() => handleBulkStatus("old")}
                             className="w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-white/5 font-medium flex items-center gap-2 text-slate-700 dark:text-slate-200"
                           >
                             <span className="text-amber-500 font-bold">●</span> {t("songs.old_badge", "Antiga")}
                           </button>
                         </Popover>
                       </div>

                       <div className="relative w-full sm:w-auto">
                         <button
                           ref={languageTriggerRef}
                           disabled={selectedSongIds.size === 0 || isBulkUpdating}
                           onClick={() => setIsLanguagePopoverOpen((prev) => !prev)}
                           className="flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1E1E24]/90 dark:backdrop-blur-md px-5 text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-white/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           {isBulkUpdating ? (
                             <Loader2 className="size-4 animate-spin" />
                           ) : (
                             <>
                               <span>Idioma</span>
                               <ChevronDown className="size-4 opacity-70" />
                             </>
                           )}
                         </button>

                         <Popover
                           triggerRef={languageTriggerRef}
                           isOpen={isLanguagePopoverOpen}
                           onClose={() => setIsLanguagePopoverOpen(false)}
                           popoverRef={languagePopoverRef}
                           className="w-56 bg-white dark:bg-[#1A1A1C]/95 dark:backdrop-blur-3xl border border-slate-200 dark:border-white/[0.08] rounded-2xl shadow-2xl z-[60] py-2"
                         >
                           <button
                             onClick={() => handleBulkLanguage("pt")}
                             className="w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-white/5 font-medium flex items-center gap-2 text-slate-700 dark:text-slate-200"
                           >
                             <span>🇧🇷</span> Português / BR
                           </button>
                           <button
                             onClick={() => handleBulkLanguage("en")}
                             className="w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-white/5 font-medium flex items-center gap-3 text-slate-700 dark:text-slate-200"
                           >
                             <span>🇺🇸</span> Inglês
                           </button>
                           <button
                             onClick={() => handleBulkLanguage("es")}
                             className="w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-white/5 font-medium flex items-center gap-3 text-slate-700 dark:text-slate-200"
                           >
                             <span>🇪🇸</span> Espanhol
                           </button>
                           <button
                             onClick={() => handleBulkLanguage("other")}
                             className="w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-white/5 font-medium flex items-center gap-3 text-slate-700 dark:text-slate-200"
                           >
                             <span>🌐</span> Outro
                           </button>
                           <button
                             onClick={() => handleBulkLanguage("unknown")}
                             className="w-full text-left px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-white/5 font-medium flex items-center gap-3 text-slate-700 dark:text-slate-200"
                           >
                             <span>❓</span> Desconhecido
                           </button>
                         </Popover>
                       </div>
                     </>
                   )}
                   
                  {isGlobalAdmin && (
                    <button
                      disabled={selectedSongIds.size === 0 || isImportingMultiple}
                      onClick={() => {
                          const selectedSongs = processedSongs.filter(s => selectedSongIds.has(s.id));
                          setAdminImportContext(selectedSongs);
                          setIsAdminImportModalOpen(true);
                      }}
                      className="flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-amber-600 px-6 text-sm font-bold text-white shadow-md transition-all hover:bg-amber-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <>
                        <Download className="size-4" />
                        Importar para Organização (Admin)
                      </>
                    </button>
                  )}
                  <button
                    disabled={selectedSongIds.size === 0 || isImportingMultiple}
                    onClick={() => {
                        const selectedSongs = processedSongs.filter(s => selectedSongIds.has(s.id));
                        handleImportMultiple(selectedSongs);
                    }}
                    className="flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-blue-600 px-6 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImportingMultiple ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("library.importing", "Importando...")}
                      </>
                    ) : (
                      <>
                        <Download className="size-4" />
                        {t("library.import_selected", "Importar Selecionadas")}
                      </>
                    )}
                  </button>
                </div>
             </div>
          )}
        </div>

        {/* Global Songs Feed */}
        <div className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
          {loading && songs.length === 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-1  lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse bg-white/40 dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.04] h-56 rounded-[24px]"
                  ></div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col rounded-2xl border border-black/[0.04] dark:border-white/[0.04] overflow-hidden bg-white/40 dark:bg-white/[0.02]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="animate-pulse h-20 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0"
                  ></div>
                ))}
              </div>
            )
          ) : processedSongs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center bg-white dark:bg-[#1A1A1C]/60 rounded-[32px] border border-black/[0.04] dark:border-white/[0.06]">
              <div className="w-20 h-20 mb-6 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center text-slate-300 dark:text-slate-600">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                {searchTerm
                  ? t("library.no_songs_found", "Nenhuma música encontrada")
                  : t("library.library_being_prepared", "A Biblioteca Viva está sendo preparada")}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8 font-medium">
                {searchTerm
                  ? t("library.no_results_for", 'Não encontramos resultados para "{{search}}". Tente usar palavras-chave diferentes.', { search: searchTerm })
                  : t("library.coming_soon_desc", "Em breve sua equipe terá acesso a um acervo poderoso de músicas prontas para importar.")}
              </p>
              {searchTerm && (
                <Button
                  onClick={() => setSearchTerm("")}
                  variant="secondary"
                  className="px-8"
                >
                  {t("library.clear_search", "Limpar Busca")}
                </Button>
              )}
            </div>
          ) : (
            <>
              {isSelectionMode && processedSongs.every(s => importedIds.has(s.id)) && (
                 <div className="mb-8 p-6 flex flex-col md:flex-row items-center gap-6 justify-between bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 text-emerald-900 dark:text-emerald-100 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Check className="size-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold">{t("library.no_songs_available_to_select", "Nenhuma música disponível para seleção")}</h4>
                        <p className="text-sm opacity-80 max-w-md">{t("library.displayed_already_added", "As músicas exibidas já foram adicionadas ao seu repertório.")}</p>
                      </div>
                    </div>
                 </div>
              )}
              
              {!isSelectionMode && processedSongs.length > 0 && processedSongs.every(s => importedIds.has(s.id)) && (
                 <div className="mb-8 p-6 flex flex-col md:flex-row items-center gap-6 justify-between bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-100 dark:border-blue-500/20 text-blue-900 dark:text-blue-100 shrink-0">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                        <Library className="size-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold">{t("library.library_up_to_date", "Sua biblioteca está em dia")}</h4>
                        <p className="text-sm opacity-80 max-w-md">{t("library.all_displayed_imported", "Todas as músicas exibidas já fazem parte do repertório da sua organização.")}</p>
                      </div>
                    </div>
                    <div>
                      <Button
                        variant="secondary"
                        onClick={() => navigate('/repertoire')}
                        className="whitespace-nowrap"
                      >
                        {t("library.view_repertoire", "Ver Repertório")}
                      </Button>
                    </div>
                 </div>
              )}

              {viewMode === "grid" ? (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 sm:gap-6">
                  {processedSongsWithMatch.map(({ song, searchMatch }) => (
                    <LibrarySongCard
                      key={song.id}
                      song={song}
                      isImporting={importingId === song.id}
                      isImported={importedIds.has(song.id)}
                      onImport={handleImport}
                      onClick={setPreviewSong}
                      onEdit={handleEditGlobalSong}
                      onDelete={handleDeleteGlobalSong}
                      isEcosystemAdmin={isEcosystemAdmin}
                      selectable={isSelectionMode}
                      selected={selectedSongIds.has(song.id)}
                      onToggleSelection={(id) => {
                         setSelectedSongIds(prev => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                         });
                      }}
                      searchMatch={searchMatch}
                      searchTerm={searchTerm}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col rounded-[24px] border border-black/[0.04] dark:border-white/[0.05] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] bg-white/40 dark:bg-[#121214]/60 backdrop-blur-[32px] saturate-[180%]">
                  {processedSongsWithMatch.map(({ song, searchMatch }) => (
                    <LibrarySongListRow
                      key={song.id}
                      song={song}
                      isImporting={importingId === song.id}
                      isImported={importedIds.has(song.id)}
                      onImport={handleImport}
                      onClick={setPreviewSong}
                      onEdit={handleEditGlobalSong}
                      onDelete={handleDeleteGlobalSong}
                      isEcosystemAdmin={isEcosystemAdmin}
                      selectable={isSelectionMode}
                      selected={selectedSongIds.has(song.id)}
                      onToggleSelection={(id) => {
                         setSelectedSongIds(prev => {
                            const next = new Set(prev);
                            if (next.has(id)) next.delete(id);
                            else next.add(id);
                            return next;
                         });
                      }}
                      searchMatch={searchMatch}
                      searchTerm={searchTerm}
                    />
                  ))}
                </div>
              )}

              {hasMore && !searchTerm && (
                <div ref={loadMoreSentinelRef} className="pt-12 pb-12 flex justify-center">
                  <Button
                    onClick={() => loadSongs()}
                    disabled={loading}
                    variant="secondary"
                    className="px-8 bg-white dark:bg-white/5 border border-black/[0.06] dark:border-white/[0.06] hover:bg-slate-50 dark:hover:bg-white/10"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />{" "}
                        {t("library.loading", "Carregando...")}
                      </span>
                    ) : (
                      t("library.load_more", "Carregar mais músicas")
                    )}
                  </Button>
                </div>
              )}
              {searchTerm && hasMore && (
                <div className="pt-8 pb-12 flex justify-center text-center">
                  <p className="text-sm font-medium text-slate-400">
                    {t("library.local_search_hint", "Exibindo resultados locais rápidos. Limpe a busca e clique em 'Carregar mais' para ampliar a base.")}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
        </>
        )}
      </div>

      <LibraryPreviewDrawer
        isOpen={!!previewSong}
        onClose={() => setPreviewSong(null)}
        song={previewSong}
        isImporting={previewSong ? importingId === previewSong.id : false}
        isImported={previewSong ? importedIds.has(previewSong.id) : false}
        onImport={handleImport}
      />

      {/* Global Admin Modals */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSongToEdit(null);
        }}
      >
        <SongForm
          songToEdit={songToEdit as unknown as PopulatedSong}
          onSave={handleSaveGlobalSong}
          onClose={() => {
            setIsFormModalOpen(false);
            setSongToEdit(null);
          }}
          isSubmitting={loading}
          tags={[]} // Provide available tags if needed later
          defaultOptions={{
            saveToOrganization: false,
            saveToGlobalLibrary: true,
          }}
        />
      </Modal>

      <AiSongImportModal
        isOpen={isAiModalOpen}
        onClose={() => {
          setIsAiModalOpen(false);
          loadSongs(true);
        }}
        defaultOptions={{
          saveToOrganization: false,
          saveToGlobalLibrary: true,
        }}
      />

      <StarterRepertoireModal
        isOpen={isStarterModalOpen}
        onCancel={() => setIsStarterModalOpen(false)}
        onCompleted={async () => {
          setIsStarterModalOpen(false);
          await reloadData();
          await refreshAllowance();
        }}
      />
      <ImportGlobalSongsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => loadSongs(true)}
      />

      <Modal isOpen={!!limitBlockMeta} onClose={() => setLimitBlockMeta(null)}>
        <div className="p-6 text-center font-sans">
          <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 dark:bg-zinc-850 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-2">
            {limitBlockMeta?.title}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
            {limitBlockMeta?.text}
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                const billingUrl = entitlementsService.getMillionsNestBaseUrl() + "/dashboard/billing";
                window.open(billingUrl, "_blank", "noreferrer,noopener");
                setLimitBlockMeta(null);
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm transition-all text-center cursor-pointer"
            >
              {limitBlockMeta?.cta}
            </button>
            <button
              onClick={() => setLimitBlockMeta(null)}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700/60 transition-all cursor-pointer"
            >
              {t("common.close", "Fechar")}
            </button>
          </div>
        </div>
      </Modal>

      <DuplicateSongModal
        isOpen={!!duplicateSingleInfo}
        onClose={() => setDuplicateSingleInfo(null)}
        candidateSong={duplicateSingleInfo?.candidate}
        matches={duplicateSingleInfo?.matches || []}
        onSaveAnyway={() => {
          const candidate = duplicateSingleInfo?.candidate;
          setDuplicateSingleInfo(null);
          if (candidate) executeImport(candidate);
        }}
        onEditExisting={() => {
          setDuplicateSingleInfo(null);
          // Just close for global library import, or point to song in Repertoire
          showToast(t("library.go_to_repertoire", "Acesse o seu Repertório para editar a música existente."), "info");
        }}
        isLoading={importingId !== null}
      />

      <BulkDuplicateSongModal
        isOpen={!!duplicateBulkInfo}
        onClose={() => setDuplicateBulkInfo(null)}
        duplicates={duplicateBulkInfo?.duplicates || []}
        onIgnoreAll={() => {
          const duplicatesSet = new Set(duplicateBulkInfo?.duplicates.map(d => d.candidate.id));
          const onlyNew = duplicateBulkInfo?.candidates.filter(c => !duplicatesSet.has(c.id)) || [];
          setDuplicateBulkInfo(null);
          executeImportMultiple(onlyNew);
        }}
        onSaveAllAnyway={() => {
          const candidates = duplicateBulkInfo?.candidates || [];
          setDuplicateBulkInfo(null);
          executeImportMultiple(candidates);
        }}
        isLoading={isImportingMultiple}
      />

      <AdminCrossOrgImportModal
        isOpen={isAdminImportModalOpen}
        onClose={() => {
          setIsAdminImportModalOpen(false);
          setAdminImportContext([]);
        }}
        songsToImport={adminImportContext}
        onSuccess={() => {
          setIsAdminImportModalOpen(false);
          setAdminImportContext([]);
          setSelectedSongIds(new Set());
          setIsSelectionMode(false);
          showToast("Importação finalizada e enviada para a organização de destino.", "success");
        }}
      />

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100000] max-w-md bg-zinc-900 text-white rounded-2xl shadow-2xl p-4 border border-zinc-800 flex items-center gap-3 animate-fade-in-up font-sans">
          <div className="p-1 rounded-full bg-indigo-500/20 text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <p className="text-xs font-semibold">{toast.message}</p>
        </div>
      )}
    </div>
  );
}
