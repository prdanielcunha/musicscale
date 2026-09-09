import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  MapPin,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import type { HomeEventSummary } from '../../utils/homeExperience';
import type {
  EventPreparationView,
} from '../../utils/preparationIntelligence';
import { describePreparationChange } from '../../utils/preparationPresentation';

interface HomePreparationWeekProps {
  views: EventPreparationView[];
  busyScaleId?: string | null;
  onPrepareEvent: (event: HomeEventSummary) => void;
  onReviewChanges: (event: HomeEventSummary) => void | Promise<void>;
  onMarkPrepared: (event: HomeEventSummary) => void | Promise<void>;
}

function formatRelativeDay(
  dateKey: string,
  locale: string,
  t: (key: string, options?: any) => string
): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(`${dateKey}T12:00:00`);
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((targetDay.getTime() - today.getTime()) / 86_400_000);

  if (diff === 0) return t('dashboard.preparation.today');
  if (diff === 1) return t('dashboard.preparation.tomorrow');
  if (diff > 1 && diff <= 7) {
    return t('dashboard.preparation.inDays', { count: diff });
  }

  const weekday = target.toLocaleDateString(locale, { weekday: 'short' });
  const dayMonth = target.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  return `${weekday} · ${dayMonth}`;
}

export const HomePreparationWeek: React.FC<HomePreparationWeekProps> = ({
  views,
  busyScaleId,
  onPrepareEvent,
  onReviewChanges,
  onMarkPrepared,
}) => {
  const { t, i18n } = useTranslation();

  if (!views.length) return null;

  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';

  return (
    <section
      aria-labelledby="preparation-week-title"
      className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/90 shadow-sm dark:border-white/[0.07] dark:bg-slate-950/55"
    >
      <div className="border-b border-slate-100 px-5 py-5 dark:border-white/[0.06] sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <CalendarDays className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                {t('dashboard.preparation.eyebrow')}
              </span>
            </div>
            <h2
              id="preparation-week-title"
              className="text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl"
            >
              {t('dashboard.preparation.title')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {t('dashboard.preparation.subtitle')}
            </p>
          </div>

          <div className="self-start rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-white/[0.07] dark:bg-white/[0.035] dark:text-slate-300 sm:self-auto">
            {t('dashboard.preparation.commitmentCount', { count: views.length })}
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
        {views.map(({ event, status, changes }) => {
          const busy = busyScaleId === event.id;
          const isMusic = event.type === 'music' && event.songCount > 0;
          const role = event.userFunctionNames.join(', ');
          const visibleSongs = (event.songs || []).slice(0, 3);
          const hasChanges = changes.length > 0;

          return (
            <article key={event.id} className="px-5 py-5 sm:px-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
                      {formatRelativeDay(event.date, locale, t)}
                    </span>
                    {event.time && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <Clock3 className="h-3 w-3" />
                        {event.time}
                      </span>
                    )}
                    {status === 'prepared' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <Check className="h-3 w-3" />
                        {t('dashboard.preparation.statusPrepared')}
                      </span>
                    ) : status === 'needs-review' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        <RefreshCcw className="h-3 w-3" />
                        {t('dashboard.preparation.statusNeedsReview')}
                      </span>
                    ) : (
                      <span className="rounded-full border border-blue-500/15 bg-blue-500/[0.06] px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                        {t('dashboard.preparation.statusPreparing')}
                      </span>
                    )}
                  </div>

                  <h3 className="truncate text-lg font-bold text-slate-950 dark:text-white">
                    {event.title || t('dashboard.focus.untitledEvent')}
                  </h3>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {role && (
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {role}
                      </span>
                    )}
                    {event.locationName && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{event.locationName}</span>
                      </span>
                    )}
                    {isMusic && (
                      <span>
                        {t('dashboard.preparation.songCount', { count: event.songCount })}
                      </span>
                    )}
                  </div>

                  {isMusic && visibleSongs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {visibleSongs.map(song => (
                        <span
                          key={song.id}
                          className="max-w-full truncate rounded-lg border border-slate-200/70 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-300"
                        >
                          {song.title}
                        </span>
                      ))}
                      {event.songCount > visibleSongs.length && (
                        <span className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-400">
                          +{event.songCount - visibleSongs.length}
                        </span>
                      )}
                    </div>
                  )}

                  {hasChanges && (
                    <div className="mt-4 rounded-2xl border border-amber-500/15 bg-amber-500/[0.055] p-3.5">
                      <div className="mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                          {t('dashboard.preparation.changesTitle', { count: changes.length })}
                        </p>
                      </div>
                      <ul className="space-y-1.5">
                        {changes.slice(0, 3).map((change, index) => (
                          <li
                            key={`${change.code}-${change.entityId || index}`}
                            className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/75"
                          >
                            {describePreparationChange(change, t)}
                          </li>
                        ))}
                      </ul>
                      {changes.length > 3 && (
                        <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          {t('dashboard.preparation.moreChanges', {
                            count: changes.length - 3,
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:w-[245px] lg:flex-col">
                  {hasChanges ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onReviewChanges(event)}
                      className="min-h-[44px] w-full rounded-xl bg-amber-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-amber-400 active:scale-[0.985] disabled:cursor-wait disabled:opacity-50"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <RefreshCcw className="h-4 w-4" />
                        {t('dashboard.preparation.reviewChanges')}
                      </span>
                    </button>
                  ) : isMusic ? (
                    <button
                      type="button"
                      onClick={() => onPrepareEvent(event)}
                      className="min-h-[44px] w-full rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.985]"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <BookOpenCheck className="h-4 w-4" />
                        {status === 'prepared'
                          ? t('dashboard.preparation.reviewRepertoire')
                          : t('dashboard.preparation.startPreparation')}
                      </span>
                    </button>
                  ) : null}

                  {status !== 'prepared' && isMusic && (
                    <button
                      type="button"
                      disabled={busy || hasChanges}
                      onClick={() => void onMarkPrepared(event)}
                      className="min-h-[40px] w-full rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 text-xs font-bold text-emerald-700 transition hover:bg-emerald-500/[0.1] disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-300"
                    >
                      {t('dashboard.preparation.markPrepared')}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onPrepareEvent(event)}
                    className="min-h-[38px] w-full rounded-xl px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {t('dashboard.preparation.open')}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
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
