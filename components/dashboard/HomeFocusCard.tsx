import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import { HomeExperience, HomeAttentionItem } from '../../utils/homeExperience';
import { Calendar, Play, AlertCircle, CheckCircle2, ChevronRight, Copy, Plus } from 'lucide-react';
import AssignmentResponseActions from '../scales/AssignmentResponseActions';
import { useCapability } from '../../hooks/useCapability';

interface HomeFocusCardProps {
  experience: HomeExperience;
}

export const HomeFocusCard: React.FC<HomeFocusCardProps> = ({ experience }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasCapability } = useCapability();
  const canUsePerformance = hasCapability('musicscale.performance.use');

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
            case 'draft': text = t('dashboard.attention.draft', 'Rascunho ainda não publicado'); break;
            case 'missing-repertoire': text = t('dashboard.attention.missingRepertoire', 'Repertório vazio'); break;
            case 'missing-team': text = t('dashboard.attention.missingTeam', 'Equipe vazia'); break;
            case 'missing-time': text = t('dashboard.attention.missingTime', 'Horário não informado'); break;
            case 'missing-location': text = t('dashboard.attention.missingLocation', 'Local não informado'); break;
          }

          return (
            <li key={idx} className="flex items-center text-sm text-slate-700 dark:text-slate-300 gap-2">
              {icon}
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  const getEventPath = (e: any) => {
    return e.type === 'band' ? `/band-scales/${e.id}` : `/scales/${e.id}`;
  };

  const renderAssignedEvent = () => {
    if (!event) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
          <Calendar className="w-4 h-4" />
          {t('dashboard.focus.assignedEyebrow', 'Você está escalado')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{event.title}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {event.date} {event.time ? `• ${event.time}` : ''} {event.locationName ? `• ${event.locationName}` : ''}
          </p>
          <div className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            {t('dashboard.focus.functionLabel', 'Função:')} <span className="text-indigo-600 dark:text-indigo-400">{event.userFunctionNames.join(', ')}</span>
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('dashboard.focus.songsCount', '{{count}} músicas', { count: event.songCount })}
          </div>
        </div>

        <div className="pt-2">
          <AssignmentResponseActions 
            musicScaleId={event.id}
            isBandScale={event.type === 'band'}
            eventStart={`${event.date}T${event.time || '00:00'}`}
          />
        </div>

        {renderAttentionList(attentionItems)}

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate(getEventPath(event))} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.openRepertoire', 'Abrir repertório')}
          </Button>
          {event.songCount > 0 && canUsePerformance && (
             <Button onClick={() => navigate(`${getEventPath(event)}/performance`)} className="w-full sm:w-auto" variant="outline">
               <Play className="w-4 h-4 mr-2" />
               Performance Mode
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
          {t('dashboard.focus.attentionEyebrow', 'Requer atenção')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.attentionTitle', 'O próximo culto precisa de atenção')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {event.title} • {event.date}
          </p>
        </div>

        {renderAttentionList(attentionItems)}

        <div className="pt-4">
          <Button onClick={() => navigate(getEventPath(event))} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.resolveIssues', 'Resolver pendências')}
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
          {t('dashboard.focus.draftEyebrow', 'Rascunho salvo')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.continueDraft', 'Continue preparando')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {draftEvent.title} • {draftEvent.date}
          </p>
        </div>
        
        {renderAttentionList(attentionItems)}

        <div className="pt-4">
          <Button onClick={() => navigate(getEventPath(draftEvent))} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.continuePreparing', 'Continuar preparando')}
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
          {t('dashboard.focus.preparedEyebrow', 'Escala publicada')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.preparedTitle', 'Tudo organizado até aqui')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {event.title} • {event.date} {event.time ? `• ${event.time}` : ''}
          </p>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t('dashboard.focus.songsCount', '{{count}} músicas', { count: event.songCount })} • {t('dashboard.focus.teamCount', '{{count}} pessoas', { count: event.teamCount })}
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate(getEventPath(event))} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.openScale', 'Abrir escala')}
          </Button>
          {event.songCount > 0 && canUsePerformance && (
             <Button onClick={() => navigate(`${getEventPath(event)}/performance`)} className="w-full sm:w-auto" variant="outline">
               <Play className="w-4 h-4 mr-2" />
               Performance Mode
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
          {t('dashboard.focus.observerEyebrow', 'Próximo evento')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{event.title}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {event.date} {event.time ? `• ${event.time}` : ''} {event.locationName ? `• ${event.locationName}` : ''}
          </p>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t('dashboard.focus.songsCount', '{{count}} músicas', { count: event.songCount })}
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate(getEventPath(event))} className="w-full sm:w-auto" variant="primary">
            {t('dashboard.focus.viewDetails', 'Ver detalhes')}
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
          {t('dashboard.focus.noEventsEyebrow', 'Agenda livre')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.createNextTitle', 'Vamos preparar o próximo culto?')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t('dashboard.focus.createNextDesc', 'Você não tem compromissos próximos.')}
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row gap-3">
          <Button onClick={() => navigate('/scales/new')} className="w-full sm:w-auto" variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            {t('dashboard.focus.createNextEvent', 'Criar próxima escala')}
          </Button>
          <Button onClick={() => navigate('/scales?action=clone')} className="w-full sm:w-auto" variant="outline">
            {t('dashboard.focus.repeatScale', 'Repetir uma escala')}
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
          {t('dashboard.focus.noEventsEyebrow', 'Agenda livre')}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dashboard.focus.noEventsTitle', 'Você não tem compromissos próximos.')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {t('dashboard.focus.noEventsDesc', 'Avisaremos quando uma nova escala for publicada.')}
          </p>
        </div>
      </div>
    );
  };

  let content = null;
  switch (mode) {
    case 'first-value':
      return null; // Handled outside in DashboardPage
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
