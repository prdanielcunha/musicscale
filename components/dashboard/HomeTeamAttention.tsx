import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  MapPin,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../contexts/ApiContext';
import { useMusic } from '../../contexts/MusicDataContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../common/Modal';
import type {
  HomeAttentionItem,
  HomeEventSummary,
} from '../../utils/homeExperience';
import type { TeamAttentionEntry } from '../../utils/teamAttention';

interface HomeTeamAttentionProps {
  entries: TeamAttentionEntry[];
  onResolve: (
    event: HomeEventSummary,
    attention: HomeAttentionItem
  ) => void;
  onOpenAll: () => void;
}

type PendingRemoval =
  | { mode: 'single'; entries: TeamAttentionEntry[] }
  | { mode: 'all'; entries: TeamAttentionEntry[] };

const DISMISSED_STORAGE_PREFIX = 'musicscale:home-team-attention-dismissed:v2';
const MAX_DISMISSED_KEYS = 200;

const dismissCopy = {
  pt: {
    dismissAll: 'Excluir todas',
    dismissAllHint: 'Escolha se deseja remover só os avisos ou também as escalas relacionadas.',
    dismissOne: 'Excluir',
    dismissOneHint: 'Escolha se deseja remover só este aviso ou também a escala relacionada.',
    dialogTitle: 'O que você deseja excluir?',
    singleDescription: 'Você pode apenas remover este aviso do Painel ou excluir também a escala/rascunho relacionada.',
    allDescription: (count: number) => `Você pode apenas remover estes ${count} avisos do Painel ou excluir também as escalas/rascunhos relacionados.`,
    noticeTitle: 'Excluir somente o aviso',
    noticeDescription: 'O aviso some do Painel, mas a escala continua existindo normalmente.',
    scheduleTitle: 'Excluir escala/rascunho também',
    schedulesTitle: 'Excluir escalas/rascunhos também',
    scheduleDescription: 'Apaga de verdade a escala relacionada e, quando houver, sua escala de banda vinculada.',
    schedulesDescription: 'Apaga de verdade as escalas relacionadas e, quando houver, suas escalas de banda vinculadas.',
    publishedWarning: 'Atenção: há item já publicado nesta seleção. A opção vermelha também excluirá esse conteúdo publicado.',
    permanentWarning: 'A exclusão da escala é permanente e não pode ser desfeita.',
    cancel: 'Cancelar',
    deleting: 'Excluindo...',
    deletedOne: 'Escala excluída com sucesso.',
    deletedMany: (count: number) => `${count} escalas/rascunhos foram excluídos com sucesso.`,
    deleteError: 'Não foi possível excluir a escala agora. Os dados foram atualizados para evitar inconsistências.',
  },
  en: {
    dismissAll: 'Delete all',
    dismissAllHint: 'Choose whether to remove only the notices or also the related schedules.',
    dismissOne: 'Delete',
    dismissOneHint: 'Choose whether to remove only this notice or also the related schedule.',
    dialogTitle: 'What do you want to delete?',
    singleDescription: 'You can remove only this dashboard notice or also permanently delete the related schedule/draft.',
    allDescription: (count: number) => `You can remove only these ${count} dashboard notices or also permanently delete the related schedules/drafts.`,
    noticeTitle: 'Delete notice only',
    noticeDescription: 'The notice disappears from the dashboard, but the schedule remains intact.',
    scheduleTitle: 'Delete schedule/draft too',
    schedulesTitle: 'Delete schedules/drafts too',
    scheduleDescription: 'Permanently deletes the related schedule and its linked band schedule when present.',
    schedulesDescription: 'Permanently deletes the related schedules and their linked band schedules when present.',
    publishedWarning: 'Warning: this selection includes a published item. The red option will delete that published content too.',
    permanentWarning: 'Schedule deletion is permanent and cannot be undone.',
    cancel: 'Cancel',
    deleting: 'Deleting...',
    deletedOne: 'Schedule deleted successfully.',
    deletedMany: (count: number) => `${count} schedules/drafts were deleted successfully.`,
    deleteError: 'The schedule could not be deleted right now. Data was refreshed to avoid inconsistencies.',
  },
  es: {
    dismissAll: 'Eliminar todas',
    dismissAllHint: 'Elige si deseas quitar solo los avisos o también las escalas relacionadas.',
    dismissOne: 'Eliminar',
    dismissOneHint: 'Elige si deseas quitar solo este aviso o también la escala relacionada.',
    dialogTitle: '¿Qué deseas eliminar?',
    singleDescription: 'Puedes quitar solo este aviso del Panel o eliminar también la escala/borrador relacionada.',
    allDescription: (count: number) => `Puedes quitar solo estos ${count} avisos del Panel o eliminar también las escalas/borradores relacionados.`,
    noticeTitle: 'Eliminar solo el aviso',
    noticeDescription: 'El aviso desaparece del Panel, pero la escala sigue existiendo normalmente.',
    scheduleTitle: 'Eliminar también la escala/borrador',
    schedulesTitle: 'Eliminar también las escalas/borradores',
    scheduleDescription: 'Elimina de forma permanente la escala relacionada y su escala de banda vinculada cuando exista.',
    schedulesDescription: 'Elimina de forma permanente las escalas relacionadas y sus escalas de banda vinculadas cuando existan.',
    publishedWarning: 'Atención: hay un elemento ya publicado en esta selección. La opción roja también eliminará ese contenido publicado.',
    permanentWarning: 'La eliminación de la escala es permanente y no se puede deshacer.',
    cancel: 'Cancelar',
    deleting: 'Eliminando...',
    deletedOne: 'Escala eliminada correctamente.',
    deletedMany: (count: number) => `${count} escalas/borradores fueron eliminados correctamente.`,
    deleteError: 'No fue posible eliminar la escala ahora. Los datos se actualizaron para evitar inconsistencias.',
  },
} as const;

export function getTeamAttentionDismissKey(entry: TeamAttentionEntry): string {
  const codes = entry.attentionItems
    .map((item) => item.code)
    .sort()
    .join('|');

  return [
    entry.event.id,
    entry.event.date || '',
    entry.event.time || '',
    codes,
  ].join(':');
}

function readDismissedAttentionKeys(storageKey: string): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function attentionLabel(
  attention: HomeAttentionItem,
  t: (key: string, options?: any) => string
): string {
  switch (attention.code) {
    case 'draft':
      return t('dashboard.teamAttention.items.draft', 'Rascunho para concluir');
    case 'missing-repertoire':
      return t('dashboard.teamAttention.items.missingRepertoire', 'Repertório não definido');
    case 'missing-team':
      return t('dashboard.teamAttention.items.missingTeam', 'Equipe ainda não montada');
    case 'missing-time':
      return t('dashboard.teamAttention.items.missingTime', 'Horário não definido');
    case 'missing-location':
      return t('dashboard.teamAttention.items.missingLocation', 'Local não definido');
    default:
      return t('dashboard.teamAttention.items.generic', 'Requer atenção');
  }
}

export const HomeTeamAttention: React.FC<HomeTeamAttentionProps> = ({
  entries,
  onResolve,
  onOpenAll,
}) => {
  const { t, i18n } = useTranslation();
  const { organization, user } = useAuth();
  const api = useApi();
  const {
    populatedScales,
    populatedBandScales,
    refreshData,
  } = useMusic();
  const { toast } = useToast();

  const language = (i18n.resolvedLanguage || i18n.language || 'pt')
    .split('-')[0] as keyof typeof dismissCopy;
  const copy = dismissCopy[language] || dismissCopy.pt;
  const storageKey = React.useMemo(
    () => `${DISMISSED_STORAGE_PREFIX}:${organization?.id || 'no-org'}:${user?.uid || 'anonymous'}`,
    [organization?.id, user?.uid]
  );

  const [dismissedKeys, setDismissedKeys] = React.useState<string[]>([]);
  const [pendingRemoval, setPendingRemoval] = React.useState<PendingRemoval | null>(null);
  const [isDeletingSchedules, setIsDeletingSchedules] = React.useState(false);

  React.useEffect(() => {
    setDismissedKeys(readDismissedAttentionKeys(storageKey));
  }, [storageKey]);

  const dismissedSet = React.useMemo(
    () => new Set(dismissedKeys),
    [dismissedKeys]
  );

  const visibleEntries = React.useMemo(
    () => entries.filter((entry) => !dismissedSet.has(getTeamAttentionDismissKey(entry))),
    [dismissedSet, entries]
  );

  const persistDismissedKeys = React.useCallback((nextKeys: string[]) => {
    const normalized = Array.from(new Set(nextKeys)).slice(-MAX_DISMISSED_KEYS);
    setDismissedKeys(normalized);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(normalized));
      } catch {
        // Keep the preference for the current session if storage is unavailable.
      }
    }
  }, [storageKey]);

  const dismissEntries = React.useCallback((targetEntries: TeamAttentionEntry[]) => {
    persistDismissedKeys([
      ...dismissedKeys,
      ...targetEntries.map(getTeamAttentionDismissKey),
    ]);
  }, [dismissedKeys, persistDismissedKeys]);

  const openSingleRemoval = React.useCallback((entry: TeamAttentionEntry) => {
    setPendingRemoval({ mode: 'single', entries: [entry] });
  }, []);

  const openAllRemoval = React.useCallback(() => {
    setPendingRemoval({ mode: 'all', entries: visibleEntries });
  }, [visibleEntries]);

  const closeRemoval = React.useCallback(() => {
    if (isDeletingSchedules) return;
    setPendingRemoval(null);
  }, [isDeletingSchedules]);

  const handleNoticeOnly = React.useCallback(() => {
    if (!pendingRemoval) return;
    dismissEntries(pendingRemoval.entries);
    setPendingRemoval(null);
  }, [dismissEntries, pendingRemoval]);

  const deleteUnderlyingSchedules = React.useCallback(async () => {
    if (!pendingRemoval || !api) return;

    setIsDeletingSchedules(true);
    const musicIds = new Set<string>();
    const bandIds = new Set<string>();

    pendingRemoval.entries.forEach(({ event }) => {
      if (event.type === 'music') {
        musicIds.add(event.id);
        const musicScale = populatedScales.find((scale) => scale.id === event.id) as any;
        const linkedBandId = musicScale?.bandScale?.id || musicScale?.bandScaleId;
        if (linkedBandId) bandIds.add(linkedBandId);
        return;
      }

      bandIds.add(event.id);
      const bandScale = populatedBandScales.find((scale) => scale.id === event.id) as any;
      if (bandScale?.musicScaleId) musicIds.add(bandScale.musicScaleId);
    });

    try {
      if (bandIds.size > 0) {
        await api.bandScales.deleteMany(Array.from(bandIds));
      }
      if (musicIds.size > 0) {
        await api.scales.deleteMany(Array.from(musicIds));
      }

      dismissEntries(pendingRemoval.entries);
      await refreshData();
      setPendingRemoval(null);

      const logicalCount = pendingRemoval.entries.length;
      toast({
        type: 'success',
        message: logicalCount === 1
          ? copy.deletedOne
          : copy.deletedMany(logicalCount),
      });
    } catch (error) {
      console.error('[HomeTeamAttention] Failed to delete underlying schedule(s):', error);
      await refreshData().catch(() => undefined);
      setPendingRemoval(null);
      toast({ type: 'error', message: copy.deleteError });
    } finally {
      setIsDeletingSchedules(false);
    }
  }, [
    api,
    copy,
    dismissEntries,
    pendingRemoval,
    populatedBandScales,
    populatedScales,
    refreshData,
    toast,
  ]);

  if (!visibleEntries.length && !pendingRemoval) return null;

  const pendingEntries = pendingRemoval?.entries || [];
  const isBulkRemoval = pendingRemoval?.mode === 'all';
  const hasPublishedItem = pendingEntries.some(
    (entry) => entry.event.status && entry.event.status !== 'draft'
  );

  return (
    <>
      {visibleEntries.length > 0 && (
        <section
          aria-labelledby="team-attention-title"
          className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/[0.07] dark:bg-slate-950/55"
        >
          <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 dark:border-white/[0.06] sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-300">
                <UsersRound className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                  {t('dashboard.teamAttention.eyebrow', 'Liderança')}
                </span>
              </div>
              <h2
                id="team-attention-title"
                className="text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl"
              >
                {t('dashboard.teamAttention.title', 'Atenção da equipe')}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {t('dashboard.teamAttention.subtitle', 'Só o que realmente precisa de você nos próximos eventos.')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={openAllRemoval}
                title={copy.dismissAllHint}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:bg-red-500/[0.06] hover:text-red-600 dark:hover:text-red-300"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  {copy.dismissAll}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenAll}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white"
              >
                <span className="inline-flex items-center gap-1">
                  {t('dashboard.teamAttention.viewAll', 'Ver escalas')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {visibleEntries.map((entry) => {
              const { event, attentionItems, primaryAttention } = entry;

              return (
                <article key={event.id} className="px-5 py-4 sm:px-6">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span
                          className={[
                            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold',
                            primaryAttention.severity === 'important'
                              ? 'border-red-500/15 bg-red-500/[0.06] text-red-700 dark:text-red-300'
                              : primaryAttention.severity === 'warning'
                                ? 'border-amber-500/15 bg-amber-500/[0.06] text-amber-700 dark:text-amber-300'
                                : 'border-blue-500/15 bg-blue-500/[0.05] text-blue-700 dark:text-blue-300',
                          ].join(' ')}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {attentionLabel(primaryAttention, t)}
                        </span>

                        {attentionItems.length > 1 && (
                          <span className="text-[10px] font-semibold text-slate-400">
                            {t('dashboard.teamAttention.moreIssues', { count: attentionItems.length - 1 })}
                          </span>
                        )}
                      </div>

                      <h3 className="truncate text-base font-bold text-slate-950 dark:text-white sm:text-lg">
                        {event.title || t('dashboard.focus.untitledEvent', 'Evento sem título')}
                      </h3>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span>{event.date}</span>
                        {event.time && (
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {event.time}
                          </span>
                        )}
                        {event.locationName && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{event.locationName}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex md:w-auto md:items-center">
                      <button
                        type="button"
                        onClick={() => onResolve(event, primaryAttention)}
                        className="min-h-[44px] w-full rounded-xl border border-amber-500/15 bg-amber-500/[0.07] px-4 text-sm font-bold text-amber-800 transition hover:bg-amber-500/[0.11] active:scale-[0.985] dark:text-amber-200 md:w-auto"
                      >
                        <span className="inline-flex items-center justify-center gap-1.5">
                          {t('dashboard.teamAttention.resolve', 'Resolver')}
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openSingleRemoval(entry)}
                        aria-label={copy.dismissOne}
                        title={copy.dismissOneHint}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200/80 text-slate-400 transition hover:border-red-500/20 hover:bg-red-500/[0.06] hover:text-red-600 active:scale-[0.985] dark:border-white/[0.08] dark:hover:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <Modal
        isOpen={Boolean(pendingRemoval)}
        onClose={closeRemoval}
        title={copy.dialogTitle}
        maxWidth="max-w-md"
      >
        {pendingRemoval && (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {isBulkRemoval
                ? copy.allDescription(pendingEntries.length)
                : copy.singleDescription}
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleNoticeOnly}
                disabled={isDeletingSchedules}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
              >
                <span className="block text-sm font-bold text-slate-900 dark:text-white">
                  {copy.noticeTitle}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {copy.noticeDescription}
                </span>
              </button>

              <button
                type="button"
                onClick={deleteUnderlyingSchedules}
                disabled={isDeletingSchedules || !api}
                className="w-full rounded-2xl border border-red-500/20 bg-red-500/[0.07] px-4 py-4 text-left transition hover:bg-red-500/[0.11] disabled:opacity-50"
              >
                <span className="block text-sm font-bold text-red-700 dark:text-red-300">
                  {isDeletingSchedules
                    ? copy.deleting
                    : isBulkRemoval
                      ? copy.schedulesTitle
                      : copy.scheduleTitle}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-red-700/75 dark:text-red-200/75">
                  {isBulkRemoval ? copy.schedulesDescription : copy.scheduleDescription}
                </span>
              </button>
            </div>

            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
              <p>{copy.permanentWarning}</p>
              {hasPublishedItem && <p className="mt-1 font-semibold">{copy.publishedWarning}</p>}
            </div>

            <button
              type="button"
              onClick={closeRemoval}
              disabled={isDeletingSchedules}
              className="min-h-[44px] w-full rounded-xl text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white"
            >
              {copy.cancel}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
};
