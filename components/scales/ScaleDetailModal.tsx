import { logger } from "../../lib/logger";

import React, { useState, useRef, useMemo, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import type {
  PopulatedScale,
  PopulatedBandScale,
  Scale,
  BandScale,
  PopulatedSong,
} from "../../types";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { useAuth } from "../../contexts/AuthContext";
import { useMusic } from "../../contexts/MusicDataContext";
import { useApi } from "../../contexts/ApiContext";
import { aiDirectorService, SetlistIntelligence } from "../../services/aiDirector";
import { AiSetlistInsights } from "./AiSetlistInsights";
import { AiContextualSuggestions } from "./AiContextualSuggestions";
import { useMusicScaleFeature } from "../../hooks/useMusicScaleEntitlements";
import { FeatureLockedCard } from "../premium/EntitlementGates";
import { LockedActionButton } from "../billing/LockedActionButton";
import { entitlementsService } from "../../services/entitlementsService";
import { CalendarIcon } from "../icons/CalendarIcon";
import { CloneIcon } from "../icons/CloneIcon";
import { LocationMarkerIcon } from "../icons/LocationMarkerIcon";
import { MusicNoteIcon } from "../icons/MusicNoteIcon";
import { UsersIcon } from "../icons/UsersIcon";
import { applyScaleSongSettings } from "../../utils/scaleSongSettings";
import { UserIcon } from "../icons/UserIcon";
import { ShareIcon } from "../icons/ShareIcon";
import ScaleShareImage from "./ScaleShareImage";
import { toPng, toBlob } from "html-to-image";
import { ClipboardListIcon } from "../icons/ClipboardListIcon";
import { BpmIcon } from "../icons/BpmIcon";
import { HistoryIcon } from "../icons/HistoryIcon";
import { LinkIcon } from "../icons/LinkIcon";
import Spinner from "../common/Spinner";
import AddToCalendarButton from "../common/AddToCalendarButton";
import { resolveScaleDurationMinutes } from "../../utils/calendar";
import { getScaleTitle } from "../../utils/scaleHelper";
import AssignmentResponseActions from "./AssignmentResponseActions";
import TeamStatusSummary from "./TeamStatusSummary";

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
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z"
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

  React.useEffect(() => {
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

interface ScaleDetailModalProps {
  scale: PopulatedScale | PopulatedBandScale | null;
  scaleType: "music" | "band";
  onClose: () => void;
  onEdit: (scale: Scale | BandScale) => void;
  onClone?: (scale: PopulatedScale | PopulatedBandScale) => void;
  onDelete: (scale: PopulatedScale | PopulatedBandScale) => void;
  // FIX: Add props to break circular dependency with ModalContext
  openSongDetail: (
    song: PopulatedSong,
    keepCurrentOpen?: boolean,
    scaleContext?: { scaleId?: string, songs: PopulatedSong[]; currentIndex: number } | null,
    startInPerformanceMode?: boolean,
  ) => void;
  openBandScaleForm: (
    scale?: BandScale,
    options?: { linkToMusicScaleId: string; prefillData?: Partial<BandScale> },
  ) => void;
}

const getKeyColor = (key: string) => {
  const colors = [
    "bg-red-500/20 text-red-600 dark:text-red-400",
    "bg-orange-500/20 text-orange-600 dark:text-orange-400",
    "bg-amber-500/20 text-amber-600 dark:text-amber-400",
    "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
    "bg-lime-500/20 text-lime-600 dark:text-lime-400",
    "bg-green-500/20 text-green-600 dark:text-green-400",
    "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    "bg-teal-500/20 text-teal-600 dark:text-teal-400",
    "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
    "bg-sky-500/20 text-sky-600 dark:text-sky-400",
    "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400",
    "bg-violet-500/20 text-violet-600 dark:text-violet-400",
    "bg-purple-500/20 text-purple-600 dark:text-purple-400",
    "bg-fuchsia-500/20 text-fuchsia-600 dark:text-fuchsia-400",
    "bg-pink-500/20 text-pink-600 dark:text-pink-400",
    "bg-rose-500/20 text-rose-600 dark:text-rose-400",
  ];
  let hash = 0;
  if (!key || key.length === 0) return colors[0];
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % colors.length);
  return colors[index];
};

const SectionTitle: React.FC<{
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, children }) => (
  <h3 className="text-[17px] font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3 tracking-tight">
    <span className="p-2 rounded-[14px] bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 shadow-sm-soft border border-slate-200/50 dark:border-white/5">
      {icon}
    </span>
    <span>{children}</span>
  </h3>
);

const HistorySection: React.FC<{
  scale: PopulatedScale | PopulatedBandScale;
}> = ({ scale }) => {
  const { t, i18n } = useTranslation();
  
  const formatDate = (dateVal: any) => {
    if (!dateVal) return "";
    const locale = i18n.language || "pt-BR";
    try {
      if (typeof dateVal === "string") return new Date(dateVal).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
      if (dateVal.toDate) return dateVal.toDate().toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
      if (dateVal instanceof Date) return dateVal.toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
      if (typeof dateVal === "object" && dateVal.seconds) return new Date(dateVal.seconds * 1000).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
      return new Date(dateVal).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });
    } catch (e) {
      return "";
    }
  };

  return (
  <div className="mt-4">
    <div className="flex items-center gap-2.5 mb-5">
      <div className="p-1.5 rounded-lg bg-slate-500/10 border border-slate-500/20">
        <HistoryIcon className="w-4 h-4 text-slate-400" />
      </div>
      <h3 className="text-[18px] font-bold text-white tracking-tight flex items-center gap-2">
         {t("scales.history", "Histórico")}
      </h3>
    </div>
    <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-[24px] shadow-sm text-[13px] text-white/50 space-y-3">
      <div className="flex justify-between items-center gap-4">
        <span>
          {t("scales.created_by", "Criado por")}{" "}
          <strong className="text-white/80">
            {scale.createdBy?.displayName || t("scales.unknown", "Desconhecido")}
          </strong>
        </span>
        <span className="text-white/40 font-medium">
          {formatDate(scale.createdAt)}
        </span>
      </div>
      {scale.lastModifiedAt && scale.lastModifiedBy && (
        <div className="pt-3 border-t border-white/[0.04] flex justify-between items-center gap-4">
          <span>
            {t("scales.edited_by", "Editado por")}{" "}
            <strong className="text-white/80">
              {scale.lastModifiedBy.displayName || t("scales.unknown", "Desconhecido")}
            </strong>
          </span>
          <span className="text-white/40 font-medium">
            {formatDate(scale.lastModifiedAt)}
          </span>
        </div>
      )}
    </div>
  </div>
)};

export const isBandScale = (scale: any): scale is PopulatedBandScale => {
  return 'assignments' in scale;
};

export const isMusicScale = (scale: any): scale is PopulatedScale => {
  return 'songIds' in scale || 'bandScaleId' in scale;
};

export const getResolvedDate = (scale: PopulatedBandScale | PopulatedScale, musicScales?: PopulatedScale[]) => {
  if (isBandScale(scale) && scale.musicScaleId && musicScales) {
    const ms = musicScales.find(s => s.id === scale.musicScaleId);
    if (ms && ms.date) return ms.date;
  }
  return scale.date || "1970-01-01";
};

export const getResolvedLocation = (scale: PopulatedBandScale | PopulatedScale, musicScales?: PopulatedScale[]) => {
  if (isBandScale(scale) && scale.musicScaleId && musicScales) {
    const ms = musicScales.find(s => s.id === scale.musicScaleId);
    if (ms && ms.location) return ms.location;
  }
  return scale.location || { id: "unknown", name: "Sem local" };
};

const ScaleDetailModal: React.FC<ScaleDetailModalProps> = ({
  scale,
  scaleType,
  onClose,
  onEdit,
  onClone,
  onDelete,
  openSongDetail,
  openBandScaleForm,
}) => {
  const { user, permissions } = useAuth();
  const { t } = useTranslation();
  const { populatedBandScales, populatedScales, refreshData, songs: librarySongs } = useMusic();
  const api = useApi();

  const shareRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLinkableScaleId, setSelectedLinkableScaleId] = useState("");
  const [sharingImageSrc, setSharingImageSrc] = useState<string | null>(null);
  const [sharingFile, setSharingFile] = useState<File | null>(null);
  const [isIosShareModalOpen, setIsIosShareModalOpen] = useState(false);

  const [localSongs, setLocalSongs] = useState<PopulatedSong[]>([]);
  const [aiInsights, setAiInsights] = useState<SetlistIntelligence | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const isAiSetlistInsightsAllowed = useMusicScaleFeature('aiSetlistInsights');
  const isScaleCloningAllowed = useMusicScaleFeature('scaleCloning');
  
  useEffect(() => {
    if (scale && isMusicScale(scale)) {
      const songsWithSettings = scale.songs.map(song => 
        applyScaleSongSettings(song, scale.songSettings?.[song.id])
      );
      setLocalSongs(songsWithSettings);
    }
  }, [scale]);

  const handleAnalyzeSetlist = async () => {
    if (!scale || !isMusicScale(scale)) return;
    setIsAnalyzing(true);
    setShowInsights(true);
    if (!isAiSetlistInsightsAllowed) {
      setIsAnalyzing(false);
      return;
    }
    try {
      const result = await aiDirectorService.analyzeSetlist(localSongs);
      setAiInsights(result);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReorderSongs = async (newOrder: PopulatedSong[]) => {
    setLocalSongs(newOrder);
    if (!scale || !isMusicScale(scale) || !api) return;
    try {
      await api.scales.update(scale.id, {
        songIds: newOrder.map((s) => s.id),
      });
      refreshData();
    } catch (e) {
      logger.error("Failed to reorder songs", e);
      setLocalSongs(scale.songs); // revert on error
    }
  };

  const [isSharePopoverOpen, setSharePopoverOpen] = useState(false);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const sharePopoverRef = useRef<HTMLDivElement>(null);

  const resolvedDateStr = scale ? getResolvedDate(scale, populatedScales) : "1970-01-01";
  const resolvedLocation = scale ? getResolvedLocation(scale, populatedScales) : { id: "unknown", name: "Sem local" };
  const isNoDate = resolvedDateStr === "1970-01-01";
  const scaleTitle = getScaleTitle(scale);
  
  const date = new Date(resolvedDateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = !isNoDate && date < today;

  const formattedDate = isNoDate ? "Sem data" : date.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const linkableBandScales = useMemo(() => {
    if (!scale || !isMusicScale(scale) || !populatedBandScales) return [];

    return populatedBandScales.filter(
      (bs) =>
        bs.date === resolvedDateStr &&
        // FIX: Corrected property access on PopulatedBandScale object. Used `eventType.id` instead of `eventTypeId`.
        bs.eventType.id === scale.eventType.id &&
        // FIX: Corrected property access on PopulatedBandScale object. Used `location.id` instead of `locationId`.
        bs.location.id === resolvedLocation.id &&
        // FIX: Corrected property access on PopulatedBandScale object. Used `eventName?.id` instead of `eventNameId`.
        (bs.eventName?.id || null) === (scale.eventName?.id || null) &&
        !bs.musicScaleId,
    );
  }, [scale, populatedBandScales, resolvedDateStr, resolvedLocation]);

  if (!scale) return null;

  const handleCopyLink = () => {
    if (!scale) return;
    const baseUrl = window.location.href
      .split("#")[0]
      .replace(/index\.html$/, "");
    const link = `${baseUrl}#/${scaleType === "music" ? "scales" : "band-scales"}/${scale.id}`;
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

  const getFilename = () => {
    return `escala-${resolvedDateStr}.png`;
  };

  const downloadImageFallback = (blobOrUrl: string | Blob) => {
    const url = typeof blobOrUrl === "string" ? blobOrUrl : URL.createObjectURL(blobOrUrl);
    const linkElement = document.createElement("a");
    linkElement.download = getFilename();
    linkElement.href = url;
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
    if (typeof blobOrUrl !== "string") setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const generateShareData = async () => {
    if (!shareRef.current || !scale) return null;
    try {
      const dataUrl = await toPng(shareRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0b0f19",
        skipAutoScale: true,
        filter: (n) => !["SCRIPT", "OBJECT", "IFRAME", "LINK", "STYLE", "VIDEO", "AUDIO"].includes(n.tagName?.toUpperCase())
      });
      
      const blob = await toBlob(shareRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#0b0f19",
        skipAutoScale: true,
        filter: (n) => !["SCRIPT", "OBJECT", "IFRAME", "LINK", "STYLE", "VIDEO", "AUDIO"].includes(n.tagName?.toUpperCase())
      });
      
      if (!blob) throw new Error("Falha ao gerar blob");
      const file = new File([blob], getFilename(), { type: "image/png" });

      return { file, dataUrl };
    } catch (e) {
      logger.error("Error generating share data", e);
      return null;
    }
  };

  const handleWhatsAppShare = async () => {
    if (!scale) return;
    setIsIosShareModalOpen(true);
    setSharingImageSrc(null);
    setSharingFile(null);
    setIsSharing(true);

    const result = await generateShareData();
    setIsSharing(false);
    if (result) {
      setSharingFile(result.file);
      setSharingImageSrc(result.dataUrl);
    } else {
      setIsIosShareModalOpen(false);
      alert("Não foi possível gerar a imagem da escala.");
    }
  };

  const handleShare = async () => {
    if (!scale) return;
    setIsIosShareModalOpen(true);
    setSharingImageSrc(null);
    setSharingFile(null);
    setIsSharing(true);

    const result = await generateShareData();
    setIsSharing(false);
    if (result) {
      setSharingFile(result.file);
      setSharingImageSrc(result.dataUrl);
    } else {
      setIsIosShareModalOpen(false);
      alert("Não foi possível gerar a imagem da escala.");
    }
  };

  const canManage = !!permissions?.manageScales || (user && scale.createdBy && user.uid === scale.createdBy.uid);

  const handleLinkBandScale = async () => {
    if (!scale || !selectedLinkableScaleId || isSubmitting || !api) return;
    setIsSubmitting(true);
    try {
      await api.linkScales(scale.id, selectedLinkableScaleId);
      await refreshData();
      onClose();
    } catch (e) {
      logger.error("Failed to link scales", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkBandScale = async () => {
    if (
      !scale ||
      !isMusicScale(scale) ||
      !scale.bandScaleId ||
      isSubmitting ||
      !api
    )
      return;
    setIsSubmitting(true);
    try {
      await api.unlinkScales(scale.id, scale.bandScaleId);
      await refreshData();
      onClose();
    } catch (e) {
      logger.error("Failed to unlink scales", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAndLinkBandScale = () => {
    if (!scale || !isMusicScale(scale)) return;
    const prefillData = {
      date: scale.date,
      eventTypeId: scale.eventType.id,
      locationId: scale.location.id,
      eventNameId: scale.eventName?.id || null,
    };
    onClose();
    openBandScaleForm(undefined, { linkToMusicScaleId: scale.id, prefillData });
  };

  const modalTitle = (
    <div className="text-center w-full pb-2">
      <h2
        className="text-2xl md:text-[32px] font-black text-slate-900 dark:text-white tracking-tight"
        style={{ textWrap: "balance" }}
      >
        {scaleTitle}
      </h2>
      <p className="text-[15px] font-medium text-slate-500 dark:text-slate-400 mt-2">
        {formattedDate}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <div className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-2xl bg-surface/50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5 backdrop-blur-md shadow-sm-soft">
          <LocationMarkerIcon className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">{scale.location.name}</span>
        </div>
        {scale.createdBy?.displayName && (
            <div className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-2xl bg-surface/50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-white/5 backdrop-blur-md shadow-sm-soft">
                <UserIcon className="w-4 h-4 text-primary" />
                <span className="font-medium text-xs">por <span className="font-semibold">{scale.createdBy.displayName}</span></span>
            </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {createPortal(
        <div className={`fixed inset-0 z-[100] flex flex-col md:items-center justify-end md:justify-center ${scale ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} transition-opacity duration-300 isolate`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-[#0A0A0C] md:rounded-[32px] rounded-t-[32px] shadow-2xl border border-white/[0.06] flex flex-col max-h-[94dvh] md:max-h-[85dvh] animate-slide-up-sheet md:animate-scale-in overflow-hidden touch-auto">
        
        {/* Header Compacto Premium */}
        <div className="flex-shrink-0 px-6 pt-4 md:pt-8 pb-6 border-b border-white/[0.04] relative z-20 bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-2xl">
          <div className="w-12 h-1.5 rounded-full bg-white/10 mx-auto mb-6 md:hidden cursor-pointer" onClick={onClose} />
          
          <div className="flex items-start justify-between">
             <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center flex-wrap gap-2 mb-3">
                   <div className="px-3 py-1 rounded-full bg-[#121318]/50 border border-white/[0.06] text-white/70 text-[11px] font-bold tracking-widest uppercase flex items-center gap-1.5 backdrop-blur-md shadow-sm">
                      <CalendarIcon className="w-3.5 h-3.5 text-indigo-400" />
                      {scale.eventType.name}
                   </div>
                   {isPast && (
                     <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[11px] font-bold tracking-widest uppercase shadow-sm">
                        ARQUIVADA
                     </div>
                   )}
                </div>
                <h2 className="text-[32px] md:text-[40px] font-extrabold text-white tracking-tight truncate leading-none mb-4 drop-shadow-sm pb-1">
                  {scaleTitle}
                </h2>
                <div className="flex flex-wrap items-center gap-3 md:gap-4 md:text-[15px] font-medium text-white/60">
                  <span className="flex items-center gap-1.5">
                     <CalendarIcon className="w-4 h-4 opacity-60"/>
                     {date.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" , month: "short", year: "numeric" }).replace('.', '')}{scale.time ? `, ${scale.time}` : ''}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-white/20"></span>
                  <span className="flex items-center gap-1.5 text-indigo-300/90 drop-shadow-sm">
                     <LocationMarkerIcon className="w-4 h-4 opacity-70"/> 
                     {scale.location.name}
                  </span>
                  {isMusicScale(scale) && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20"></span>
                      <span className="flex items-center gap-1.5">
                         <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                         </svg>
                         {(() => {
                           const mins = resolveScaleDurationMinutes((scale as any).durationMinutes);
                           const hrs = Math.floor(mins / 60);
                           const remainingMins = mins % 60;
                           if (hrs > 0) {
                             return `${hrs}h${remainingMins > 0 ? ` ${remainingMins}m` : ""}`;
                           }
                           return `${remainingMins}m`;
                         })()}
                      </span>
                    </>
                  )}
                  {scale.createdBy?.displayName && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-white/20"></span>
                      <span className="flex items-center gap-1.5">
                         <UserIcon className="w-4 h-4 opacity-50"/> 
                         {scale.createdBy.displayName}
                      </span>
                    </>
                  )}
                </div>
             </div>
             <button onClick={onClose} className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white/70 transition-all hover:scale-105 active:scale-95 border border-white/[0.05]">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M1 1l12 12M13 1L1 13"/></svg>
             </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pb-[100px] md:pb-[110px]">
           <div className="p-6 md:p-8 md:px-10 space-y-10">
              {/* Músicas */}
              {isMusicScale(scale) && (
                <section>
                   <div className="flex items-center justify-between mb-5">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                          <MusicNoteIcon className="w-4 h-4 text-indigo-400" />
                        </div>
                        <h3 className="text-[20px] font-bold text-white tracking-tight flex items-center gap-2">
                           Repertório
                           <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 text-white/50 font-bold text-[11px] ml-1.5 font-mono shadow-inner">
                             {scale.songs.length}
                           </span>
                        </h3>
                     </div>
                     <div className="flex items-center gap-3">
                        {scale.songs.length > 0 && (
                          <button onClick={() => openSongDetail(scale.songs[0], true, { songs: scale.songs, currentIndex: 0, scaleId: scale.id }, true)} className="h-9 md:h-10 px-5 md:px-6 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white text-[13px] md:text-[14px] font-bold transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.4)]">
                             <svg className="w-4 h-4 md:w-5 md:h-5 opacity-90" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                             Modo Performance
                          </button>
                        )}
                     </div>
                   </div>

                   <div className="space-y-4">
                     {localSongs.length > 0 ? (
                        <div className="space-y-2">
                          <div className="space-y-2">
                             {localSongs.map((song, index) => {
                                const hasLyrics = !!song.lyrics?.trim();
                                const hasChords = !!song.chords?.trim();
                                
                                let contentStatus = { label: "INCOMPLETA", color: "text-slate-500 bg-slate-100 dark:bg-white/5 dark:text-slate-400" };
                                if (hasLyrics && hasChords) contentStatus = { label: "COMPLETA", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-500/20 shadow-sm" };
                                else if (hasChords) contentStatus = { label: "SÓ CIFRA", color: "text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 border-indigo-500/20 shadow-sm" };
                                else if (hasLyrics) contentStatus = { label: "SÓ LETRA", color: "text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 border-amber-500/20 shadow-sm" };

                                return (
                                <div key={song.id} data-testid={`detail-song-card-${song.id}`} className="group relative flex items-center justify-between p-4 rounded-[20px] bg-[#121318]/50 border border-white/[0.04] hover:bg-[#1A1C23] hover:border-white/[0.08] transition-all backdrop-blur-xl shadow-sm">
                                   <div className="flex items-center gap-4 md:gap-5 overflow-hidden flex-1 cursor-pointer" onClick={(e) => { e.stopPropagation(); openSongDetail(song, true, { songs: localSongs, currentIndex: index, scaleId: scale.id }) }}>
                                     
                                     <div className="relative w-10 h-10 rounded-full bg-[#1A1D24] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.03] flex items-center justify-center shrink-0 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20 transition-all">
                                        <span className="text-[13px] font-bold text-white/40 group-hover:text-indigo-400 transition-colors font-mono">{index + 1}</span>
                                     </div>

                                     <div className="flex flex-col min-w-0 pr-3 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                           <p className="text-[16px] md:text-[17px] font-bold text-white/90 truncate group-hover:text-white transition-colors tracking-tight">{song.title}</p>
                                           <span className={`px-2 py-0.5 inline-flex text-[9px] tracking-widest uppercase font-extrabold rounded-md border ${contentStatus.color}`}>
                                              {contentStatus.label}
                                           </span>
                                        </div>
                                        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1">
                                           {song.artist && <p className="text-[13px] font-medium text-white/40 truncate max-w-[120px] md:max-w-[200px]">{song.artist}</p>}
                                           {song.artist && ((song.selectedKey || song.key) || song.bpm) && <div className="w-1 h-1 rounded-full bg-white/10" />}
                                           <div className="flex items-center gap-2">
                                             {(song.selectedKey || song.key) && (
                                               <span className="text-[11px] font-bold text-indigo-300/80 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-widest shadow-sm">
                                                 {song.selectedKey || song.key}
                                                 {scale.songSettings?.[song.id]?.key && (
                                                   <span className="ml-1 px-1 py-[1px] bg-indigo-500/30 text-indigo-200 text-[8px] rounded uppercase tracking-wider">
                                                     {t('scaleModal.scaleSpecificSetting', 'Desta escala')}
                                                   </span>
                                                 )}
                                               </span>
                                             )}
                                             {song.bpm && (
                                               <span className="text-[11px] font-bold text-emerald-300/80 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm">
                                                 <BpmIcon className="w-3 h-3 opacity-60"/> {song.bpm}
                                                 {scale.songSettings?.[song.id]?.bpm && (
                                                   <span className="ml-1 px-1 py-[1px] bg-emerald-500/30 text-emerald-200 text-[8px] rounded uppercase tracking-wider">
                                                     {t('scaleModal.scaleSpecificSetting', 'Desta escala')}
                                                   </span>
                                                 )}
                                               </span>
                                             )}
                                           </div>
                                        </div>
                                     </div>
                                   </div>
                                   <div className="flex items-center gap-2 shrink-0 pl-3 md:pl-4 opacity-70 group-hover:opacity-100 transition-opacity">
                                     <button onClick={(e) => { e.stopPropagation(); openSongDetail(song, true, { songs: localSongs, currentIndex: index, scaleId: scale.id }, true) }} data-testid={`performance-mode-button-${song.id}`} className="w-10 h-10 rounded-full bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white transition-all border border-indigo-500/20 flex items-center justify-center shadow-sm" title="Modo Performance">
                                       <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                     </button>

                                   </div>
                                </div>
                             )})}
                          </div>
                        </div>
                     ) : (
                        <div className="flex flex-col items-center justify-center py-10 bg-white/[0.02] border border-white/[0.05] rounded-3xl border-dashed">
                           <p className="text-sm text-white/40">Nenhuma música definida para esta escala.</p>
                        </div>
                     )}

                     {localSongs.length > 0 && isAiSetlistInsightsAllowed && (
                        <div className="mt-8">
                           <AiContextualSuggestions
                               currentSongs={localSongs}
                               librarySongs={librarySongs}
                               title="Sugestões Inteligentes (IA)"
                           />
                        </div>
                     )}
                   </div>
                </section>
              )}

               {/* Resposta do Usuário */}
               {isMusicScale(scale) && user && (scale as any).eventAssignments && (scale as any).eventAssignments.some((a: any) => a.userId === user.uid && a.active !== false) && (
                 <section className="mt-8 mb-4">
                   <AssignmentResponseActions
                     musicScaleId={scale.id}
                     assignments={(scale as any).eventAssignments.filter((a: any) => a.userId === user.uid && a.active !== false)}
                     eventStart={scale.date && scale.time ? new Date(`${scale.date}T${scale.time}:00`) : undefined}
                   />
                 </section>
               )}

              {/* Banda */}
              <section>
                 <div className="flex items-center gap-3 mb-5 mt-8 md:mt-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                     <UsersIcon className="w-4 h-4 text-emerald-400" />
                   </div>
                   <h3 className="text-[20px] font-bold text-white tracking-tight flex items-center gap-2">
                      {t('responses.teamStatus', 'Equipe')}
                      <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 text-white/50 font-bold text-[11px] ml-1.5 font-mono shadow-inner">
                         {(scale as any).bandScale?.assignments?.length || (scale as any).assignments?.length || 0}
                      </span>
                   </h3>
                 </div>
                 
                 {isMusicScale(scale) && (scale as any).eventAssignments && (scale as any).eventAssignments.length > 0 && (
                    <div className="mb-4">
                       <TeamStatusSummary
                          musicScaleId={scale.id}
                          assignments={(scale as any).eventAssignments}
                       />
                    </div>
                 )}

                 {isMusicScale(scale) ? (
                    scale.bandScale ? (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           {scale.bandScale.assignments.map(({ user, instrument }) => (
                              <div key={user.uid + instrument.id} className="flex items-center gap-3 p-3 rounded-[20px] bg-[#121318]/50 border border-white/[0.04] hover:bg-[#1A1C23] hover:border-white/[0.08] transition-all shadow-sm">
                                <div className="w-10 h-10 rounded-full bg-[#1A1D24] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.03] flex items-center justify-center overflow-hidden shrink-0">
                                  {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-white/40" />}
                                </div>
                                <div className="flex-1 min-w-0 pr-2 pb-0.5">
                                   <p className="font-bold text-[14px] text-white/90 truncate tracking-tight">{user.displayName}</p>
                                   <p className="text-[12px] font-medium text-emerald-400/80 truncate mt-0.5 uppercase tracking-wider">{instrument.name}</p>
                                </div>
                              </div>
                           ))}

                        </div>
                    ) : (
                       <div className="bg-white/[0.01] border border-white/[0.04] border-dashed rounded-[32px] p-8 flex flex-col items-center justify-center text-center">
                          <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/[0.05] flex items-center justify-center mb-4">
                             <UsersIcon className="w-6 h-6 text-white/30" />
                          </div>
                          <p className="text-[16px] font-bold text-white mb-2">{t("scales.no_team_linked", "Nenhuma equipe vinculada")}</p>
                          <p className="text-[14px] text-white/50 max-w-sm font-medium leading-relaxed">{t("scales.organize_ministers", "Organize os ministros e voluntários da equipe para esta escala.")}</p>
                       </div>
                    )
                 ) : (
                    isBandScale(scale) && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {scale.assignments.map(({ user, instrument }) => (
                             <div key={user.uid + instrument.id} className="flex items-center gap-3 p-3 rounded-[20px] bg-[#121318]/50 border border-white/[0.04] hover:bg-[#1A1C23] hover:border-white/[0.08] transition-all shadow-sm">
                               <div className="w-10 h-10 rounded-full bg-[#1A1D24] shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-white/[0.03] flex items-center justify-center overflow-hidden shrink-0">
                                 {user.photoURL ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-white/40" />}
                               </div>
                               <div className="flex-1 min-w-0 pr-2 pb-0.5">
                                  <p className="font-bold text-[14px] text-white/90 truncate tracking-tight">{user.displayName}</p>
                                  <p className="text-[12px] font-medium text-emerald-400/80 truncate mt-0.5 uppercase tracking-wider">{instrument.name}</p>
                               </div>
                             </div>
                          ))}
                          {scale.assignments.length === 0 && (
                            <p className="col-span-full text-center text-[13px] font-medium text-white/40 py-6">Nenhum ministro na escala.</p>
                          )}
                       </div>
                    )
                 )}
              </section>

              {/* Observações */}
              {scale.observations && (
                 <section>
                    <div className="flex items-center gap-3 mb-5 mt-8 md:mt-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                        <ClipboardListIcon className="w-4 h-4 text-amber-400" />
                      </div>
                      <h3 className="text-[20px] font-bold text-white tracking-tight">
                         Observações
                      </h3>
                    </div>
                    <div className="bg-[#121318]/50 border border-white/[0.04] rounded-[24px] p-6 shadow-sm">
                       <p className="text-[14.5px] leading-relaxed text-white/80 whitespace-pre-wrap font-medium">{scale.observations}</p>
                    </div>
                 </section>
              )}

              {/* Histórico */}
              <div className="mt-6">
                 <HistorySection scale={scale} />
              </div>
           </div>
        </div>

        {/* Footer Actions */}
        <div className="absolute bottom-0 inset-x-0 bg-[#0A0A0C]/90 backdrop-blur-3xl border-t border-white/[0.04] p-4 px-4 sm:px-6 md:px-8 flex items-center justify-between z-20 pb-[max(1.2rem,env(safe-area-inset-bottom))] md:rounded-b-[32px] shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
           <div className="flex items-center gap-2">
              {canManage && (
                 <button onClick={() => onDelete(scale)} className="w-11 h-11 flex items-center justify-center rounded-[14px] bg-white/[0.03] border border-white/[0.05] text-red-500 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all active:scale-95 shadow-sm" title="Excluir">
                    <TrashIcon />
                  </button>
              )}
           </div>
           
           <div className="flex items-center gap-1.5 sm:gap-2.5">
             {canManage && (
                <button onClick={() => onEdit(scale as any)} className="w-11 sm:w-auto px-0 sm:px-5 h-11 flex items-center justify-center gap-2 rounded-[16px] bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-white font-bold tracking-wide text-[13px] transition-all active:scale-95 shadow-sm" data-testid="edit-scale-detail-button" title="Editar">
                  <EditIcon />
                  <span className="hidden sm:inline">Editar</span>
                </button>
             )}
             {canManage && onClone && (
                <button onClick={() => {
                   if (!isScaleCloningAllowed) alert("O recurso de Clonar Escalas requer o plano Pro.");
                   else onClone(scale as any);
                }} className="w-11 h-11 flex items-center justify-center rounded-[16px] bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] text-white transition-all active:scale-95 relative shadow-sm" title="Clonar">
                  <CloneIcon className="w-4 h-4" />
                  {!isScaleCloningAllowed && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-[#0d0e12]"></span>}
                </button>
             )}
             <AddToCalendarButton
                scale={scale}
                iconOnly
                alignY="top"
                className="w-11 h-11 flex items-center justify-center rounded-[16px] bg-white/[0.05] border border-white/[0.08] hover:bg-[#1A1C23] hover:text-indigo-400 hover:border-indigo-500/20 text-white transition-all active:scale-95 shadow-sm p-0"
             />
             {scaleType === "music" && (
                <button ref={shareButtonRef} onClick={() => setSharePopoverOpen((o) => !o)} disabled={isSharing} className="h-11 px-4 sm:px-6 md:px-8 flex items-center justify-center rounded-[16px] bg-white hover:bg-white/90 text-[#0A0A0C] font-bold tracking-wide transition-all active:scale-95 gap-2 text-[13px] sm:text-[14px] shadow-xl shadow-white/10">
                   <ShareIcon />
                   <span>{isSharing ? "Gerando..." : "Compartilhar"}</span>
                </button>
             )}
           </div>
        </div>
      </div>
      
      </div>,
      document.body
      )}

      {/* Fragments for popover context below modal */}
      <Popover
        triggerRef={shareButtonRef}
        isOpen={isSharePopoverOpen}
        onClose={() => setSharePopoverOpen(false)}
        popoverRef={sharePopoverRef}
        className="w-56 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-lg z-[110] py-1"
      >
        <button
          onClick={() => {
            handleWhatsAppShare();
            setSharePopoverOpen(false);
          }}
          className="w-full text-left px-4 py-2 text-sm text-[#25D366] hover:bg-slate-100 dark:hover:bg-gray-700 flex items-center gap-3 font-semibold"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
          Enviar no WhatsApp
        </button>
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
      </Popover>

      <div className="fixed pointer-events-none opacity-0 left-0 top-0 z-[-100] w-[1080px] h-auto overflow-hidden">
        {scale && (
          <ScaleShareImage ref={shareRef} scale={scale} />
        )}
      </div>

      <Modal
        isOpen={isIosShareModalOpen}
        onClose={() => setIsIosShareModalOpen(false)}
        title="Compartilhar Escala"
      >
        <div className="flex flex-col items-center text-center p-4">
          <p className="text-sm text-slate-500 dark:text-gray-400 mb-4">
            Imagem da escala gerada! Você pode compartilhá-la diretamente ou salvá-la em seu dispositivo.
          </p>
          {sharingImageSrc ? (
            <div className="relative group mb-6 w-full flex flex-col items-center">
              <img
                src={sharingImageSrc}
                alt="Escala"
                className="rounded-lg border border-slate-200 dark:border-gray-700 max-h-[40vh] object-contain shadow-md"
              />
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-2">
                Dica no iOS: Toque e segure na imagem para salvar diretamente na Galeria
              </p>
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center h-48 w-full border border-dashed border-slate-300 dark:border-gray-700 rounded-lg mb-6">
              <Spinner size="lg" />
              <span className="text-sm text-slate-400 dark:text-gray-500 mt-2 animate-pulse">Renderizando escala...</span>
            </div>
          )}

          <div className="w-full flex flex-col gap-2.5">
            <Button
              variant="primary"
              disabled={!sharingFile}
              onClick={async () => {
                if (!sharingFile) return;
                const fDate = isNoDate ? "" : new Date(resolvedDateStr + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
                const scaleLink = window.location.origin + (isBandScale(scale) ? "/band-scales/" : "/scales/") + scale.id;
                const text = `Confira a escala para ${scaleTitle}${fDate ? ` em ${fDate}` : ''}.\n\nAcesso direto: ${scaleLink}`;
                const shareData = {
                  title: `Escala: ${scaleTitle}`,
                  text,
                  files: [sharingFile]
                };

                if (navigator.canShare && navigator.canShare({ files: [sharingFile] })) {
                  try {
                    await navigator.share(shareData);
                  } catch (err) {
                    if ((err as Error)?.name !== 'AbortError') {
                      logger.error("Native share failed", err);
                    }
                  }
                } else {
                  downloadImageFallback(sharingFile);
                  navigator.clipboard.writeText(text).catch(() => {});
                  alert("Seu navegador não suporta o compartilhamento nativo de imagens. A imagem foi baixada!");
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5"
            >
              <ShareIcon className="w-4 h-4" />
              Compartilhar Imagem (WhatsApp / Outros)
            </Button>

            <button
              onClick={() => {
                const fDate = isNoDate ? "" : new Date(resolvedDateStr + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
                const scaleLink = window.location.origin + (isBandScale(scale) ? "/band-scales/" : "/scales/") + scale.id;
                const text = `Confira a escala para ${scaleTitle}${fDate ? ` em ${fDate}` : ''}.\n\nAcesso direto: ${scaleLink}`;
                navigator.clipboard.writeText(text).catch(() => {});
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.487-1.761-1.66-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
              </svg>
              Enviar Apenas Texto p/ WhatsApp
            </button>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <Button
                variant="secondary"
                onClick={() => {
                  const fDate = isNoDate ? "" : new Date(resolvedDateStr + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
                  const scaleLink = window.location.origin + (isBandScale(scale) ? "/band-scales/" : "/scales/") + scale.id;
                  const text = `Confira a escala para ${scaleTitle}${fDate ? ` em ${fDate}` : ''}.\n\nAcesso direto: ${scaleLink}`;
                  navigator.clipboard.writeText(text);
                  alert("Texto e link copiados com sucesso!");
                }}
                className="w-full py-2 text-xs flex items-center justify-center gap-1.5"
              >
                <ClipboardListIcon className="w-3.5 h-3.5" />
                Copiar Texto
              </Button>

              <Button
                variant="secondary"
                disabled={!sharingImageSrc}
                onClick={() => {
                  if (sharingImageSrc) {
                    downloadImageFallback(sharingImageSrc);
                  }
                }}
                className="w-full py-2 text-xs flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar Imagem
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ScaleDetailModal;
