import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HomeEventSummary } from '../../utils/homeExperience';
import { Calendar, Music, MapPin, Users, ChevronRight } from 'lucide-react';
import Button from '../common/Button';

interface HomeUpcomingEventsProps {
  events: HomeEventSummary[];
  onOpenEvent: (event: HomeEventSummary) => void;
  excludeEventIds?: string[];
}

export const HomeUpcomingEvents: React.FC<HomeUpcomingEventsProps> = ({ events, onOpenEvent, excludeEventIds = [] }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  if (!events || events.length === 0) return null;

  const excludedIds = new Set(excludeEventIds);
  const nonDraftEvents = events.filter(e => e.status !== 'draft' && !excludedIds.has(e.id));
  if (nonDraftEvents.length === 0) return null;

  const displayedEvents = nonDraftEvents.slice(0, 3);
  const hasMore = nonDraftEvents.length > 3;

  const getMonthName = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      if (!year || !month || !day) return '';
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleString(i18n.language || 'pt-BR', { month: 'short' }).replace('.', '').toUpperCase();
    } catch {
      return '';
    }
  };

  const getDay = (dateStr: string) => {
    try {
      const [, , day] = dateStr.split('-');
      return day || '';
    } catch {
      return '';
    }
  };

  return (
    <section className="ms-v3-upcoming space-y-4" aria-labelledby="dashboard-upcoming-events-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="ms-kicker">{t('dashboard.upcomingEvents.title')}</span>
          <h3 id="dashboard-upcoming-events-title" className="mt-2 text-[18px] font-semibold tracking-[-0.025em] text-white sm:text-[19px]">
            {t('dashboard.upcomingEvents.title')}
          </h3>
        </div>
        {hasMore && (
          <Button variant="ghost" size="sm" onClick={() => navigate('/scales')} className="hidden sm:inline-flex">
            {t('dashboard.upcomingEvents.viewAll')}
          </Button>
        )}
      </div>

      <div className="grid gap-2.5">
        {displayedEvents.map((event) => {
          const IntlList = new Intl.ListFormat(i18n.language || 'pt-BR', { style: 'long', type: 'conjunction' });
          const formattedFunctions = event.userFunctionNames.length > 0 ? IntlList.format(event.userFunctionNames) : '';

          return (
            <button
              key={event.id}
              onClick={() => onOpenEvent(event)}
              className="ms-card ms-card-interactive group flex w-full items-center gap-3.5 p-3.5 text-left sm:gap-4 sm:p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <div className="flex h-[58px] w-[54px] shrink-0 flex-col items-center justify-center rounded-[15px] border border-white/[0.07] bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <span className="text-[9px] font-bold tracking-[0.1em] text-primary-light/80">{getMonthName(event.date)}</span>
                <span className="mt-0.5 text-[22px] font-semibold leading-none tracking-[-0.04em] text-white">{getDay(event.date)}</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h4 className="truncate text-[14px] font-semibold tracking-[-0.015em] text-white sm:text-[15px]">
                    {event.title || t('dashboard.focus.untitledEvent')}
                  </h4>
                  {event.isUserAssigned && (
                    <span className="hidden sm:inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_9px_rgba(79,140,255,0.55)]" aria-hidden="true" />
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-white/40 sm:text-[12px]">
                  {event.time && (
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <Calendar className="h-3.5 w-3.5 text-white/30" />
                      {event.time}
                    </span>
                  )}
                  {event.locationName && (
                    <span className="flex max-w-full items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-white/30" />
                      <span className="truncate">{event.locationName}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Music className="h-3.5 w-3.5 text-white/30" />
                    {t('dashboard.focus.songsCount_' + (event.songCount === 1 ? 'one' : 'other'), { count: event.songCount })}
                  </span>
                  {event.isUserAssigned && formattedFunctions && (
                    <span className="flex max-w-full items-center gap-1.5 truncate font-semibold text-primary-light/75">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{formattedFunctions}</span>
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-[18px] w-[18px] shrink-0 text-white/18 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white/45" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      {hasMore && (
        <div className="pt-1 sm:hidden">
          <Button variant="ghost" onClick={() => navigate('/scales')} className="w-full">
            {t('dashboard.upcomingEvents.viewAll')}
          </Button>
        </div>
      )}
    </section>
  );
};