import { useTranslation } from 'react-i18next';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
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
      className: 'border-emerald-400/[0.16] bg-emerald-500/[0.065] text-emerald-300',
    };
  }
  if (hasChords) {
    return {
      label: t('library.chords', 'Cifra'),
      className: 'border-primary/20 bg-primary/[0.07] text-primary-light',
    };
  }
  if (hasLyrics) {
    return {
      label: t('library.lyrics', 'Letra'),
      className: 'border-amber-400/[0.17] bg-amber-500/[0.06] text-amber-200',
    };
  }
  return {
    label: t('library.basic_badge', 'Básica'),
    className: 'border-white/[0.07] bg-white/[0.03] text-white/42',
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
  const shouldReduceMotion = useReducedMotion();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

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
  const enterState = shouldReduceMotion
    ? false
    : isDesktop
      ? { opacity: 0, x: 48, y: 0 }
      : { opacity: 0, x: 0, y: 48 };
  const exitState = shouldReduceMotion
    ? { opacity: 0 }
    : isDesktop
      ? { opacity: 0, x: 48, y: 0 }
      : { opacity: 0, x: 0, y: 48 };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 md:backdrop-blur-sm"
          />

          <motion.aside
            initial={enterState}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={exitState}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 320, mass: 0.8 }}
            className="fixed inset-x-0 bottom-0 z-[110] flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[24px] border border-b-0 border-white/[0.07] bg-[#0d0f14] shadow-[0_-24px_70px_-36px_rgba(0,0,0,0.9)] md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[448px] md:max-w-[min(448px,100vw)] md:rounded-none md:border-b-0 md:border-l md:border-r-0 md:border-t-0 md:shadow-[-28px_0_72px_-42px_rgba(0,0,0,0.95)]"
          >
            <div className="flex justify-center pb-1 pt-2 md:hidden" aria-hidden="true">
              <span className="h-1 w-10 rounded-full bg-white/15" />
            </div>

            <div className="relative flex-none border-b border-white/[0.055] px-5 pb-4 pt-3 sm:px-6 sm:pb-5 md:pt-6">
              <div className="pointer-events-none absolute inset-x-10 top-0 hidden h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent md:block" />
              <div className="pr-12">
                <span className={`mb-3 inline-flex w-fit rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${status.className}`}>
                  {status.label}
                </span>
                <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.035em] text-white sm:text-[24px]">
                  {song.title}
                </h2>
                <p className="mt-1 text-[13px] font-medium text-white/42 sm:text-sm">
                  {song.artist}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="premium-interactive absolute right-4 top-3 flex h-10 w-10 items-center justify-center rounded-[12px] border border-white/[0.065] bg-white/[0.03] text-white/42 hover:bg-white/[0.06] hover:text-white md:right-5 md:top-5"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid grid-cols-3 overflow-hidden rounded-[15px] border border-white/[0.055] bg-black/[0.09]">
                <div className="px-3 py-3.5">
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/26">{t('library.key_short', 'Tom')}</p>
                  <p className="mt-1 text-[16px] font-semibold text-primary-light">{song.key || '—'}</p>
                </div>
                <div className="border-l border-white/[0.055] px-3 py-3.5">
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/26">{t('library.bpm_short', 'BPM')}</p>
                  <p className="mt-1 text-[16px] font-semibold tabular-nums text-white/78">{song.bpm || '—'}</p>
                </div>
                <div className="border-l border-white/[0.055] px-3 py-3.5">
                  <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/26">{t('library.imports', 'Importações')}</p>
                  <p className="mt-1 text-[16px] font-semibold tabular-nums text-white/78">{song.importCount || 0}</p>
                </div>
              </div>

              <div className="mt-7 space-y-7">
                {song.lyrics && (
                  <section>
                    <div className="mb-3 flex items-center gap-2 text-white/72">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.06] bg-white/[0.03] text-primary-light/80">
                        <FileText className="h-3.5 w-3.5" />
                      </span>
                      <h3 className="text-[12px] font-semibold">{t('library.lyrics_preview_header', 'Trecho da Letra')}</h3>
                    </div>
                    <div className="relative max-h-52 overflow-hidden rounded-[16px] border border-white/[0.055] bg-white/[0.022] p-4 text-[12px] leading-relaxed text-white/48 sm:p-5 sm:text-[13px]">
                      <div className="whitespace-pre-wrap">{song.lyrics}</div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0f1117] to-transparent" />
                    </div>
                  </section>
                )}

                {song.chords && (
                  <section>
                    <div className="mb-3 flex items-center gap-2 text-white/72">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/[0.06] bg-white/[0.03] text-primary-light/80">
                        <Music className="h-3.5 w-3.5" />
                      </span>
                      <h3 className="text-[12px] font-semibold">{t('library.chords_preview_header', 'Trecho da Cifra')}</h3>
                    </div>
                    <div className="relative max-h-52 overflow-hidden rounded-[16px] border border-white/[0.055] bg-white/[0.022] p-4 font-mono text-[11px] leading-relaxed text-white/48 sm:p-5 sm:text-xs">
                      <div className="whitespace-pre-wrap">{song.chords}</div>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0f1117] to-transparent" />
                    </div>
                  </section>
                )}
              </div>
            </div>

            <div className="flex-none border-t border-white/[0.055] bg-[#0d0f14]/96 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 md:p-6">
              {isImported ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex min-h-[44px] items-center justify-center gap-2 rounded-[13px] border border-emerald-400/[0.15] bg-emerald-500/[0.065] px-4 text-[12px] font-semibold text-emerald-300">
                    <Check className="h-4 w-4" />
                    {t('library.already_in_repertoire_indicator', 'No repertório da sua igreja')}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/songs');
                    }}
                    className="premium-interactive flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[13px] border border-white/[0.075] bg-white/[0.035] px-4 text-[12px] font-semibold text-white/72 hover:bg-white/[0.06] hover:text-white"
                  >
                    <LayoutList className="h-4 w-4" />
                    {t('library.open_repertoire', 'Abrir Repertório')}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onImport(song)}
                  disabled={isImporting}
                  className="premium-interactive relative flex min-h-[50px] w-full items-center justify-center overflow-hidden rounded-[14px] border border-white/[0.12] bg-white px-5 text-[13px] font-semibold text-[#0b0d12] shadow-[0_14px_36px_-24px_rgba(255,255,255,0.75)] disabled:cursor-wait disabled:opacity-70"
                >
                  <span className={`inline-flex items-center gap-2 transition-[transform,opacity] duration-200 motion-reduce:transition-none ${isImporting ? '-translate-y-6 opacity-0' : 'translate-y-0 opacity-100'}`}>
                    <Download className="h-4 w-4" />
                    <span>{t('library.add_to_repertoire_action', 'Adicionar ao repertório')}</span>
                  </span>
                  <span className={`absolute inset-0 flex items-center justify-center transition-[transform,opacity] duration-200 motion-reduce:transition-none ${isImporting ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
                    <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                  </span>
                </button>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
