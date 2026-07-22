import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HomeEventSummary } from '../../utils/homeExperience';
import { Calendar, Music, MapPin, Users } from 'lucide-react';
import Button from '../common/Button';

interface HomeUpcomingEventsProps {
  events: HomeEventSummary[];
}

export const HomeUpcomingEvents: React.FC<HomeUpcomingEventsProps> = ({ events }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!events || events.length === 0) {
    return null;
  }

  // Limited to 3 initially
  const displayedEvents = events.slice(0, 3);
  const hasMore = events.length > 3;

  const getEventPath = (e: HomeEventSummary) => {
    return e.type === 'band' ? `/band-scales/${e.id}` : `/scales/${e.id}`;
  };

  const getMonthName = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString(undefined, { month: 'short' }).toUpperCase();
    } catch {
      return '';
    }
  };

  const getDay = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      // Ensure we extract day from the string itself to avoid timezone issues, or use UTC
      const [, , day] = dateStr.split('-');
      if (day) return day;
      return date.getDate().toString().padStart(2, '0');
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {t('dashboard.upcomingEvents.title', 'Próximos compromissos')}
      </h3>
      <div className="space-y-3">
        {displayedEvents.map((event) => (
          <button
            key={event.id}
            onClick={() => navigate(getEventPath(event))}
            className="w-full text-left bg-white dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] rounded-xl p-4 flex gap-4 items-start transition-all hover:border-slate-300 dark:hover:border-white/[0.15] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {/* Date block */}
            <div className="flex flex-col items-center justify-center min-w-[50px] pt-1">
              <span className="text-xs font-bold text-slate-500 uppercase">{getMonthName(event.date)}</span>
              <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none">{getDay(event.date)}</span>
            </div>

            {/* Details block */}
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                {event.title}
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
                  {event.songCount}
                </span>
                {event.isUserAssigned && event.userFunctionNames.length > 0 && (
                  <span className="flex items-center gap-1 truncate text-indigo-600 dark:text-indigo-400 font-medium max-w-full">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{event.userFunctionNames.join(', ')}</span>
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {hasMore && (
        <div className="pt-2">
          <Button
            variant="ghost"
            onClick={() => navigate('/scales')}
            className="w-full text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            {t('dashboard.upcomingEvents.viewAll', 'Ver todos')}
          </Button>
        </div>
      )}
    </div>
  );
};
