import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  MapPin,
  UsersRound,
} from 'lucide-react';
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
  const { t } = useTranslation();

  if (!entries.length) return null;

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

        <button
          type="button"
          onClick={onOpenAll}
          className="self-start rounded-full px-3 py-1.5 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white sm:self-auto"
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

      <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
        {entries.map(({ event, attentionItems, primaryAttention }) => (
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

              <button
                type="button"
                onClick={() =>
                  onResolve(event, primaryAttention)
                }
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
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
