import React, { useState, useRef, useEffect } from "react";
import { 
  Plus, MoreHorizontal, FileText, Music, 
  Library, Sparkles, Layers, Activity, FileCheck, Check
} from "lucide-react";
import type { PopulatedSong } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useSafeAction } from "../../hooks/useSafeAction";
import { motion, AnimatePresence } from "motion/react";

import { getSongFreshnessStatus } from "../../utils/songHelpers";

const getTagColor = (tagName: string) => {
  const colors = [
    "bg-indigo-50/80 text-indigo-700 border-indigo-100/50 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20",
    "bg-emerald-50/80 text-emerald-700 border-emerald-100/50 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
    "bg-amber-50/80 text-amber-700 border-amber-100/50 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20",
    "bg-rose-50/80 text-rose-700 border-rose-100/50 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20",
    "bg-blue-50/80 text-blue-700 border-blue-100/50 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20",
    "bg-purple-50/80 text-purple-700 border-purple-100/50 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20",
    "bg-cyan-50/80 text-cyan-700 border-cyan-100/50 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20",
  ];
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

interface SongCardProps {
  song: PopulatedSong;
  onView: (song: PopulatedSong) => void;
  onEdit: (song: PopulatedSong) => void;
  onDelete: (song: PopulatedSong) => void;
  onCreateScale: (song: PopulatedSong) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelectToggle: (songId: string) => void;
}

import { useApi } from "../../contexts/ApiContext";
import ConfirmationModal from "../common/ConfirmationModal";

const getLanguageFlag = (lang?: string) => {
  if (lang === 'pt') return '🇧🇷';
  if (lang === 'en') return '🇺🇸';
  if (lang === 'es') return '🇪🇸';
  return '';
};

const SongCard: React.FC<SongCardProps> = ({
  song,
  onView,
  onEdit,
  onDelete,
  onCreateScale,
  isSelectionMode,
  isSelected,
  onSelectToggle,
}) => {
  const { permissions, userProfile } = useAuth();
  const canEdit = !!(permissions?.manageSongs || permissions?.['musicScale.manageSongs'] || permissions?.['musicscale.songs.edit']);
  const canDelete = !!(permissions?.manageSongs || permissions?.['musicScale.manageSongs'] || permissions?.['musicscale.songs.edit']);
  const { executeSafeAction } = useSafeAction();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteContentModalOpen, setIsDeleteContentModalOpen] = useState(false);
  const [contentToDelete, setContentToDelete] = useState<"cifra" | "letra" | null>(null);
  const [isDeletingContent, setIsDeletingContent] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const api = useApi();

  const handleDeleteContent = async () => {
    if (!song.id || !userProfile || !contentToDelete || !api) return;
    setIsDeletingContent(true);
    try {
      const updateData = contentToDelete === "cifra" ? { chords: "" } : { lyrics: "" };
      await api.songs.update(song.id, updateData);
    } catch (error) {
      console.error(`Failed to delete ${contentToDelete}`, error);
    } finally {
      setIsDeletingContent(false);
      setIsDeleteContentModalOpen(false);
      setContentToDelete(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleActionClick = (e: React.MouseEvent, action: () => void, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    executeSafeAction(action, { key });
  };

  const handleMainClick = (e: React.MouseEvent) => {
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }
    e.preventDefault();
    executeSafeAction(() => {
        if (isSelectionMode) {
          onSelectToggle(song.id);
        } else {
          onView(song);
        }
    }, { key: `view-song-${song.id}` });
  };

  const cardClasses = `relative bg-white/90 dark:bg-[#1A1A1C]/60 backdrop-blur-2xl rounded-[24px] border border-black/[0.04] dark:border-white/[0.06] shadow-sm transition-all duration-300 hover:border-black/[0.1] dark:hover:border-white/[0.1] hover:shadow-md hover:bg-white dark:hover:bg-[#1A1A1C]/80 hover:-translate-y-[2px] flex flex-col p-5 cursor-pointer overflow-visible group min-h-[44px] ${
    isSelected
      ? "ring-2 ring-primary border-transparent bg-primary/5 dark:bg-primary/10"
      : ""
  }`;

  const hasLyrics = !!song.lyrics?.trim();
  const hasChords = !!song.chords?.trim();
  
  let contentStatus = { label: "Incompleta", color: "text-slate-500 bg-slate-100 dark:bg-white/5 dark:text-slate-400", icon: <FileText className="w-3 h-3" /> };
  if (hasLyrics && hasChords) contentStatus = { label: "Completa", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/20", icon: <FileCheck className="w-3 h-3" /> };
  else if (hasChords) contentStatus = { label: "Só Cifra", color: "text-indigo-700 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-500/20", icon: <Music className="w-3 h-3" /> };
  else if (hasLyrics) contentStatus = { label: "Só Letra", color: "text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/20", icon: <FileText className="w-3 h-3" /> };

  let contextualInfo = null;
  if (song.lastPlayed) {
    const daysSince = Math.floor((new Date().getTime() - new Date(song.lastPlayed).getTime()) / (1000 * 3600 * 24));
    if (daysSince === 0) contextualInfo = "Tocada hoje";
    else if (daysSince === 1) contextualInfo = "Tocada ontem";
    else contextualInfo = `Tocada há ${daysSince} dias`;
  } else {
    contextualInfo = "Ainda não usada";
  }

  const freshnessStatus = getSongFreshnessStatus(song);

  return (
    <div className={cardClasses} onClick={handleMainClick}>
      {/* Premium subtle inner glows */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-t-[28px]"></div>
      <div className="absolute -inset-[80px] bg-gradient-to-br from-primary/10 dark:from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10 rounded-full blur-[80px]"></div>
      
      {isSelectionMode && (
        <div
          className="absolute top-4 right-4 z-10 p-1.5 bg-white/80 dark:bg-black/50 backdrop-blur-md rounded-full border border-black/5 dark:border-white/10"
          onClick={(e) => handleActionClick(e, () => onSelectToggle(song.id), `toggle-${song.id}`)}
        >
          <input
            type="checkbox"
            checked={isSelected}
            readOnly
            className="h-5 w-5 rounded-full bg-slate-100 dark:bg-white/10 border-transparent text-primary focus:ring-0 cursor-pointer pointer-events-none"
          />
        </div>
      )}

      {/* Badges Row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {freshnessStatus === 'new' && (
          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/20 shadow-sm" title="Música Nova">
            <Sparkles className="w-3 h-3" /> Nova
          </div>
        )}
        {freshnessStatus === 'old' && (
          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-500/20 shadow-sm" title="Música Antiga">
            Antiga
          </div>
        )}

        {/* Origin Badge */}
        {song.originGlobalSongId ? (
          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-500/20 shadow-sm" title="Importada da Biblioteca Viva">
            <Library className="w-3 h-3" /> BViva
          </div>
        ) : song.aiProcessed ? (
          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-500/20 shadow-sm" title="Processada por Inteligência Artificial">
            <Sparkles className="w-3 h-3" /> IA
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 dark:bg-white/5 dark:text-white/60 border border-slate-200/60 dark:border-white/5 shadow-sm" title="Adicionada Localmente">
            <Layers className="w-3 h-3" /> Local
          </div>
        )}

        {/* Content Status Badge */}
        <div className={`flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full shadow-sm ${contentStatus.color}`}>
          {contentStatus.icon} {contentStatus.label}
        </div>

        {/* Language */}
        {song.language && song.language !== 'unknown' && song.language !== 'other' && (
           <span className="text-[12px] leading-none drop-shadow-sm ml-auto bg-black/5 dark:bg-white/5 p-1 rounded-full border border-black/5 dark:border-white/5" title={`Idioma: ${song.language.toUpperCase()}`}>
             {getLanguageFlag(song.language)}
           </span>
        )}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0 pr-6 mt-1 mb-6">
        <h3
          className="text-[19px] sm:text-[22px] font-bold text-slate-900 dark:text-white truncate tracking-tight group-hover:text-primary transition-colors duration-300 drop-shadow-sm dark:drop-shadow-none"
          title={song.title}
        >
          {song.title}
        </h3>
        <p
          className="text-[14px] font-medium text-slate-500 dark:text-white/60 truncate mt-0.5"
          title={song.artist}
        >
          {song.artist}
        </p>
      </div>

      <div className="mt-auto">
        {/* Contextual Line & Stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
           <div className="flex items-center gap-2">
             <div className="flex flex-col">
               <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-0.5">Tom</span>
               <span className="text-[13px] font-bold text-slate-800 dark:text-white/90 leading-none">{song.key || "—"}</span>
             </div>
             <div className="w-[1px] h-6 bg-slate-200 dark:bg-white/10 mx-2"></div>
             <div className="flex flex-col">
               <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-0.5">BPM</span>
               <span className="text-[13px] font-bold text-slate-800 dark:text-white/90 leading-none">{song.bpm || "—"}</span>
             </div>
           </div>
           
           <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-slate-500">
             <Activity className="w-3.5 h-3.5 opacity-60" />
             {contextualInfo}
           </div>
        </div>

        {!isSelectionMode && (
          <div className="flex items-center justify-between gap-3 relative">
            <button
              onClick={(e) => handleActionClick(e, () => onCreateScale(song), `create-scale-${song.id}`)}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 md:py-2.5 rounded-full text-sm md:text-[13px] font-bold text-white bg-slate-900 shadow-md shadow-slate-900/10 hover:bg-primary hover:shadow-primary/20 dark:bg-white dark:text-black dark:shadow-white/5 dark:hover:bg-primary dark:hover:text-white transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 touch-manipulation"
              title="Adicionar à Escala"
            >
              <Plus className="w-4 h-4 md:w-3.5 md:h-3.5" /> 
              <span>À Escala</span>
            </button>
            
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className={`flex items-center justify-center w-11 h-11 md:w-9 md:h-9 rounded-full transition-all touch-manipulation ${isMenuOpen ? 'bg-slate-200 text-slate-900 dark:bg-white/20 dark:text-white' : 'text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'}`}
                title="Opções"
              >
                <MoreHorizontal className="w-5 h-5 md:w-4 md:h-4" />
              </button>

              <AnimatePresence>
                {isMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-[#1A1A1C]/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl rounded-2xl p-1 z-50 origin-bottom-right"
                  >
                    <div className="flex flex-col">
                      <button
                        onClick={(e) => handleActionClick(e, () => onView(song), `menu-view-${song.id}`)}
                        className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                      >
                        Visualizar detalhes
                      </button>
                      {canEdit && (
                        <button
                          onClick={(e) => handleActionClick(e, () => onEdit(song), `menu-edit-${song.id}`)}
                          className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                        >
                          Editar música
                        </button>
                      )}

                      {/* Divider */}
                      {canDelete && <div className="h-px bg-slate-100 dark:bg-white/5 my-1 mx-2" />}
                      
                      {canDelete && (
                         <button
                           onClick={(e) => handleActionClick(e, () => onDelete(song), `menu-delete-${song.id}`)}
                           className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                         >
                           Excluir do repertório
                         </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={isDeleteContentModalOpen}
        onClose={() => { setIsDeleteContentModalOpen(false); setContentToDelete(null); }}
        onConfirm={handleDeleteContent}
        title={`Excluir ${contentToDelete === "cifra" ? "Cifra" : "Letra"}`}
        message={`Tem certeza que deseja excluir a ${contentToDelete} da música "${song.title}"? A música continuará existindo no repertório, mas ficará sem ${contentToDelete}. Essa ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        isSubmitting={isDeletingContent}
      />
    </div>
  );
};

export default SongCard;

