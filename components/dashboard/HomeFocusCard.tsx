import React from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import { HomeExperience, HomeAttentionItem, HomeEventSummary } from '../../utils/homeExperience';
import { Calendar, Play, AlertCircle, CheckCircle2, Copy, Plus } from 'lucide-react';

interface HomeFocusCardProps {
  experience: HomeExperience;
  canUsePerformance: boolean;
  responseActions?: React.ReactNode;
  onOpenEvent: (event: HomeEventSummary) => void;
  onOpenPerformance: (event: HomeEventSummary) => void;
  onCreateScale: () => void;
  onChooseScaleToRepeat: () => void;
}

export const HomeFocusCard: React.FC<HomeFocusCardProps> = ({ 
  experience, 
  canUsePerformance, 
  responseActions, 
  onOpenEvent, 
  onOpenPerformance, 
  onCreateScale, 
  onChooseScaleToRepeat 
}) => {
  const { t } = useTranslation();
  
  const { mode, event, draftEvent, attentionItems } = experience;

  const renderAttentionList = (items: HomeAttentionItem[]) => {
    if (!items || items.length === 0) return null;

    return (
      <ul className="mt-4 space-y-2">
        {items.map((item, idx) => {
          let icon = <AlertCircle className="w-4 h-4 text-amber-500" />;
          if (item.severity === 'important') icon = <AlertCircle className="w-4 h-4 text-rose-500" />;
          if (item.severity === 'info') icon = <CheckCircle2 className="w-4 h-4 text-blue-500" />;
          
          let text = '';
          switch (item.code) {
            case 'draft': text = t('dashboard.attention.draft'); break;
            case 'missing-repertoire': text = t('dashboard.attention.missingRepertoire'); break;
            case 'missing-team': text = t('dashboard.attention.missingTeam'); break;
            case 'missing-time': text = t('dashboard.attention.missingTime'); break;
            case 'missing-location': text = t('dashboard.attention.missingLocation'); break;
          }
          
          return (
            <li key={idx} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              {icon}
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderAssignedEvent = () => {
    if (!event) return null;
    
    const IntlList = new Intl.ListFormat(t('locale', 'pt-BR'), { style: 'long', type: 'conjunction' });
    const formattedFunctions = event.userFunctionNames.length > 0 ? IntlList.format(event.userFunctionNames) : '';

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
          <Calendar className="w-4 h-4" />
          {t('dashboard.focus.assignedEyebrow')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{event.title}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {event.date} {event.time ? `• ${event.time}` : ''} {event.locationName ? `• ${event.locationName}` : ''}
          </p>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400 space-x-2">
            <span>{t('dashboard.focus.songsCount_' + (event.songCount === 1 ? 'one' : 'other'), { count: event.songCount })}</span>
            <span>•</span>
            {formattedFunctions && (
              <span>
                <span className="font-medium text-slate-900 dark:text-white">{t('dashboard.focus.functionLabel')}</span> {formattedFunctions}
              </span>
            )}
          </div>
        </div>

        {responseActions && (
          <div className="pt-2">
            {responseActions}
          </div>
        )}

        {renderAttentionList(attentionItems)}

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => onOpenEvent(event)} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.openRepertoire')}
          </Button>
          
          {event.songCount > 0 && canUsePerformance && (
             <Button onClick={() => onOpenPerformance(event)} className="w-full sm:w-auto" variant="secondary">
               <Play className="w-4 h-4 mr-2" />
               {t('dashboard.focus.performanceMode')}
             </Button>
          )}
        </div>
      </div>
    );
  };

  const renderLeaderAttention = () => {
    if (!event) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
          <AlertCircle className="w-4 h-4" />
          {t('dashboard.focus.attentionEyebrow')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.attentionTitle')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {event.title} • {event.date}
          </p>
        </div>

        {renderAttentionList(attentionItems)}

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => onOpenEvent(event)} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.resolveIssues')}
          </Button>
        </div>
      </div>
    );
  };

  const renderContinueDraft = () => {
    if (!draftEvent) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
          <Copy className="w-4 h-4" />
          {t('dashboard.focus.draftEyebrow')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.continueDraft')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {draftEvent.title} • {draftEvent.date}
          </p>
        </div>
        
        {renderAttentionList(attentionItems)}

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => onOpenEvent(draftEvent)} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.continuePreparing')}
          </Button>
        </div>
      </div>
    );
  };

  const renderLeaderPrepared = () => {
    if (!event) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
          <CheckCircle2 className="w-4 h-4" />
          {t('dashboard.focus.preparedEyebrow')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.preparedTitle')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {event.title} • {event.date} {event.time ? `• ${event.time}` : ''}
          </p>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t('dashboard.focus.songsCount_' + (event.songCount === 1 ? 'one' : 'other'), { count: event.songCount })} • {t('dashboard.focus.teamCount_' + (event.teamCount === 1 ? 'one' : 'other'), { count: event.teamCount })}
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => onOpenEvent(event)} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.openScale')}
          </Button>
          
          {event.songCount > 0 && canUsePerformance && (
             <Button onClick={() => onOpenPerformance(event)} className="w-full sm:w-auto" variant="secondary">
               <Play className="w-4 h-4 mr-2" />
               {t('dashboard.focus.performanceMode')}
             </Button>
          )}
        </div>
      </div>
    );
  };

  const renderObserverEvent = () => {
    if (!event) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
          <Calendar className="w-4 h-4" />
          {t('dashboard.focus.observerEyebrow')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{event.title || t('dashboard.focus.untitledEvent')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {event.date} {event.time ? `• ${event.time}` : ''} {event.locationName ? `• ${event.locationName}` : ''}
          </p>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t('dashboard.focus.songsCount_' + (event.songCount === 1 ? 'one' : 'other'), { count: event.songCount })}
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => onOpenEvent(event)} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.viewDetails')}
          </Button>
        </div>
      </div>
    );
  };

  const renderCreateNext = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-wider">
          <Calendar className="w-4 h-4" />
          {t('dashboard.focus.noEventsEyebrow')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.createNextTitle')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t('dashboard.focus.createNextDesc')}
          </p>
        </div>
        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={onCreateScale} className="w-full sm:w-auto" variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            {t('dashboard.focus.createNextEvent')}
          </Button>
          <Button onClick={onChooseScaleToRepeat} className="w-full sm:w-auto" variant="secondary">
            {t('dashboard.focus.chooseScaleToRepeat')}
          </Button>
        </div>
      </div>
    );
  };

  const renderNoEvents = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500 uppercase tracking-wider">
          <Calendar className="w-4 h-4" />
          {t('dashboard.focus.noEventsEyebrow')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.noEventsTitle')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t('dashboard.focus.noEventsDesc')}
          </p>
        </div>
      </div>
    );
  };

  let content = null;
  switch (mode) {
    case 'first-value':
      return null;
    case 'assigned-event':
      content = renderAssignedEvent();
      break;
    case 'continue-draft':
      content = renderContinueDraft();
      break;
    case 'leader-attention':
      content = renderLeaderAttention();
      break;
    case 'leader-prepared':
      content = renderLeaderPrepared();
      break;
    case 'observer-event':
      content = renderObserverEvent();
      break;
    case 'create-next-event':
      content = renderCreateNext();
      break;
    case 'no-upcoming-event':
      content = renderNoEvents();
      break;
  }

  return (
    <Card className="p-6 sm:p-8 bg-white dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] shadow-sm relative overflow-hidden">
      {content}
    </Card>
  );
};
