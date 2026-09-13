import React from 'react';
import type { GlobalSong } from '../../types';
import { MusicNoteIcon } from '../icons/MusicNoteIcon';
import { Download, Check, Loader2, Edit, Trash2, Library, Sparkles } from 'lucide-react';
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
      className: 'border-emerald-400/[0.16] bg-emerald-500/[0.065] text-emerald-300',
    };
  }
  if (hasChords) {
    return {
      label: t('library.only_chords', 'Só Cifra'),
      className: 'border-primary/20 bg-primary/[0.07] text-primary-light',
    };
  }
  if (hasLyrics) {
    return {
      label: t('library.only_lyrics', 'Só Letra'),
      className: 'border-amber-400/[0.17] bg-amber-500/[0.06] text-amber-200',
    };
  }
  return {
    label: t('library.incomplete', 'Incompleta'),
    className: 'border-white/[0.07] bg-white/[0.03] text-white/42',
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
    <article
      onClick={handleCardClick}
      className={`ms-card ms-card-interactive group relative flex min-w-0 max-w-full cursor-pointer flex-col overflow-hidden p-4 sm:p-5 ${
        selected
          ? 'border-primary/45 bg-primary/[0.08] shadow-[0_16px_42px_-28px_rgba(79,140,255,0.8)] ring-1 ring-primary/20'
          : ''
      }`}
    >
      <div className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent ${selected ? 'via-primary/80' : 'via-primary/35'} to-transparent`} />
      <div className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-primary/[0.045] blur-3xl opacity-60 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none" />

      {selectable && (
        <button
          type="button"
          className="premium-interactive absolute right-4 top-4 z-10"
          onClick={handleCheckboxClick}
          disabled={isImported}
          aria-pressed={selected}
        >
          <span className={`flex h-6 w-6 items-center justify-center rounded-[8px] border transition-colors ${
            isImported
              ? 'cursor-not-allowed border-white/[0.06] bg-white/[0.035] text-white/28'
              : selected
                ? 'border-primary bg-primary text-white'
                : 'border-white/[0.12] bg-[#11131a]/90 text-transparent hover:border-white/25'
          }`}>
            {(isImported || selected) && <Check className="h-3.5 w-3.5" />}
          </span>
        </button>
      )}

      <div className={`relative flex items-start justify-between gap-3 ${selectable ? 'pr-9' : ''}`}>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${
            isImported
              ? 'border-emerald-400/[0.16] bg-emerald-500/[0.065] text-emerald-300'
              : 'border-primary/18 bg-primary/[0.065] text-primary-light'
          }`}>
            {isImported ? <Check className="h-3 w-3 shrink-0" /> : <Library className="h-3 w-3 shrink-0" />}
            <span className="truncate">{isImported ? t('library.in_repertoire', 'No repertório') : t('library.b_viva', 'B. Viva')}</span>
          </span>

          <span className={`inline-flex max-w-full truncate rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] ${status.className}`}>
            {status.label}
          </span>

          {song.freshness?.status === 'new' && (
            <span className="inline-flex rounded-full border border-emerald-400/[0.14] bg-emerald-500/[0.055] px-2.5 py-1 text-[9px] font-bold tracking-[0.1em] text-emerald-300" title={t('songs.new_badge', 'NOVA')}>
              {t('songs.new_badge', 'NOVA')}
            </span>
          )}
          {song.freshness?.status === 'old' && (
            <span className="inline-flex rounded-full border border-amber-400/[0.14] bg-amber-500/[0.055] px-2.5 py-1 text-[9px] font-bold tracking-[0.1em] text-amber-200" title={t('songs.old_badge', 'ANTIGA')}>
              {t('songs.old_badge', 'ANTIGA')}
            </span>
          )}
        </div>

        {song.language && song.language !== 'unknown' && song.language !== 'other' && (
          <span className="shrink-0 text-[13px] leading-none" title={`${t('library.language_prefix', 'Idioma:')} ${song.language.toUpperCase()}`}>
            {song.language === 'pt' ? '🇧🇷' : song.language === 'en' ? '🇺🇸' : song.language === 'es' ? '🇪🇸' : ''}
          </span>
        )}
      </div>

      <div className="relative mt-5 flex min-w-0 items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/[0.07] bg-white/[0.035] text-primary-light/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
          <MusicNoteIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="line-clamp-2 break-words text-[17px] font-semibold leading-tight tracking-[-0.025em] text-white transition-colors duration-200 group-hover:text-primary-light motion-reduce:transition-none sm:text-[18px]">
            {song.title}
          </h3>
          <p className="mt-1 truncate text-[12px] font-medium text-white/42 sm:text-[13px]">
            {song.artist}
          </p>
        </div>
      </div>

      {searchMatch?.matchOrigin === 'lyrics' && searchTerm && (
        <div className="relative mt-4 rounded-[12px] border border-white/[0.055] bg-white/[0.025] p-3 text-[11px] italic leading-relaxed text-white/42">
          <span className="mr-1 font-semibold not-italic text-primary-light/80">{t('library.in_lyrics', 'Na letra:')}</span>
          “{getSearchSnippet(song.lyrics, searchTerm)}”
        </div>
      )}

      <div className="relative mt-5 grid grid-cols-2 overflow-hidden rounded-[13px] border border-white/[0.055] bg-black/[0.08]">
        <div className="px-3 py-2.5">
          <span className="block text-[8px] font-bold uppercase tracking-[0.16em] text-white/26">{t('library.key_short', 'Tom')}</span>
          <span className={`mt-1 block truncate text-[13px] font-semibold ${searchMatch?.matchOrigin === 'key' ? 'text-primary-light' : 'text-white/72'}`}>
            {song.key || '—'}
          </span>
        </div>
        <div className="border-l border-white/[0.055] px-3 py-2.5">
          <span className="block text-[8px] font-bold uppercase tracking-[0.16em] text-white/26">{t('library.bpm_short', 'BPM')}</span>
          <span className="mt-1 block truncate text-[13px] font-semibold tabular-nums text-white/72">{song.bpm || '—'}</span>
        </div>
      </div>

      <div className="relative mt-auto pt-4">
        <div className="mb-3 flex min-w-0 items-center justify-between gap-2 border-t border-white/[0.055] pt-3">
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-[10.5px] font-semibold text-white/34">
            {song.importCount !== undefined && song.importCount > 0 ? (
              <>
                <Download className="h-3.5 w-3.5 shrink-0 text-primary-light/65" />
                <span className="truncate">
                  {song.importCount === 1
                    ? t('library.import_one', '1 importação')
                    : t('library.import_other', '{{count}} importações', { count: song.importCount })}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary-light/65" />
                <span className="truncate">{t('library.original', 'Original')}</span>
              </>
            )}
          </div>

          {isEcosystemAdmin && onDelete && onEdit && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(song, e); }}
                className="premium-interactive flex h-8 w-8 items-center justify-center rounded-[10px] text-white/30 hover:bg-white/[0.04] hover:text-primary-light"
                title={t('library.edit_global_title', 'Editar Música Global')}
              >
                <Edit className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(song, e); }}
                className="premium-interactive flex h-8 w-8 items-center justify-center rounded-[10px] text-white/30 hover:bg-red-500/[0.08] hover:text-red-300"
                title={t('library.delete_global_title', 'Excluir Música Global')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => onImport(song, e)}
          disabled={isImporting || isImported}
          className={`premium-interactive relative flex min-h-[44px] w-full items-center justify-center gap-2 overflow-hidden rounded-[13px] border px-4 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
            isImported
              ? 'border-emerald-400/[0.16] bg-emerald-500/[0.07] text-emerald-300'
              : isImporting
                ? 'border-primary/15 bg-primary/[0.06] text-primary-light'
                : 'border-white/[0.11] bg-white text-[#0b0d12] shadow-[0_10px_28px_-20px_rgba(255,255,255,0.8)] hover:bg-white/92'
          }`}
        >
          <span className={`inline-flex min-w-0 items-center gap-2 transition-[transform,opacity] duration-200 motion-reduce:transition-none ${isImporting ? '-translate-y-6 opacity-0' : 'translate-y-0 opacity-100'}`}>
            {isImported ? <Check className="h-4 w-4 shrink-0" /> : <Download className="h-4 w-4 shrink-0" />}
            <span className="truncate">{isImported ? t('library.imported_btn', 'Adicionada') : t('library.import_btn', 'Importar')}</span>
          </span>
          <span className={`absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-200 motion-reduce:transition-none ${isImporting ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          </span>
        </button>
      </div>
    </article>
  );
};
