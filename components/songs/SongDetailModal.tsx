import { logger } from "../../lib/logger";

import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { PopulatedSong, PopulatedScale } from "../../types";
import { useApi } from "../../contexts/ApiContext";
import { useMusic } from "../../contexts/MusicDataContext";
import { useModals } from "../../contexts/ModalContext";
import { getScaleTitle } from "../../utils/scaleHelper";
import { useCapability } from "../../hooks/useCapability";
import Modal from "../common/Modal";
import Button from "../common/Button";
import Tag from "../common/Tag";
import { CalendarIcon } from "../icons/CalendarIcon";
import { KeyIcon } from "../icons/KeyIcon";
import { BpmIcon } from "../icons/BpmIcon";
import { HashIcon } from "../icons/HashIcon";
import { HistoryIcon } from "../icons/HistoryIcon";
import { UserIcon } from "../icons/UserIcon";
import ChordsViewerModal from "./ChordsViewerModal";
import { ChordsIcon } from "../icons/ChordsIcon";
import { VideoIcon } from "../icons/VideoIcon";
import { LyricsIcon } from "../icons/LyricsIcon";
import WebViewerModal from "../common/WebViewerModal";
import LyricsViewerModal from "./LyricsViewerModal";
import Metronome from "../common/Metronome";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { submitFeedback } from "../../services/feedback";
import { ShareIcon } from "../icons/ShareIcon";
import { LinkIcon } from "../icons/LinkIcon";
import { toPng, toBlob } from "html-to-image";
import SongShareImage from "./SongShareImage";
import { clearPerformanceState } from "../../services/offline/database";
import { RehearsalReferenceCard } from "./RehearsalReferenceCard";
import Spinner from "../common/Spinner";

// Icons
const EditIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002 2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);
const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);
const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    viewBox="0 0 20 20"
    fill="currentColor"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
      clipRule="evenodd"
    />
  </svg>
);
const ExternalLinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-4 w-4"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);
const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.25 4.5l7.5 7.5-7.5 7.5"
    />
  </svg>
);
const ImageIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

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
        let left = rect.right - popoverWidth;

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

interface SongDetailModalProps {
  song: PopulatedSong | null;
  onClose: () => void;
  onEdit: (song: PopulatedSong) => void;
  onDelete: (song: PopulatedSong) => void;
  onCreateScale: (song: PopulatedSong) => void;
  scaleContext: { scaleId?: string, songs: PopulatedSong[]; currentIndex: number } | null;
  onNavigate: (direction: "next" | "previous" | number) => void;
  startInPerformanceMode?: boolean;
  openMode?: "detail" | "lyrics" | "chords" | "performance";
}

const statusMap = {
  active: {
    text: "Ativa",
    className:
      "bg-green-100 dark:bg-green-500/20 text-green-800 dark:text-green-300",
  },
  inactive: {
    text: "Inativa",
    className:
      "bg-slate-200 dark:bg-gray-600/50 text-slate-600 dark:text-gray-400",
  },
};

const InfoCard: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = "" }) => (
  <div
    className={`bg-white dark:bg-[#2C2C2E] p-5 rounded-[20px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-none ${className}`}
  >
    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-2">
      {title}
    </h4>
    {children}
  </div>
);

const SongDetailModal: React.FC<SongDetailModalProps> = ({
  song: initialSong,
  onClose,
  onEdit,
  onDelete,
  onCreateScale,
  scaleContext,
  onNavigate,
  startInPerformanceMode,
  openMode,
}) => {
  const { t } = useTranslation();
  const api = useApi();
  const { songs, populatedScales: scales } = useMusic();
  const { openScaleDetail, saveChord, isSubmitting, openFeedback, openChordKeyRepair } = useModals();
  const { feedbackToast } = useToast();
  const { userProfile } = useAuth();
  const { hasCapability } = useCapability();
  
  const canManageSongs = hasCapability('musicscale.songs.edit');
  const canManageScales = hasCapability('musicscale.scales.manage');

  const [song, setSong] = useState<PopulatedSong | null>(null);
  
  // Performance mode state tracking
  const [performanceStartTime, setPerformanceStartTime] = useState<number | null>(null);

  const [isChordsViewerOpen, setIsChordsViewerOpen] = useState(false);
  const [isWebViewerOpen, setIsWebViewerOpen] = useState(false);
  const [isLyricsViewerOpen, setIsLyricsViewerOpen] = useState(false);

  // Sharing
  const shareRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSharePopoverOpen, setSharePopoverOpen] = useState(false);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const sharePopoverRef = useRef<HTMLDivElement>(null);
  const [sharingImageSrc, setSharingImageSrc] = useState<string | null>(null);
  const [isIosShareModalOpen, setIsIosShareModalOpen] = useState(false);

  useEffect(() => {
    if (initialSong) {
      // If we are in the context of a scale, we MUST use the initialSong because
      // it already has the transposed chords and local settings applied.
      // Otherwise, we can refresh from the global songs array.
      const resolvedSong = scaleContext ? initialSong : (songs.find((s) => s.id === initialSong.id) || initialSong);
      setSong(resolvedSong);

      const effectiveMode = openMode || (startInPerformanceMode ? "performance" : "detail");

      if (effectiveMode === "performance") {
        if (!performanceStartTime) setPerformanceStartTime(Date.now());
        
        if (resolvedSong.chords) {
          setIsChordsViewerOpen(true);
        } else if (resolvedSong.chordsUrl) {
          setIsWebViewerOpen(true);
        } else {
          setIsLyricsViewerOpen(true);
        }
      } else if (effectiveMode === "chords") {
        if (resolvedSong.chords) {
          setIsChordsViewerOpen(true);
        } else if (resolvedSong.chordsUrl) {
          setIsWebViewerOpen(true);
        }
      } else if (effectiveMode === "lyrics") {
        setIsLyricsViewerOpen(true);
      }
    } else {
      setSong(null);
      setIsChordsViewerOpen(false);
      setIsWebViewerOpen(false);
      setIsLyricsViewerOpen(false);
    }
  }, [initialSong, songs, startInPerformanceMode, openMode, scaleContext]);

  const handleClosePerformance = () => {
    setIsChordsViewerOpen(false);
    setIsWebViewerOpen(false);
    setIsLyricsViewerOpen(false);
    
    // Clear recovery state since they explicitly exited
    clearPerformanceState().catch(e => console.error("Could not clear performance state", e));
    
    const isDirectOpen = startInPerformanceMode || (openMode && openMode !== "detail");
    
    // Feedback Logic: If they spent more than 8 seconds in performance mode, ask for feedback
    const isPerformanceRun = startInPerformanceMode || openMode === "performance";
    if (isPerformanceRun && performanceStartTime && Date.now() - performanceStartTime > 8000) {
       setTimeout(() => {
         feedbackToast(
           "Como foi usar o MusicScale no palco?",
           () => { submitFeedback(userProfile?.uid, userProfile?.organizationId, { type: 'rating', rating: 'positive', context: 'performance_mode' }); },
           () => { 
             submitFeedback(userProfile?.uid, userProfile?.organizationId, { type: 'rating', rating: 'negative', context: 'performance_mode' });
             openFeedback('feedback'); 
           },
           "Incrível ✨",
           "Precisa melhorar"
         );
       }, 500);
    }
    
    // Notify parent to close if it was started right into performance mode or specific mode
    if (isDirectOpen) {
      setPerformanceStartTime(null);
      onClose();
    }
  };

  const upcomingScalesForSong = useMemo(() => {
    if (!song) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return scales
      .filter(
        (s) =>
          new Date(s.date + "T00:00:00") >= today &&
          s.songs.some((scaleSong) => scaleSong.id === song.id),
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [song, scales]);

  const handleCopyLink = () => {
    if (!song) return;
    const baseUrl = window.location.href
      .split("#")[0]
      .replace(/index\.html$/, "");
    const link = `${baseUrl}#/?openSongId=${song.id}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        alert("Link copiado para a área de transferência!");
      })
      .catch((err) => {
        logger.error("Failed to copy link: ", err);
        alert("Falha ao copiar o link.");
      });
  };

  const handleShare = async () => {
    if (!shareRef.current || !song) return;
    setIsSharing(true);

    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const link = `${window.location.origin}/#/songs/${song.id}`;
    const text = `Confira a música "${song.title}" - ${song.artist}.\n\nAcesso direto: ${link}`;

    if (isIos) {
      try {
        const dataUrl = await toPng(shareRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#111827", skipAutoScale: true });
        setSharingImageSrc(dataUrl);
        setIsIosShareModalOpen(true);
        navigator.clipboard.writeText(text).catch(() => {});
      } catch (e) {
        logger.error("Error generating iOS share image: ", e);
        navigator.clipboard.writeText(text).catch(() => {});
        alert("Link copiado! Pressione e cole onde quiser.");
      } finally {
        setIsSharing(false);
      }
      return;
    }

    const getFilename = () => {
      return `${song.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.png`;
    };

    const downloadImageFallback = (blobOrUrl) => {
      const url = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
      const linkElement = document.createElement("a");
      linkElement.download = getFilename();
      linkElement.href = url;
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      if (typeof blobOrUrl !== "string") setTimeout(() => URL.revokeObjectURL(url), 5000);
    };

    try {
      const blob = await toBlob(shareRef.current, {
        cacheBust: true, pixelRatio: 2, backgroundColor: "#111827", skipAutoScale: true,
        filter: (n) => !["SCRIPT", "OBJECT", "IFRAME", "LINK", "STYLE", "VIDEO", "AUDIO"].includes(n.tagName?.toUpperCase())
      });
      if (!blob) throw new Error("Falha ao gerar blob");

      const file = new File([blob], getFilename(), { type: "image/png" });
      const title = `Música: ${song.title}`;
      const shareDataWithFile = { title, text, files: [file] };

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share(shareDataWithFile);
      } else {
        downloadImageFallback(blob);
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        logger.info("Compartilhamento cancelado pelo usuario");
        return;
      }
      try {
        const dataUrl = await toPng(shareRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: "#111827", skipAutoScale: true });
        setSharingImageSrc(dataUrl);
        setIsIosShareModalOpen(true);
        navigator.clipboard.writeText(text).catch(() => {});
      } catch (e) {
        alert("Link copiado para a área de transferência!");
        navigator.clipboard.writeText(text).catch(() => {});
      }
    } finally { setIsSharing(false); }
  };

  if (!song) return null;

  const lastPlayedDate = song.lastPlayed
    ? new Date(song.lastPlayed).toLocaleDateString("pt-BR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Nunca foi tocada";

  const createdDate = new Date(song.createdAt).toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const fourMonthsAgo = new Date();
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
  const isConsideredNew =
    !!song.isNew && song.createdAt && new Date(song.createdAt) > fourMonthsAgo;

  const songStatus = song.status as string;
  const statusConfig = (statusMap as any)[songStatus] || {
    text: songStatus || "Desconhecido",
    className:
      "bg-slate-200 dark:bg-gray-600/50 text-slate-600 dark:text-gray-400",
  };

  const renderContent = () => (
    <div className={`fixed inset-0 z-[100] flex flex-col md:items-center justify-end md:justify-center ${song ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} transition-opacity duration-300 isolate`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[#0b0c10] md:rounded-[2rem] rounded-t-[2rem] shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/[0.08] flex flex-col max-h-[94dvh] md:max-h-[85dvh] animate-slide-up-sheet md:animate-scale-in overflow-hidden touch-auto">
        
        {/* Header Compacto */}
        <div className="flex-shrink-0 px-5 pt-3 md:pt-5 pb-4 border-b border-white/[0.08] relative z-20 bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto mb-4 md:hidden cursor-pointer" onClick={onClose} />
          
          <div className="flex items-start justify-between mt-1">
             <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-[22px] md:text-[26px] font-bold text-white tracking-tight truncate leading-tight">
                  {song.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-[14px] font-medium text-white/70">{song.artist}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${songStatus === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-white/50 border border-white/10'}`}>
                    {statusConfig.text}
                  </span>
                  {isConsideredNew && (
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Nova
                    </span>
                  )}
                </div>
             </div>
             <button onClick={onClose} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/70 transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 1l12 12M13 1L1 13"/></svg>
             </button>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
             {song.tags.map(tag => (
                <span key={tag.id} className="text-[11px] font-semibold bg-white/5 text-white/60 border border-white/10 px-2 py-0.5 rounded-md">
                   {tag.name}
                </span>
             ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pb-[90px] md:pb-[100px]">
           <div className="p-5 md:p-8 space-y-8">
              
              {/* Resumo Musical / Metadados */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                 <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col justify-center items-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {canManageSongs && (
                       <button
                         onClick={() => song && openChordKeyRepair(song, (updatedSong) => setSong(updatedSong))}
                         className="absolute top-2 right-2 p-1.5 text-white/30 hover:text-white/80 hover:bg-white/10 rounded-lg transition-all focus:outline-none focus:ring-1 focus:ring-indigo-500/30 z-10"
                         title={t('chordKeyRepair.title', 'Ajustar tom da cifra')}
                       >
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A1.79 1.79 0 0020 18.25l-5.83-5.83M11.42 15.17l2.43-2.43M11.42 15.17L3 12h8l3-3 3 3h-2l-3.58 3.58M12 3v9h9" />
                         </svg>
                       </button>
                    )}
                    <KeyIcon className="w-4 h-4 text-indigo-400 mb-2" />
                    <span className="text-2xl font-black text-white leading-none mb-1">{song.key || '-'}</span>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">Tom</span>
                 </div>
                 
                 <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col justify-center items-center relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <BpmIcon className="w-4 h-4 text-pink-400 mb-2" />
                    <span className="text-2xl font-black text-white leading-none mb-1">{song.bpm || '-'}</span>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest text-center">BPM</span>
                 </div>

                 <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col justify-center items-center text-center">
                    <span className="text-[13px] font-semibold text-white/80 mb-1">{createdDate}</span>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{t("songs.added", "Adicionada")}</span>
                 </div>

                 <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex flex-col justify-center items-center text-center">
                    <span className="text-[13px] font-semibold text-white/80 mb-1">{lastPlayedDate}</span>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Última Vez</span>
                 </div>
              </div>

              {/* Ações Principais (Performance / Cifra / Letra) */}
              <div className="flex flex-col gap-3">
                 <button onClick={() => song.chords ? setIsChordsViewerOpen(true) : setIsWebViewerOpen(true)} className="w-full h-14 rounded-[16px] bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(79,70,229,0.3)] transition-all active:scale-[0.98]">
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    Abrir Performance
                 </button>

                 <div className="grid grid-cols-2 gap-3">
                    {(song.chords || song.chordsUrl) && (
                       <button onClick={() => song.chords ? setIsChordsViewerOpen(true) : setIsWebViewerOpen(true)} className="h-12 rounded-[14px] bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                          <ChordsIcon className="w-4 h-4 text-indigo-400" /> Cifra
                       </button>
                    )}
                    {song.lyrics && (
                       <button onClick={() => setIsLyricsViewerOpen(true)} className="h-12 rounded-[14px] bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white font-semibold text-[14px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                          <LyricsIcon className="w-4 h-4 text-emerald-400" /> Letra
                       </button>
                    )}
                 </div>
                 
                 {song.chordsUrl && (
                    <a href={song.chordsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors mt-1 font-medium pb-2">
                       Acessar Cifra Original Externa <ExternalLinkIcon className="w-3.5 h-3.5" />
                    </a>
                 )}
              </div>

              {/* Metrônomo Compacto */}
              {song.bpm ? (
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-3xl p-5 relative overflow-hidden">
                   <h4 className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-white/40 mb-4">
                      <span>Metrônomo</span>
                      <span>{song.bpm} BPM</span>
                   </h4>
                   <div className="relative z-10 w-full mb-3">
                      {/* Reuse existing Metronome component but styled by existing internal classes or wrap it */}
                      {/* Wait, the existing Metronome component is independent and self-contained. Let's just use it natively like before */}
                   </div>
                   
                   {/* Actually, let's just mount the standard Metronome inside, it should adapt if it's responsive. */}
                   {/* However, the design requested a compact one. If we can't change Metronome internally without editing it, we will just mount it. */}
                   <div className="w-full transform sm:scale-100 scale-95 origin-top">
                      <Metronome initialBpm={song.bpm} />
                   </div>
                </div>
              ) : null}

              {/* Referência de Ensaio (Vídeo) */}
              {song.videoUrl && (
                 <div className="mt-2">
                    <RehearsalReferenceCard videoUrl={song.videoUrl} />
                 </div>
              )}

              {/* Notas da Banda */}
              <div className="space-y-3">
                 <h4 className="flex items-center text-[13px] font-bold uppercase tracking-wider text-white/40">
                    📝 Notas da Banda / Collab
                 </h4>
                 <textarea 
                    className="input-base !h-auto min-h-[100px] !rounded-[20px] resize-y" 
                    placeholder="Adicione observações da banda, notas semanais, divisão de vozes..."
                    defaultValue={song.bandNotes || ''}
                    disabled={!canManageSongs}
                    onBlur={async (e) => {
                      if (e.target.value !== song.bandNotes) {
                          setSong({ ...song, bandNotes: e.target.value });
                          if (api && song.id) {
                              try {
                                  await api.songs.update(song.id, { bandNotes: e.target.value });
                              } catch (err) {
                                  logger.error("Failed to save bandnotes", err);
                              }
                          }
                      }
                    }}
                 />
              </div>

              {/* Próximas Escalas */}
              {upcomingScalesForSong.length > 0 && (
                 <div className="space-y-3">
                    <h4 className="flex items-center text-[13px] font-bold uppercase tracking-wider text-white/40">
                       Próximas Escalas ({upcomingScalesForSong.length})
                    </h4>
                    <div className="space-y-2">
                      {upcomingScalesForSong.map((scale) => (
                        <div
                          key={scale.id}
                          className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] hover:border-white/[0.1] rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                          onClick={() => {
                            onClose();
                            openScaleDetail(scale);
                          }}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[14px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-white/60 group-hover:text-white group-hover:bg-white/10 transition-colors">
                              <CalendarIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-[15px] text-white group-hover:text-indigo-300 transition-colors">
                                {getScaleTitle(scale)}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                 <p className="text-[13px] text-white/50">
                                   {new Date(scale.date + "T00:00:00").toLocaleDateString("pt-BR", {
                                     day: "2-digit", month: "short", year: "numeric"
                                   })}
                                 </p>
                                 <span className="text-white/20">•</span>
                                 <span className="text-[12px] text-white/40 capitalize">{scale.location.name}</span>
                              </div>
                            </div>
                          </div>
                          <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-white/5 group-hover:bg-white/10 text-white/30 group-hover:text-white transition-colors">
                            <ChevronRightIcon className="w-4 h-4 ml-0.5" />
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
              )}

           </div>
        </div>

        {/* Footer Actions Compacto */}
        <div className="absolute bottom-0 inset-x-0 bg-[#07080a]/90 backdrop-blur-2xl border-t border-white/[0.08] p-4 px-5 flex items-center justify-between z-20 pb-[max(1rem,env(safe-area-inset-bottom))] md:rounded-b-[2rem]">
           <div className="flex-1 flex gap-2 w-full">
              {canManageScales && (
                <button onClick={() => { onClose(); onCreateScale(song); }} className="flex-1 h-11 bg-white hover:bg-white/90 text-black font-extrabold text-[14px] rounded-[14px] flex items-center justify-center gap-2 transition-colors active:scale-[0.98]">
                   <PlusIcon className="w-4 h-4" /> Criar Escala
                </button>
              )}
              
              <button ref={shareButtonRef} onClick={() => setSharePopoverOpen((o) => !o)} disabled={isSharing} className="w-11 h-11 flex-shrink-0 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white flex items-center justify-center rounded-[14px] transition-colors" title="Compartilhar">
                 <ShareIcon className="w-4 h-4" />
              </button>

              {canManageSongs && (
                <button onClick={() => { onClose(); onEdit(song); }} className="w-11 h-11 flex-shrink-0 bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.1] text-white flex items-center justify-center rounded-[14px] transition-colors" title="Editar">
                   <EditIcon className="w-4 h-4" />
                </button>
              )}
              
              {canManageSongs && (
                <button onClick={() => { if(window.confirm('Deseja realmente excluir esta música?')) { onClose(); onDelete(song); } }} className="w-11 h-11 flex-shrink-0 bg-red-500/10 text-red-500 hover:bg-red-500/20 flex items-center justify-center rounded-[14px] transition-colors" title="Excluir">
                   <TrashIcon className="w-4 h-4" />
                </button>
              )}
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(renderContent(), document.body)}


      <ChordsViewerModal
        isOpen={isChordsViewerOpen}
        onClose={handleClosePerformance}
        song={song}
        onSave={saveChord}
        isSubmitting={isSubmitting}
        scaleContext={scaleContext}
        onNavigate={onNavigate}
      />

      <LyricsViewerModal
        isOpen={isLyricsViewerOpen}
        onClose={handleClosePerformance}
        song={song}
        scaleContext={scaleContext}
        onNavigate={onNavigate}
      />

      {song.chordsUrl && !song.chords && (
        <WebViewerModal
          isOpen={isWebViewerOpen}
          onClose={handleClosePerformance}
          url={song.chordsUrl}
          title={`Cifra: ${song.title}`}
        />
      )}

      <Popover
        triggerRef={shareButtonRef}
        isOpen={isSharePopoverOpen}
        onClose={() => setSharePopoverOpen(false)}
        popoverRef={sharePopoverRef}
        className="w-56 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg z-[110] py-1"
      >
        <button
          onClick={() => {
            handleShare();
            setSharePopoverOpen(false);
          }}
          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-3"
        >
          <ImageIcon className="w-4 h-4" />
          Compartilhar Imagem
        </button>
        <button
          onClick={() => {
            handleCopyLink();
            setSharePopoverOpen(false);
          }}
          className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-3"
        >
          <LinkIcon className="w-4 h-4" />
          Copiar Link
        </button>
      </Popover>

      <div className="fixed -left-[9999px] -top-[9999px]">
        {song && <SongShareImage ref={shareRef} song={song} />}
      </div>

      <Modal
        isOpen={isIosShareModalOpen}
        onClose={() => setIsIosShareModalOpen(false)}
        title="Compartilhar Música"
      >
        <div className="flex flex-col items-center text-center p-4">
          <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
            Toque e segure na imagem abaixo para <strong>Salvar na Galeria</strong> ou <strong>Compartilhar</strong>.
          </p>
          {sharingImageSrc ? (
            <img
              src={sharingImageSrc}
              alt="Música"
              className="rounded-lg border border-slate-200 dark:border-gray-700 max-h-[50vh] object-contain shadow-md mb-6"
            />
          ) : (
            <div className="flex justify-center items-center h-48 w-full border border-dashed border-slate-300 dark:border-gray-700 rounded-lg">
              <Spinner size="lg" />
            </div>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              const link = `${window.location.origin}/#/songs/${song.id}`;
              const text = `Confira a música "${song.title}" - ${song.artist}.\n\nAcesso direto: ${link}`;
              navigator.clipboard.writeText(text);
              alert("Texto e link copiados com sucesso!");
            }}
            className="w-full flex items-center justify-center gap-2"
          >
            Copiar Texto e Link
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default SongDetailModal;
