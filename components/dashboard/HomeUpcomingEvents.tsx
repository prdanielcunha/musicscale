import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HomeEventSummary } from '../../utils/homeExperience';
import { Calendar, Music, MapPin, Users } from 'lucide-react';
import Button from '../common/Button';

interface HomeUpcomingEventsProps {
  events: HomeEventSummary[];
  onOpenEvent: (event: HomeEventSummary) => void;
}

export const HomeUpcomingEvents: React.FC<HomeUpcomingEventsProps> = ({ events, onOpenEvent }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  if (!events || events.length === 0) {
    return null;
  }

  const nonDraftEvents = events.filter(e => e.status !== 'draft');

  if (nonDraftEvents.length === 0) {
    return null;
  }

  // REQUISITO 13: limit to 3
  const displayedEvents = nonDraftEvents.slice(0, 3);
  const hasMore = nonDraftEvents.length > 3;

  const getMonthName = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-');
      if (!year || !month || !day) return '';
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleString(i18n.language || 'pt-BR', { month: 'short' }).toUpperCase();
    } catch {
      return '';
    }
  };

  const getDay = (dateStr: string) => {
    try {
      const [, , day] = dateStr.split('-');
      if (day) return day;
      return '';
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {t('dashboard.upcomingEvents.title')}
      </h3>
      <div className="space-y-3">
        {displayedEvents.map((event) => {
          const IntlList = new Intl.ListFormat(i18n.language || 'pt-BR', { style: 'long', type: 'conjunction' });
          const formattedFunctions = event.userFunctionNames.length > 0 ? IntlList.format(event.userFunctionNames) : '';

          return (
            <button
              key={event.id}
              onClick={() => onOpenEvent(event)}
              className="w-full text-left rounded-2xl p-4 flex gap-4 items-start transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div className="flex flex-col items-center justify-center min-w-[50px] pt-1">
                <span className="text-xs font-bold text-slate-500 uppercase">{getMonthName(event.date)}</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{getDay(event.date)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                  {event.title || t('dashboard.focus.untitledEvent')}
                </h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {event.time && (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="w-3.5 h-3.5" />
                      {event.time}
                    </span>
                  )}
                  {event.locationName && (
                    <span className="flex items-center gap-1 truncate max-w-full">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{event.locationName}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <Music className="w-3.5 h-3.5" />
                    {t('dashboard.focus.songsCount_' + (event.songCount === 1 ? 'one' : 'other'), { count: event.songCount })}
                  </span>
                  {event.isUserAssigned && formattedFunctions && (
                    <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-full">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{formattedFunctions}</span>
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {hasMore && (
        <div className="pt-2">
          <Button
            variant="ghost"
            onClick={() => navigate('/scales')}
            className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {t('dashboard.upcomingEvents.viewAll')}
          </Button>
        </div>
      )}
    </div>
  );
};
