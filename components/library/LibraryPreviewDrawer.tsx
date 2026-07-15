import { useTranslation } from 'react-i18next';
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import type { GlobalSong } from '../../types';
import { X, Download, Check, Loader2, FileText, Music, LayoutList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LibraryPreviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  song: GlobalSong | null;
  isImporting: boolean;
  isImported: boolean;
  onImport: (song: GlobalSong) => void;
}

const getStatusBadge = (song: GlobalSong, t: any) => {
  const hasLyrics = !!song.lyrics?.trim();
  const hasChords = !!song.chords?.trim();

  if (hasLyrics && hasChords) {
    return {
      label: t('library.complete_badge', 'Completa'),
      className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20',
    };
  }
  if (hasChords) {
    return {
      label: t('library.chords', 'Cifra'),
      className: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20',
    };
  }
  if (hasLyrics) {
    return {
      label: t('library.lyrics', 'Letra'),
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20',
    };
  }
  return {
    label: t('library.basic_badge', 'Básica'),
    className: 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10',
  };
};

export const LibraryPreviewDrawer: React.FC<LibraryPreviewDrawerProps> = ({
  isOpen,
  onClose,
  song,
  isImporting,
  isImported,
  onImport,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !song) return null;

  const status = getStatusBadge(song, t);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer (Side on Desktop, Bottom Sheet on Mobile) */}
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-[110] w-full max-w-md bg-white dark:bg-[#111111] shadow-2xl border-l border-black/[0.04] dark:border-white/[0.06] flex flex-col md:translate-y-0 sm:max-w-md"
            style={{ 
              // Basic responsive behavior without media queries in style
               width: '100%',
               maxWidth: '448px' // max-w-md
            }}
          >
            {/* Header */}
            <div className="flex-none p-6 pb-4 border-b border-black/[0.04] dark:border-white/[0.06] flex justify-between items-start">
              <div className="flex flex-col gap-1 pr-8">
                <span className={`w-fit text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-2 ${status.className}`}>
                  {status.label}
                 </span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  {song.title}
                </h2>
                <p className="text-base font-medium text-slate-500 dark:text-slate-400">
                  {song.artist}
                </p>
              </div>
              <button
                onClick={onClose}
                className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Meta Info */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-[#1A1A1C]/60 p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t("library.key_short", "Tom")}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{song.key || '-'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-[#1A1A1C]/60 p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06]">
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t("library.bpm_short", "BPM")}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{song.bpm || '-'}</p>
                </div>
                <div className="bg-slate-50 dark:bg-[#1A1A1C]/60 p-4 rounded-2xl border border-black/[0.04] dark:border-white/[0.06] col-span-2 lg:col-span-1">
                  <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">{t("library.imports", "Importações")}</p>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{song.importCount || 0}</p>
                </div>
              </div>

              {/* Lyrics Preview */}
              {song.lyrics && (
                <div>
                  <div className="flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-200">
                    <FileText className="w-4 h-4" />
                    <h3 className="font-bold">{t("library.lyrics_preview_header", "Trecho da Letra")}</h3>
                  </div>
                  <div className="bg-slate-50 dark:bg-white-[0.02] dark:bg-[#1A1A1C]/40 p-5 rounded-2xl border border-black/[0.04] dark:border-white/[0.04] font-sans text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-h-48 overflow-hidden relative">
                    <div className="whitespace-pre-wrap">{song.lyrics}</div>
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 dark:from-[#151515] to-transparent pointer-events-none"></div>
                  </div>
                </div>
              )}

              {/* Chords Preview */}
              {song.chords && (
                <div>
                  <div className="flex items-center gap-2 mb-3 text-slate-800 dark:text-slate-200">
                    <Music className="w-4 h-4" />
                    <h3 className="font-bold">{t("library.chords_preview_header", "Trecho da Cifra")}</h3>
                  </div>
                  <div className="bg-slate-50 dark:bg-white-[0.02] dark:bg-[#1A1A1C]/40 p-5 rounded-2xl border border-black/[0.04] dark:border-white/[0.04] font-mono text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-h-48 overflow-hidden relative">
                    <div className="whitespace-pre-wrap">{song.chords}</div>
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 dark:from-[#151515] to-transparent pointer-events-none"></div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer / Actions */}
            <div className="flex-none p-6 border-t border-black/[0.04] dark:border-white/[0.06] bg-white dark:bg-[#111111]">
              {isImported ? (
                <div className="flex flex-col gap-3">
                  <div className="bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 p-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm">
                    <Check className="w-5 h-5" />
                    {t("library.already_in_repertoire_indicator", "No repertório da sua igreja")}
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/songs');
                    }}
                    className="w-full h-12 flex items-center justify-center gap-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors active:scale-95 text-sm"
                  >
                    <LayoutList className="w-4 h-4" />
                    {t("library.open_repertoire", "Abrir Repertório")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onImport(song)}
                  disabled={isImporting}
                  className="relative w-full h-14 flex items-center justify-center bg-black dark:bg-white text-white dark:text-black hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white dark:hover:text-white font-bold rounded-2xl transition-all duration-300 shadow-xl shadow-black/10 dark:shadow-white/5 active:scale-95 text-base overflow-hidden"
                >
                  <span className={`inline-flex items-center gap-2 transition-transform duration-300 ${isImporting ? '-translate-y-8 opacity-0' : 'translate-y-0 opacity-100'}`}>
                    <Download className="w-5 h-5" />
                    <span>{t("library.add_to_repertoire_action", "Adicionar ao repertório")}</span>
                  </span>
                  <span className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${isImporting ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
