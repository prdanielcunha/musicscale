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
  Target,
} from 'lucide-react';
import type { HomeEventSummary } from '../../utils/homeExperience';
import {
  requiresRepertoirePreparation,
  type EventPreparationView,
} from '../../utils/preparationIntelligence';
import { describePreparationChange } from '../../utils/preparationPresentation';
import type { PersonalPracticeSummary } from '../songs/personalPractice';

interface HomePreparationWeekProps {
  views: EventPreparationView[];
  practiceByEventId?: ReadonlyMap<string, PersonalPracticeSummary>;
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
  if (diff > 1 && diff <= 7) return t('dashboard.preparation.inDays', { count: diff });

  const weekday = target.toLocaleDateString(locale, { weekday: 'short' });
  const dayMonth = target.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
  return `${weekday} · ${dayMonth}`;
}

export const HomePreparationWeek: React.FC<HomePreparationWeekProps> = ({
  views,
  practiceByEventId,
  busyScaleId,
  onPrepareEvent,
  onReviewChanges,
  onMarkPrepared,
}) => {
  const { t, i18n } = useTranslation();

  if (!views.length) return null;

  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';
  const preparedCount = views.filter(view => view.status === 'prepared').length;
  const reviewCount = views.filter(view => view.status === 'needs-review').length;
  const readinessPercent = Math.round((preparedCount / views.length) * 100);

  return (
    <section aria-labelledby="preparation-week-title" className="ms-panel overflow-hidden">
      <div className="relative border-b border-white/[0.06] px-4 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-primary-light/85">
              <CalendarDays className="h-4 w-4" />
              <span className="ms-kicker">{t('dashboard.preparation.eyebrow')}</span>
            </div>
            <h2 id="preparation-week-title" className="text-[20px] font-semibold tracking-[-0.03em] text-white sm:text-[24px]">
              {t('dashboard.preparation.title')}
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-white/42 sm:text-sm">
              {t('dashboard.preparation.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 self-start lg:self-auto">
            <span className="rounded-full border border-white/[0.075] bg-white/[0.035] px-3 py-1.5 text-[10px] font-semibold text-white/55">
              {t('dashboard.preparation.commitmentCount', { count: views.length })}
            </span>
            {preparedCount > 0 && (
              <span className="rounded-full border border-emerald-400/[0.16] bg-emerald-500/[0.07] px-3 py-1.5 text-[10px] font-semibold text-emerald-300">
                {preparedCount} · {t('dashboard.preparation.statusPrepared')}
              </span>
            )}
            {reviewCount > 0 && (
              <span className="rounded-full border border-amber-400/[0.18] bg-amber-500/[0.07] px-3 py-1.5 text-[10px] font-semibold text-amber-200">
                {reviewCount} · {t('dashboard.preparation.statusNeedsReview')}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3" aria-live="polite">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={readinessPercent}
            aria-label={`${preparedCount}/${views.length} ${t('dashboard.preparation.statusPrepared')}`}
            className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.055]"
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#4f8cff,#6f67f8,#52d3a3)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>
          <span className="min-w-[40px] text-right text-[10px] font-bold tabular-nums tracking-[0.08em] text-white/42">
            {readinessPercent}%
          </span>
        </div>
      </div>

      <div className="divide-y divide-white/[0.055]">
        {views.map(({ event, status, changes }, index) => {
          const busy = busyScaleId === event.id;
          const isMusic = event.type === 'music' && event.songCount > 0;
          const needsRepertoirePreparation = requiresRepertoirePreparation(event);
          const role = event.userFunctionNames.join(', ');
          const visibleSongs = (event.songs || []).slice(0, 3);
          const personalPractice = practiceByEventId?.get(event.id) || null;
          const hasChanges = changes.length > 0;

          return (
            <article key={event.id} className="group relative px-4 py-5 transition-colors duration-200 hover:bg-white/[0.018] sm:px-6">
              <div className="grid gap-4 lg:grid-cols-[52px_minmax(0,1fr)_240px] lg:items-start">
                <div className="hidden lg:flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/[0.07] bg-white/[0.03] text-[12px] font-semibold tabular-nums text-white/36">
                  {String(index + 1).padStart(2, '0')}
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary-light/80">
                      {formatRelativeDay(event.date, locale, t)}
                    </span>
                    {event.time && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/38">
                        <Clock3 className="h-3 w-3" />
                        {event.time}
                      </span>
                    )}
                    {status === 'prepared' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/[0.16] bg-emerald-500/[0.07] px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        <Check className="h-3 w-3" />
                        {t('dashboard.preparation.statusPrepared')}
                      </span>
                    ) : status === 'needs-review' ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/[0.2] bg-amber-500/[0.08] px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                        <RefreshCcw className="h-3 w-3" />
                        {t('dashboard.preparation.statusNeedsReview')}
                      </span>
                    ) : (
                      <span className="rounded-full border border-primary/[0.18] bg-primary/[0.07] px-2 py-0.5 text-[10px] font-semibold text-primary-light/85">
                        {t('dashboard.preparation.statusPreparing')}
                      </span>
                    )}
                  </div>

                  <h3 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-white sm:text-[18px]">
                    {event.title || t('dashboard.focus.untitledEvent')}
                  </h3>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/38 sm:text-xs">
                    {role && <span className="font-semibold text-white/66">{role}</span>}
                    {event.locationName && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{event.locationName}</span>
                      </span>
                    )}
                    {isMusic && <span>{t('dashboard.preparation.songCount', { count: event.songCount })}</span>}
                  </div>

                  {isMusic && visibleSongs.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {visibleSongs.map(song => (
                        <span key={song.id} className="max-w-full truncate rounded-[9px] border border-white/[0.065] bg-white/[0.025] px-2.5 py-1 text-[10.5px] font-medium text-white/48">
                          {song.title}
                        </span>
                      ))}
                      {event.songCount > visibleSongs.length && (
                        <span className="rounded-[9px] px-2 py-1 text-[10.5px] font-semibold text-white/28">
                          +{event.songCount - visibleSongs.length}
                        </span>
                      )}
                    </div>
                  )}

                  {personalPractice && personalPractice.songCount > 0 && (
                    <div className="mt-4 rounded-[14px] border border-indigo-400/[0.13] bg-indigo-500/[0.045] p-3.5">
                      <div className="flex items-start gap-2.5">
                        <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-300" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-indigo-100">
                            {t('dashboard.preparation.personalFocusTitle')}
                          </p>
                          <p className="mt-1 text-[10.5px] leading-relaxed text-indigo-100/55">
                            {t('dashboard.preparation.focusSongs', { count: personalPractice.songCount })}
                            {' · '}
                            {t('dashboard.preparation.focusParts', { count: personalPractice.partCount })}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {personalPractice.songs.slice(0, 3).map(song => (
                              <span
                                key={song.songId}
                                className="rounded-[8px] border border-indigo-300/[0.1] bg-indigo-400/[0.055] px-2 py-1 text-[10px] font-medium text-indigo-100/75"
                              >
                                {song.title} · {t('dashboard.preparation.songFocusParts', { count: song.focusPartCount })}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {hasChanges && (
                    <div className="mt-4 rounded-[14px] border border-amber-400/[0.14] bg-amber-500/[0.055] p-3.5">
                      <div className="mb-2 flex items-center gap-2">
                        <RefreshCcw className="h-3.5 w-3.5 text-amber-300" />
                        <p className="text-[11px] font-semibold text-amber-100">
                          {t('dashboard.preparation.changesTitle', { count: changes.length })}
                        </p>
                      </div>
                      <ul className="space-y-1.5">
                        {changes.slice(0, 3).map((change, changeIndex) => (
                          <li key={`${change.code}-${change.entityId || changeIndex}`} className="text-[11px] leading-relaxed text-amber-100/65">
                            {describePreparationChange(change, t)}
                          </li>
                        ))}
                      </ul>
                      {changes.length > 3 && (
                        <p className="mt-2 text-[10px] font-semibold text-amber-300/75">
                          {t('dashboard.preparation.moreChanges', { count: changes.length - 3 })}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex min-w-0 flex-col gap-2 sm:flex-row lg:flex-col">
                  {hasChanges ? (
                    <button type="button" disabled={busy} onClick={() => void onReviewChanges(event)} className="premium-interactive min-h-[44px] w-full rounded-[13px] border border-amber-300/[0.18] bg-amber-400 px-4 text-[12px] font-semibold text-[#17130a] hover:bg-amber-300 disabled:cursor-wait disabled:opacity-50">
                      <span className="inline-flex items-center justify-center gap-2"><RefreshCcw className="h-4 w-4" />{t('dashboard.preparation.reviewChanges')}</span>
                    </button>
                  ) : isMusic ? (
                    <button type="button" onClick={() => onPrepareEvent(event)} className="ms-btn-primary min-h-[44px] w-full px-4 text-[12px]">
                      <span className="inline-flex items-center justify-center gap-2"><BookOpenCheck className="h-4 w-4" />{personalPractice && personalPractice.songCount > 0
                        ? t('dashboard.preparation.practiceMyFocus')
                        : status === 'prepared'
                          ? t('dashboard.preparation.reviewRepertoire')
                          : t('dashboard.preparation.startPreparation')}</span>
                    </button>
                  ) : null}

                  {status !== 'prepared' && needsRepertoirePreparation && (
                    <button type="button" disabled={busy || hasChanges} onClick={() => void onMarkPrepared(event)} className="premium-interactive min-h-[40px] w-full rounded-[12px] border border-emerald-400/[0.16] bg-emerald-500/[0.055] px-4 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/[0.1] disabled:cursor-not-allowed disabled:opacity-40">
                      {t('dashboard.preparation.markPrepared')}
                    </button>
                  )}

                  <button type="button" onClick={() => onPrepareEvent(event)} className="premium-interactive min-h-[38px] w-full rounded-[11px] px-3 text-[11px] font-semibold text-white/38 hover:bg-white/[0.035] hover:text-white/75">
                    <span className="inline-flex items-center justify-center gap-1">{t('dashboard.preparation.open')}<ChevronRight className="h-3.5 w-3.5" /></span>
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
