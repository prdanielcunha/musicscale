import React, { useState, useRef, useEffect } from "react";
import type { PopulatedSong } from "../../types";
import { Music, FileText, ArrowRight, FileCheck, MoreHorizontal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import ConfirmationModal from "../common/ConfirmationModal";
import { useApi } from "../../contexts/ApiContext";
import { useSafeAction } from "../../hooks/useSafeAction";

const getLanguageFlag = (lang?: string) => {
  if (lang === 'pt') return '🇧🇷';
  if (lang === 'en') return '🇺🇸';
  if (lang === 'es') return '🇪🇸';
  return '';
};

interface ChordCardProps {
  song: PopulatedSong;
  onClick: (song: PopulatedSong) => void;
  showFormatBadge?: "cifra" | "letra";
}

const ChordCard: React.FC<ChordCardProps> = ({ song, onClick, showFormatBadge = "cifra" }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const api = useApi();
  
  const { permissions, userProfile } = useAuth();
  const canEdit = !!(permissions?.manageSongs || permissions?.manageChords || permissions?.['musicScale.manageSongs'] || permissions?.['musicscale.songs.edit'] || permissions?.['musicscale.chords.edit']);
  const canDelete = !!(permissions?.manageSongs || permissions?.manageChords || permissions?.['musicScale.manageSongs'] || permissions?.['musicscale.songs.edit'] || permissions?.['musicscale.chords.edit']);
  const { executeSafeAction } = useSafeAction();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const cardClasses = `relative bg-white/70 dark:bg-[#151515]/80 backdrop-blur-3xl rounded-[28px] border border-black/[0.04] dark:border-white/[0.08] shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-black/[0.08] dark:hover:border-white/[0.12] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] hover:-translate-y-1 flex flex-col p-5 sm:p-6 cursor-pointer overflow-visible group min-h-[44px]`;

  const hasContent = showFormatBadge === "cifra" ? !!song.chords?.trim() : !!song.lyrics?.trim();
  const contentName = showFormatBadge === "cifra" ? "Cifra" : "Letra";
  
  let contentStatus = { label: "INDISPONÍVEL", color: "text-slate-500 bg-slate-100 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/5", icon: showFormatBadge === "cifra" ? <Music className="w-3 h-3" /> : <FileText className="w-3 h-3" /> };
  if (hasContent) {
     contentStatus = { label: "DISPONÍVEL", color: "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-500/20", icon: <FileCheck className="w-3 h-3" /> };
  }

  const handleActionClick = (e: React.MouseEvent, action: () => void, actionKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen(false);
    executeSafeAction(action, { key: actionKey });
  };

  const handleDeleteContent = async () => {
    if (!song.id || !userProfile || !api) return;
    setIsDeleting(true);
    try {
      const updateData = showFormatBadge === "cifra" ? { chords: "" } : { lyrics: "" };
      await api.songs.update(song.id, updateData);
      // Wait a moment for UI to reflect if needed or page will auto update from context
    } catch (error) {
      console.error(`Failed to delete ${contentName}`, error);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <div
      onClick={() => onClick(song)}
      className={cardClasses}
    >
      {/* Premium subtle inner glows */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-t-[28px]"></div>
      <div className="absolute -inset-[80px] bg-gradient-to-br from-primary/10 dark:from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10 rounded-full blur-[80px]"></div>

      {/* Badges Row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Format Badge */}
        <div className="flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 border border-slate-200 dark:border-white/10 shadow-sm">
          {showFormatBadge === "cifra" ? "Cifra" : "Letra"}
        </div>

        {/* Content Status */}
        <div className={`flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full ${contentStatus.color}`}>
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
      <div className="flex-1 min-w-0 pr-6 mt-1 mb-8">
        <h3
          className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white truncate tracking-tight group-hover:text-primary transition-colors duration-300"
          title={song.title}
        >
          {song.title}
        </h3>
        <p
          className="text-[13px] sm:text-[14px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5"
          title={song.artist}
        >
          {song.artist}
        </p>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="flex flex-col">
               <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tom</span>
               <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{song.key || "—"}</span>
             </div>
             <div className="w-[1px] h-6 bg-slate-200 dark:bg-white/10 mx-1 flex-shrink-0"></div>
             <div className="flex flex-col">
               <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">BPM</span>
               <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{song.bpm || "—"}</span>
             </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMenuOpen(!isMenuOpen);
            }}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-all touch-manipulation ${isMenuOpen ? 'bg-slate-200 text-slate-900 dark:bg-white/20 dark:text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-400 hover:bg-primary hover:text-white dark:hover:bg-primary'}`}
            title="Opções"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full right-0 mb-2 w-48 bg-white/95 dark:bg-[#1A1A1C]/95 backdrop-blur-3xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl rounded-2xl p-1 z-50 origin-bottom-right"
              >
                <div className="flex flex-col">
                  <button
                    onClick={(e) => handleActionClick(e, () => onClick(song), `menu-view-${song.id}`)}
                    className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors flex items-center gap-2"
                  >
                    Visualizar detalhes
                  </button>
                  {canEdit && (
                    <button
                      onClick={(e) => handleActionClick(e, () => onClick(song), `menu-edit-${song.id}`)}
                      className="w-full text-left px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors flex items-center gap-2"
                    >
                      Editar {contentName}
                    </button>
                  )}
                  
                  {/* Divider */}
                  {canDelete && <div className="h-px bg-slate-100 dark:bg-white/5 my-1 mx-2" />}
                  
                  {canDelete && (
                     <button
                       onClick={(e) => handleActionClick(e, () => setIsDeleteModalOpen(true), `menu-delete-${song.id}`)}
                       className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors flex items-center gap-2"
                     >
                       Excluir {contentName}
                     </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteContent}
        title={`Excluir ${contentName}`}
        message={`Tem certeza que deseja excluir a ${contentName.toLowerCase()} da música "${song.title}"? A música continuará existindo no repertório, mas ficará sem ${contentName.toLowerCase()}. Essa ação não pode ser desfeita.`}
        confirmText="Excluir"
        type="danger"
        isSubmitting={isDeleting}
      />
    </div>
  );
};

export default ChordCard;

