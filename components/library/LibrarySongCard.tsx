import React from 'react';
import type { GlobalSong } from '../../types';
import { MusicNoteIcon } from '../icons/MusicNoteIcon';
import { Download, Check, Loader2, Play, Edit, Trash2, Library, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { getSearchSnippet } from '../../utils/searchEngine';

interface LibrarySongCardProps {
  song: GlobalSong;
  isImporting: boolean;
  isImported: boolean;
  onImport: (song: GlobalSong, e: React.MouseEvent) => void;
  onClick: (song: GlobalSong) => void;
  onEdit?: (song: GlobalSong, e: React.MouseEvent) => void;
  onDelete?: (song: GlobalSong, e: React.MouseEvent) => void;
  isEcosystemAdmin?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelection?: (songId: string, e: React.MouseEvent) => void;
  searchMatch?: import('../../utils/searchEngine').SearchMatch;
  searchTerm?: string;
}

const getStatusBadge = (song: GlobalSong, t: any) => {
  const hasLyrics = !!song.lyrics?.trim();
  const hasChords = !!song.chords?.trim();

  if (hasLyrics && hasChords) {
    return {
      label: t('library.complete_badge', 'Completa'),
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-sm',
    };
  }
  if (hasChords) {
    return {
      label: t('library.only_chords', 'Só Cifra'),
      className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 shadow-sm',
    };
  }
  if (hasLyrics) {
    return {
      label: t('library.only_lyrics', 'Só Letra'),
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 shadow-sm',
    };
  }
  return {
    label: t('library.incomplete', 'Incompleta'),
    className: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10 shadow-sm',
  };
};

export const LibrarySongCard: React.FC<LibrarySongCardProps> = ({
  song,
  isImporting,
  isImported,
  onImport,
  onClick,
  onEdit,
  onDelete,
  isEcosystemAdmin,
  selectable = false,
  selected = false,
  onToggleSelection,
  searchMatch,
  searchTerm
}) => {
  const { t } = useTranslation();
  const status = getStatusBadge(song, t);

  const handleCardClick = (e: React.MouseEvent) => {
    if (selectable) {
      if (isImported) return; // don't toggle if already imported
      onToggleSelection?.(song.id, e);
    } else {
      onClick(song);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isImported) {
      onToggleSelection?.(song.id, e);
    }
  };

  return (
    <article
      onClick={handleCardClick}
      className={`group relative flex flex-col min-w-0 max-w-full overflow-hidden border rounded-[28px] p-4 sm:p-5 cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        selected
          ? "bg-blue-50 dark:bg-blue-500/[0.08] border-blue-400/50 shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[0.99]"
          : "bg-white dark:bg-[#1A1A1F]/60 backdrop-blur-[32px] saturate-[180%] shadow-sm dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)] border-black/[0.05] dark:border-white/[0.05] hover:border-black/[0.1] md:hover:bg-[#1E1E24]/70 dark:hover:border-white/[0.1] hover:shadow-md md:hover:-translate-y-1 active:scale-[0.98]"
      }`}
    >
      {selectable && (
        <div className="absolute top-4 right-4 z-10" onClick={handleCheckboxClick}>
          <div className={`size-5 rounded flex items-center justify-center transition-all ${
            isImported 
              ? "bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/20 opacity-50 cursor-not-allowed" 
              : selected 
                ? "bg-blue-500 border-blue-500" 
                : "bg-white/50 dark:bg-[#1C1C1E] border border-black/10 dark:border-white/20 hover:border-black/20 dark:hover:border-white/30"
          }`}>
            {isImported ? (
               <Check className="size-3 text-slate-400 dark:text-white/50" />
            ) : selected ? (
               <Check className="size-3 text-white" />
            ) : null}
          </div>
        </div>
      )}

      {/* Vercel inspired subtle top highlight */}
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent ${selected ? 'via-blue-500/50' : 'via-blue-500/20 dark:via-blue-400/20'} to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-t-[28px]`}></div>


      {/* Minimal background spotlight on hover */}
      <div className="absolute -inset-[80px] bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10 rounded-full blur-[80px]"></div>

      <div className="flex justify-between items-start mb-4 gap-2 min-w-0 max-w-full">
        <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
           {/* Library Indicator */}
           <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border transition-colors shadow-sm max-w-full truncate shrink-0
               ${isImported ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' : 'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'}
             `}>
             {isImported ? <Check className="size-3 shrink-0" /> : <Library className="size-3 shrink-0" />}
            <span className="truncate">{isImported ? t("library.in_repertoire", "No repertório") : t("library.b_viva", "B. Viva")}</span>
           </div>

           <span className={`text-[10px] items-center flex font-bold uppercase tracking-widest px-2.5 py-1 rounded-full max-w-full truncate shrink-0 ${status.className}`}>
             <span className="truncate">{status.label}</span>
           </span>

           {song.freshness?.status === 'new' && (
             <span className="px-2.5 py-1 inline-flex items-center text-[10px] tracking-wider font-bold rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 shadow-sm shrink-0" title="Música Nova">
               {t("songs.new_badge", "NOVA")}
             </span>
           )}
           {song.freshness?.status === 'old' && (
             <span className="px-2.5 py-1 inline-flex items-center text-[10px] tracking-wider font-bold rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 shadow-sm shrink-0" title="Música Antiga">
               {t("songs.old_badge", "ANTIGA")}
             </span>
           )}
        </div>
        <div className="flex shrink-0 items-end">
           {song.language && song.language !== 'unknown' && song.language !== 'other' && (
             <span className="text-[14px] leading-none drop-shadow-sm bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-1 rounded-full" title={`${t("library.language_prefix", "Idioma:")} ${song.language.toUpperCase()}`}>
               {song.language === 'pt' ? '🇧🇷' : song.language === 'en' ? '🇺🇸' : song.language === 'es' ? '🇪🇸' : ''}
             </span>
           )}
        </div>
      </div>

      <div className="flex-1 min-w-0 max-w-full mt-2 mb-6">
        <h3 className="line-clamp-2 break-words text-xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
           {song.title}
        </h3>
        <p className="mt-1 truncate text-sm font-medium text-slate-500 dark:text-slate-400">
           {song.artist}
        </p>
        
        {searchMatch?.matchOrigin === 'lyrics' && searchTerm && (
          <div className="mt-2 text-xs italic text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 p-2 rounded-md border border-slate-100 dark:border-white/5">
            <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1">{t('library.in_lyrics', 'Na letra:')}</span>
            "{getSearchSnippet(song.lyrics, searchTerm)}"
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 min-w-0 max-w-full mt-5">
           <div className="flex flex-col min-w-0">
               <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 truncate">{t("library.key_short", "Tom")}</span>
               {searchMatch && searchTerm ? (
                 <span className="text-sm font-black text-blue-600 dark:text-blue-400 truncate bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded-md inline-block w-max border border-blue-100 dark:border-blue-500/20">{song.key || "—"}</span>
               ) : (
                 <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{song.key || "—"}</span>
               )}
           </div>
           <div className="flex flex-col min-w-0 border-l border-slate-200 dark:border-white/10 pl-3">
               <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 truncate">{t("library.bpm_short", "BPM")}</span>
               <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{song.bpm || "—"}</span>
           </div>
        </div>
      </div>

      <div className="mt-auto border-t border-slate-100 dark:border-white/10 pt-4 flex flex-col gap-3 min-w-0 max-w-full">
         <div className="flex items-center justify-between gap-2 min-w-0 max-w-full">
            <div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-[11px] font-semibold text-blue-500 dark:text-blue-400">
               {song.importCount !== undefined && song.importCount > 0 ? (
                 <>
                   <Download className="size-3.5 opacity-70 shrink-0" />
                   <span className="truncate">
                     {song.importCount === 1 
                       ? t("library.import_one", "1 importação") 
                       : t("library.import_other", "{{count}} importações", { count: song.importCount })}
                   </span>
                 </>
               ) : (
                  <>
                     <Sparkles className="size-3.5 shrink-0" />
                     <span className="truncate">{t("library.original", "Original")}</span>
                  </>
               )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isEcosystemAdmin && onDelete && onEdit && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(song, e); }}
                    className="grid size-9 place-items-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-indigo-500/10 rounded-full transition-colors"
                    title={t("library.edit_global_title", "Editar Música Global")}
                  >
                    <Edit className="size-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(song, e); }}
                    className="grid size-9 place-items-center text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-red-500/10 rounded-full transition-colors"
                    title={t("library.delete_global_title", "Excluir Música Global")}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </>
              )}
            </div>
         </div>
                  <button
            onClick={(e) => onImport(song, e)}
            disabled={isImporting || isImported}
            className={`relative flex min-h-[44px] w-full max-w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed
              ${isImported
                ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-600 dark:text-emerald-300'
                : isImporting
                  ? 'bg-blue-50 text-blue-500 dark:bg-blue-500/10 cursor-wait'
                  : 'bg-black text-white hover:bg-black/90 shadow-[0_4px_12px_rgba(0,0,0,0.1)] dark:bg-white dark:text-black dark:hover:bg-white/90'
              }`}
          >
            <span className={`inline-flex items-center gap-2 transition-transform duration-300 min-w-0 max-w-full ${isImporting ? '-translate-y-8 opacity-0' : 'translate-y-0 opacity-100'}`}>
              {isImported ? <Check className="size-4 shrink-0" /> : <Download className="size-4 shrink-0" />}
              <span className="truncate">{isImported ? t("library.imported_btn", "Adicionada") : t("library.import_btn", "Importar")}</span>
            </span>
            <span className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${isImporting ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
              <Loader2 className="size-4 animate-spin shrink-0" />
            </span>
          </button>
      </div>
    </article>
  );
};

