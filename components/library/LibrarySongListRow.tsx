import { useTranslation } from 'react-i18next';
import React from 'react';
import type { GlobalSong } from '../../types';
import { MusicNoteIcon } from '../icons/MusicNoteIcon';
import { Download, Check, Loader2, Edit, Trash2, Sparkles } from 'lucide-react';
import { getSearchSnippet } from '../../utils/searchEngine';

interface LibrarySongListRowProps {
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
    className: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400 border border-slate-200 dark:border-white/10 shadow-sm',
  };
};

export const LibrarySongListRow: React.FC<LibrarySongListRowProps> = ({
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

  const handleRowClick = (e: React.MouseEvent) => {
    if (selectable) {
      if (isImported) return;
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
    <div
      onClick={handleRowClick}
      className={`group relative flex items-center border-b border-black/[0.04] dark:border-white/[0.04] p-4 cursor-pointer transition-all duration-300 hover:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] first:rounded-t-[24px] last:rounded-b-[24px] last:border-b-0 overflow-hidden ${
        selected 
          ? "bg-blue-500/[0.04] dark:bg-blue-500/[0.08]" 
          : "bg-white/40 dark:bg-[#1A1A1F]/40 backdrop-blur-[16px] hover:bg-white dark:hover:bg-[#1E1E24]/60 active:scale-[0.99] md:hover:-translate-y-0.5"
      }`}
    >
      {/* List row subtle edge glow on hover */}
      <div className={`absolute left-0 inset-y-0 w-1 transition-opacity duration-300 ${selected ? 'bg-blue-500 opacity-100' : 'bg-blue-500 opacity-0 group-hover:opacity-100'}`}></div>

      {selectable && (
        <div className="mr-4" onClick={handleCheckboxClick}>
          <div className={`size-5 rounded flex items-center justify-center transition-all ${
            isImported 
              ? "bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/20 opacity-50 cursor-not-allowed" 
              : selected 
                ? "bg-blue-500 border-blue-500" 
                : "bg-white/50 dark:bg-[#1C1C1E] border border-black/10 dark:border-white/20 group-hover:border-black/20 dark:group-hover:border-white/30"
          }`}>
            {isImported ? (
               <Check className="size-3 text-slate-400 dark:text-white/50" />
            ) : selected ? (
               <Check className="size-3 text-white" />
            ) : null}
          </div>
        </div>
      )}


      <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-300 mr-4 shadow-sm border ${isImported ? 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400' : 'bg-slate-100 border-slate-200/60 text-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 group-hover:bg-blue-50 group-hover:border-blue-200 group-hover:text-blue-500 dark:group-hover:bg-blue-500/10 dark:group-hover:text-blue-400 dark:group-hover:border-blue-500/20'}`}>
        <MusicNoteIcon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 lg:gap-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white tracking-tight truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
              {song.title}
            </h3>
            {song.language && song.language !== 'unknown' && song.language !== 'other' && (
             <span className="text-[10px] leading-none drop-shadow-sm bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 p-0.5 px-1 rounded" title={`${t("library.language_prefix", "Idioma:")} ${song.language?.toUpperCase()}`}>
               {song.language === 'pt' ? '🇧🇷' : song.language === 'en' ? '🇺🇸' : song.language === 'es' ? '🇪🇸' : ''}
             </span>
           )}
           {song.freshness?.status === 'new' && (
             <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[10px] tracking-wider font-bold rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" title="Música Nova">
               {t("songs.new_badge", "NOVA")}
             </span>
           )}
           {song.freshness?.status === 'old' && (
             <span className="px-2 py-0.5 inline-flex items-center gap-1 text-[10px] tracking-wider font-bold rounded-md bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" title="Música Antiga">
               {t("songs.old_badge", "ANTIGA")}
             </span>
           )}
          </div>
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 truncate">
            {song.artist}
          </p>
          {searchMatch?.matchOrigin === 'lyrics' && searchTerm && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic truncate mt-0.5 max-w-[200px] md:max-w-[400px]">
              <span className="font-semibold text-blue-600 dark:text-blue-400 mr-1">{t('library.in_lyrics', 'Na letra:')}</span>
              "{getSearchSnippet(song.lyrics, searchTerm)}"
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 md:w-56 flex-shrink-0">
           <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${status.className}`}>
             {status.label}
           </span>
           <div className="flex flex-col items-start gap-px">
             <div className="flex items-center gap-1.5 opacity-80" title={t("library.key_short", "Tom")}>
               <span className="text-[8px] font-bold uppercase text-slate-400 w-6">{t("library.key_short", "Tom")}</span>
               {searchMatch && searchTerm ? (
                 <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1 py-0.5 rounded border border-blue-100 dark:border-blue-500/20">{song.key || "—"}</span>
               ) : (
                 <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{song.key || "—"}</span>
               )}
             </div>
             <div className="flex items-center gap-1.5 opacity-80" title={t("library.bpm_short", "BPM")}>
                <span className="text-[8px] font-bold uppercase text-slate-400 w-6">{t("library.bpm_short", "BPM")}</span>
                <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">{song.bpm || "—"}</span>
             </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-1 w-24 flex-shrink-0 text-[11px] font-bold text-slate-400 dark:text-slate-500">
          {song.importCount !== undefined && song.importCount > 0 ? (
            <>
              <Download className="w-3 h-3 opacity-70" />
              <span>
                {song.importCount === 1 
                  ? t("library.import_one", "1 importação") 
                  : t("library.import_other", "{{count}} importações", { count: song.importCount })}
              </span>
            </>
          ) : (
             <div className="flex items-center gap-1 text-blue-500 dark:text-blue-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t("library.original", "Original")}</span>
             </div>
          )}
        </div>
      </div>

      <div className="ml-4 flex-shrink-0 flex items-center gap-2 relative z-10">
        {isEcosystemAdmin && onDelete && onEdit && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(song, e); }}
              className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
              title={t("library.edit_global_title", "Editar Música Global")}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(song, e); }}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
              title={t("library.delete_global_title", "Excluir Música Global")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        <button
          onClick={(e) => onImport(song, e)}
          disabled={isImporting || isImported}
          className={`relative h-8 px-4 rounded-full text-[11px] font-bold tracking-wide transition-all duration-300 active:scale-95 flex items-center justify-center border
            ${isImported
              ? 'bg-slate-100 text-slate-400 border-transparent dark:bg-white/5 dark:text-slate-500 cursor-default shadow-none'
              : isImporting
                ? 'bg-blue-50 text-blue-500 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20 cursor-wait'
                : 'bg-white text-slate-700 border-slate-200/60 hover:border-transparent hover:bg-black hover:text-white hover:shadow-md dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white dark:hover:text-black dark:hover:border-transparent'
            }`}
        >
          <span className={`inline-flex items-center gap-1.5 transition-transform duration-300 ${isImporting ? '-translate-y-8 opacity-0' : 'translate-y-0 opacity-100'}`}>
            {isImported ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3 h-3" />}
            <span className="hidden sm:inline">{isImported ? t("library.imported_btn", "Adicionada") : t("library.import_btn", "Importar")}</span>
          </span>
          <span className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${isImporting ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          </span>
        </button>
      </div>
    </div>
  );
};
