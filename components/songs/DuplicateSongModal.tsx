import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Copy, Edit2, FileMusic, PlusCircle, RefreshCw } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';

export interface DuplicateMatch {
  song: any;
  score: number;
  matchType: 'exact' | 'probable' | 'possible';
  location: 'repertoire' | 'global_library';
}

interface DuplicateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateSong: any;
  matches: DuplicateMatch[];
  onSaveAnyway: () => void;
  onEditExisting?: (song: any) => void;
  onReplaceExisting?: (song: any) => void;
  isLoading?: boolean;
}

export const DuplicateSongModal: React.FC<DuplicateSongModalProps> = ({
  isOpen,
  onClose,
  candidateSong,
  matches,
  onSaveAnyway,
  onEditExisting,
  onReplaceExisting,
  isLoading
}) => {
  const { t } = useTranslation();
  const [replacementTarget, setReplacementTarget] = useState<DuplicateMatch | null>(null);

  useEffect(() => {
    if (!isOpen) setReplacementTarget(null);
  }, [isOpen]);

  useEffect(() => {
    setReplacementTarget(null);
  }, [candidateSong?.title, candidateSong?.artist]);

  if (!candidateSong) return null;

  if (replacementTarget) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => setReplacementTarget(null)}
        title={t('songDuplicate.replaceTitle')}
        maxWidth="max-w-xl"
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.08] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {replacementTarget.song.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  {replacementTarget.song.artist || candidateSong.artist || '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-zinc-300">
            <p>{t('songDuplicate.replaceDescription')}</p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-white/[0.08] dark:bg-white/[0.035]">
              <p className="font-semibold text-slate-900 dark:text-white">
                {t('songDuplicate.preserveLinks')}
              </p>
              <p className="mt-2">{t('songDuplicate.replaceContent')}</p>
            </div>
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              {t('songDuplicate.irreversible')}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end dark:border-white/[0.08]">
            <Button
              variant="outline"
              onClick={() => setReplacementTarget(null)}
              disabled={isLoading}
            >
              {t('songDuplicate.back')}
            </Button>
            <Button
              onClick={() => onReplaceExisting?.(replacementTarget.song)}
              isLoading={isLoading}
              className="bg-amber-600 text-white hover:bg-amber-500"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('songDuplicate.confirmReplace')}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('songDuplicate.title')}
      maxWidth="max-w-2xl"
    >
      <div className="p-1 mb-2">
        <p className="mb-4 text-sm text-slate-500 dark:text-zinc-400">
          {t('songDuplicate.description')}
        </p>

        <div className="mb-6 rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.06] p-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-500">
            {t('songDuplicate.candidateLabel')}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-900 dark:text-white">{candidateSong.title}</p>
              <p className="truncate text-sm text-slate-500 dark:text-zinc-400">{candidateSong.artist || '—'}</p>
            </div>
          </div>
        </div>

        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          {t('songDuplicate.existingLabel')}
        </p>

        <div className="mb-6 max-h-[42vh] space-y-3 overflow-y-auto pr-1">
          {matches.map((match, idx) => (
            <div
              key={match.song?.id || idx}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.025]"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-zinc-400">
                    <FileMusic className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900 dark:text-white">{match.song.title}</p>
                    <p className="mb-2 truncate text-sm text-slate-500 dark:text-zinc-400">{match.song.artist || '—'}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-white/[0.06] dark:text-zinc-400">
                        {match.song.key || '-'}
                      </span>
                      <span className={
                        "rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                        (match.matchType === 'exact'
                          ? 'bg-red-500/10 text-red-500'
                          : match.matchType === 'probable'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'bg-slate-500/10 text-slate-500')
                      }>
                        {t(`songDuplicate.${match.matchType}`)}
                      </span>
                      <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                        {match.location === 'repertoire'
                          ? t('songDuplicate.repertoire')
                          : t('songDuplicate.globalLibrary')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {onEditExisting && match.location === 'repertoire' && (
                    <Button
                      variant="outline"
                      onClick={() => onEditExisting(match.song)}
                      className="h-9 px-3 text-xs"
                      disabled={isLoading}
                    >
                      <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                      {t('songDuplicate.editExisting')}
                    </Button>
                  )}
                  {onReplaceExisting && match.location === 'repertoire' && (
                    <Button
                      variant="outline"
                      onClick={() => setReplacementTarget(match)}
                      className="h-9 px-3 text-xs text-amber-700 hover:text-amber-700 dark:text-amber-400"
                      disabled={isLoading}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      {t('songDuplicate.replaceExisting')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row dark:border-white/[0.08]">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('songDuplicate.cancel')}
          </Button>
          <Button
            className="flex-1 bg-indigo-600 text-white hover:bg-indigo-500"
            onClick={onSaveAnyway}
            isLoading={isLoading}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t('songDuplicate.duplicateAsNew')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
