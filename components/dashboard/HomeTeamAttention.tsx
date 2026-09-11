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

const DISMISSED_STORAGE_PREFIX = 'musicscale:home-team-attention-dismissed:v2';
const MAX_DISMISSED_KEYS = 200;

const dismissCopy = {
  pt: {
    dismissAll: 'Excluir todas',
    dismissAllHint: 'Remove apenas estas pendências do Painel. Nenhuma escala será excluída.',
    dismissOne: 'Excluir pendência',
    dismissOneHint: 'Remove apenas esta pendência do Painel. A escala continua intacta.',
  },
  en: {
    dismissAll: 'Dismiss all',
    dismissAllHint: 'Removes only these items from the dashboard. No schedule will be deleted.',
    dismissOne: 'Dismiss item',
    dismissOneHint: 'Removes only this item from the dashboard. The schedule remains intact.',
  },
  es: {
    dismissAll: 'Eliminar todas',
    dismissAllHint: 'Solo elimina estas pendientes del panel. No se eliminará ninguna escala.',
    dismissOne: 'Eliminar pendiente',
    dismissOneHint: 'Solo elimina esta pendiente del panel. La escala permanece intacta.',
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
      return t(
        'dashboard.teamAttention.items.draft',
        'Rascunho para concluir'
      );
    case 'missing-repertoire':
      return t(
        'dashboard.teamAttention.items.missingRepertoire',
        'Repertório não definido'
      );
    case 'missing-team':
      return t(
        'dashboard.teamAttention.items.missingTeam',
        'Equipe ainda não montada'
      );
    case 'missing-time':
      return t(
        'dashboard.teamAttention.items.missingTime',
        'Horário não definido'
      );
    case 'missing-location':
      return t(
        'dashboard.teamAttention.items.missingLocation',
        'Local não definido'
      );
    default:
      return t(
        'dashboard.teamAttention.items.generic',
        'Requer atenção'
      );
  }
}

export const HomeTeamAttention: React.FC<HomeTeamAttentionProps> = ({
  entries,
  onResolve,
  onOpenAll,
}) => {
  const { t, i18n } = useTranslation();
  const { organization, user } = useAuth();
  const language = (i18n.resolvedLanguage || i18n.language || 'pt')
    .split('-')[0] as keyof typeof dismissCopy;
  const copy = dismissCopy[language] || dismissCopy.pt;
  const storageKey = React.useMemo(
    () => `${DISMISSED_STORAGE_PREFIX}:${organization?.id || 'no-org'}:${user?.uid || 'anonymous'}`,
    [organization?.id, user?.uid]
  );
  const [dismissedKeys, setDismissedKeys] = React.useState<string[]>([]);

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
        window.localStorage.setItem(
          storageKey,
          JSON.stringify(normalized)
        );
      } catch {
        // A preferência continua válida durante a sessão mesmo se o storage estiver indisponível.
      }
    }
  }, [storageKey]);

  const dismissEntry = React.useCallback(
    (entry: TeamAttentionEntry) => {
      persistDismissedKeys([
        ...dismissedKeys,
        getTeamAttentionDismissKey(entry),
      ]);
    },
    [dismissedKeys, persistDismissedKeys]
  );

  const dismissAllVisible = React.useCallback(() => {
    persistDismissedKeys([
      ...dismissedKeys,
      ...visibleEntries.map(getTeamAttentionDismissKey),
    ]);
  }, [dismissedKeys, persistDismissedKeys, visibleEntries]);

  if (!visibleEntries.length) return null;

  return (
    <section
      aria-labelledby="team-attention-title"
      className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/[0.07] dark:bg-slate-950/55"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 dark:border-white/[0.06] sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-300">
            <UsersRound className="h-4 w-4" />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
              {t(
                'dashboard.teamAttention.eyebrow',
                'Liderança'
              )}
            </span>
          </div>
          <h2
            id="team-attention-title"
            className="text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl"
          >
            {t(
              'dashboard.teamAttention.title',
              'Atenção da equipe'
            )}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {t(
              'dashboard.teamAttention.subtitle',
              'Só o que realmente precisa de você nos próximos eventos.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={dismissAllVisible}
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
              {t(
                'dashboard.teamAttention.viewAll',
                'Ver escalas'
              )}
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
        {visibleEntries.map((entry) => {
          const { event, attentionItems, primaryAttention } = entry;

          return (
            <article
              key={event.id}
              className="px-5 py-4 sm:px-6"
            >
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
                        {t(
                          'dashboard.teamAttention.moreIssues',
                          { count: attentionItems.length - 1 }
                        )}
                      </span>
                    )}
                  </div>

                  <h3 className="truncate text-base font-bold text-slate-950 dark:text-white sm:text-lg">
                    {event.title ||
                      t(
                        'dashboard.focus.untitledEvent',
                        'Evento sem título'
                      )}
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
                        <span className="truncate">
                          {event.locationName}
                        </span>
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
                      {t(
                        'dashboard.teamAttention.resolve',
                        'Resolver'
                      )}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => dismissEntry(entry)}
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
  );
};
