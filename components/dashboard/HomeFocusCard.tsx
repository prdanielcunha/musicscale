import React from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import { HomeExperience, HomeAttentionItem, HomeEventSummary, getLocalDateKey, HomeEventSongSummary, canUsePerformanceMode } from '../../utils/homeExperience';
import { Play, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const { t, i18n } = useTranslation();
  
  const locale = i18n.resolvedLanguage || i18n.language || 'pt-BR';
  const standardLocale = locale.startsWith('pt') ? 'pt-BR' : locale.startsWith('en') ? 'en-US' : locale.startsWith('es') ? 'es-ES' : 'pt-BR';
  const { mode, event, draftEvent, attentionItems } = experience;

  const getRelativeLabelElements = (dateStr: string) => {
    if (!dateStr) return { fixed: t('dashboard.focus.nextEvent', 'Próximo evento'), relative: null };
    const todayStr = getLocalDateKey();
    if (dateStr === todayStr) {
      return {
        fixed: t('dashboard.focus.nextEvent', 'Próximo evento'),
        relative: t('dashboard.focus.today', 'Hoje')
      };
    }
    const today = new Date(todayStr + 'T12:00:00');
    const target = new Date(dateStr + 'T12:00:00');
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      return {
        fixed: t('dashboard.focus.nextEvent', 'Próximo evento'),
        relative: t('dashboard.focus.tomorrow', 'Amanhã')
      };
    } else if (diffDays > 1 && diffDays <= 7) {
      return {
        fixed: t('dashboard.focus.nextEvent', 'Próximo evento'),
        relative: t('dashboard.focus.inDays', 'Em {{count}} dias', { count: diffDays })
      };
    }
    return {
      fixed: t('dashboard.focus.nextEvent', 'Próximo evento'),
      relative: null
    };
  };

  const getScaleStatusBadge = (targetEvent: HomeEventSummary, currentMode: string) => {
    if (
      targetEvent.status === 'draft' ||
      currentMode === 'continue-draft' ||
      (attentionItems && attentionItems.some(i => i.code === 'draft'))
    ) {
      return {
        label: t('dashboard.focus.scaleDraft', 'Rascunho'),
        style: 'bg-amber-500/[0.05] text-amber-600 dark:text-amber-400 border border-amber-500/10'
      };
    }

    if (
      (targetEvent.type === 'music' && targetEvent.songCount === 0) ||
      (attentionItems && attentionItems.some(i => i.code === 'missing-repertoire'))
    ) {
      return {
        label: t('dashboard.focus.repertoireIncomplete', 'Repertório incompleto'),
        style: 'bg-rose-500/[0.05] text-rose-600 dark:text-rose-400 border border-rose-500/10'
      };
    }

    if (attentionItems && attentionItems.some(i => i.code === 'missing-team')) {
      return {
        label: t('dashboard.focus.teamIncomplete', 'Equipe incompleta'),
        style: 'bg-amber-500/[0.05] text-amber-600 dark:text-amber-400 border border-amber-500/10'
      };
    }

    if (
      attentionItems &&
      attentionItems.some(i => i.code === 'missing-time' || i.code === 'missing-location')
    ) {
      return {
        label: t('dashboard.focus.incompleteData', 'Dados incompletos'),
        style: 'bg-amber-500/[0.05] text-amber-600 dark:text-amber-400 border border-amber-500/10'
      };
    }

    if (
      attentionItems &&
      attentionItems.some(i => i.code === 'pending-responses')
    ) {
      return {
        label: t('dashboard.focus.pendingResponses', 'Aguardando respostas'),
        style: 'bg-amber-500/[0.05] text-amber-600 dark:text-amber-400 border border-amber-500/10'
      };
    }

    if (attentionItems && attentionItems.length > 0) {
      return {
        label: t('dashboard.focus.inPreparation', 'Em preparação'),
        style: 'bg-blue-500/[0.05] text-blue-600 dark:text-blue-400 border border-blue-500/10'
      };
    }

    return {
      label: t('dashboard.focus.repertoireReady', 'Escala pronta'),
      style: 'bg-emerald-500/[0.03] text-emerald-600 dark:text-emerald-400 border border-emerald-500/[0.08]'
    };
  };

  const getEffectiveKey = (song: HomeEventSongSummary) => {
    return song.localKey || song.selectedKey || song.key || song.originalKey || '';
  };

  const renderRichEventCard = (targetEvent: HomeEventSummary | null, currentMode: string) => {
    if (!targetEvent) return null;

    const { fixed, relative } = getRelativeLabelElements(targetEvent.date);
    const statusBadge = getScaleStatusBadge(targetEvent, currentMode);

    const formattedDate = () => {
      try {
        const [year, month, day] = targetEvent.date.split('-');
        const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
        // Use a shorter format or just weekday for elegance, e.g., "Domingo"
        const weekday = dateObj.toLocaleDateString(standardLocale, { weekday: 'long' });
        return weekday.charAt(0).toUpperCase() + weekday.slice(1);
      } catch {
        return targetEvent.date;
      }
    };

    const showPerformance = canUsePerformanceMode(targetEvent, canUsePerformance);

    return (
      <div className="flex flex-col gap-4">
        
        {/* Eyebrow */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-slate-800 dark:text-slate-200">
            {fixed}
          </span>
          {relative && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
                {relative}
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
            {targetEvent.title || t('dashboard.focus.untitledEvent')}
          </h2>
        </div>

        {/* Date / Time / Location */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-medium text-slate-700 dark:text-slate-300">
          <span>{formattedDate()}</span>
          {targetEvent.time && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>{targetEvent.time}</span>
            </>
          )}
          {targetEvent.locationName && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-500 dark:text-slate-400">{targetEvent.locationName}</span>
            </>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium tracking-wide ${statusBadge.style}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
            {statusBadge.label}
          </span>
        </div>

        {/* Role */}
        {targetEvent.isUserAssigned && targetEvent.userFunctionNames.length > 0 && (
          <div>
            <p className="text-lg font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="text-xl">🎹</span>
              {t('dashboard.focus.functionLabel', 'Você servirá como')} {targetEvent.userFunctionNames.join(', ')}
            </p>
          </div>
        )}

        {/* Repertoire Setlist */}
        {targetEvent.type === 'music' && (
          <div>
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
              {t('dashboard.focus.repertoire', 'Repertório')}
            </h3>
            
            {targetEvent.songs && targetEvent.songs.length > 0 ? (
              <div className="flex flex-col gap-3">
                {targetEvent.songs.slice(0, 3).map((song, idx) => {
                  const effectiveKey = getEffectiveKey(song);
                  return (
                    <div key={song.id || idx} className="flex items-center justify-between group py-0.5">
                      <div className="flex items-center gap-3 pr-4 overflow-hidden">
                        <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500/60 w-4 shrink-0 text-right">{song.order}</span>
                        <span className="text-[15px] font-medium text-slate-800 dark:text-slate-200 truncate">{song.title}</span>
                      </div>
                      {effectiveKey && (
                        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[13px] font-extrabold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 shrink-0 tracking-wide border border-indigo-100 dark:border-indigo-500/20 shadow-sm">
                          {effectiveKey}
                        </span>
                      )}
                    </div>
                  );
                })}
                {targetEvent.songCount > 3 && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      + {targetEvent.songCount - 3} {t('dashboard.focus.moreSongs', 'música(s)')}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400 italic">
                {t('dashboard.focus.noSongs', 'Nenhuma música adicionada')}
              </div>
            )}
          </div>
        )}

        {/* Attention Items (only if they exist and are important) */}
        {attentionItems && attentionItems.length > 0 && (
          <div className="pt-2">
            <ul className="flex flex-col gap-2">
              {attentionItems.map((item, idx) => {
                let icon = <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />;
                if (item.severity === 'important') icon = <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />;
                if (item.severity === 'info') icon = <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />;
                
                let text = '';
                switch (item.code) {
                  case 'draft': text = t('dashboard.attention.draft', 'Rascunho ainda não publicado'); break;
                  case 'missing-repertoire': text = t('dashboard.attention.missingRepertoire', 'Repertório vazio'); break;
                  case 'missing-team': text = t('dashboard.attention.missingTeam', 'Equipe vazia'); break;
                  case 'missing-time': text = t('dashboard.attention.missingTime', 'Horário não informado'); break;
                  case 'missing-location': text = t('dashboard.attention.missingLocation', 'Local não informado'); break;
                }
                
                return (
                  <li key={idx} className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400">
                    {icon}
                    <span>{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Actions Button Bar */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          {currentMode === 'assigned-event' || currentMode === 'leader-prepared' ? (
            <>
              {showPerformance ? (
                <Button onClick={() => onOpenPerformance(targetEvent)} className="w-full sm:w-auto rounded-full h-12 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out shadow-lg shadow-indigo-500/25" size="lg" variant="primary">
                  <Play className="w-5 h-5 mr-2 fill-current" />
                  {t('dashboard.focus.enterPerformance', 'Entrar no Modo Performance')}
                </Button>
              ) : (
                <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto rounded-full h-12 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out shadow-lg shadow-indigo-500/25" size="lg" variant="primary">
                  {targetEvent.type === 'music' ? t('dashboard.focus.openRepertoire', 'Abrir repertório') : t('dashboard.focus.openScale', 'Abrir escala')}
                </Button>
              )}
              <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto rounded-full h-12 hover:bg-slate-100 dark:hover:bg-white/5 active:scale-[0.98] transition-all duration-300 ease-out font-medium" size="lg" variant="ghost">
                {t('dashboard.focus.viewScaleDetails', 'Ver detalhes')}
              </Button>
            </>
          ) : currentMode === 'leader-attention' ? (
            <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto rounded-full h-12 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out shadow-lg shadow-indigo-500/25" size="lg" variant="primary">
              {t('dashboard.focus.resolveIssues', 'Resolver pendências')}
            </Button>
          ) : currentMode === 'observer-event' ? (
            <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto rounded-full h-12 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out shadow-lg shadow-indigo-500/25" size="lg" variant="primary">
              {t('dashboard.focus.viewDetails', 'Ver detalhes')}
            </Button>
          ) : currentMode === 'continue-draft' ? (
            <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto rounded-full h-12 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ease-out shadow-lg shadow-indigo-500/25" size="lg" variant="primary">
              {t('dashboard.focus.continuePreparing', 'Continuar preparando')}
            </Button>
          ) : null}
        </div>

        {/* Response Actions Container */}
        {responseActions && (
          <div className="pt-1">
            {responseActions}
          </div>
        )}

      </div>
    );
  };

  const renderCreateNext = () => {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            {t('dashboard.focus.noEventsEyebrow')}
          </span>
        </div>
        <div>
          <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
            {t('dashboard.focus.createNextTitle')}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mt-4">
            {t('dashboard.focus.createNextDesc')}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button onClick={onCreateScale} className="w-full sm:w-auto h-12 rounded-xl" variant="primary">
            {t('dashboard.focus.createNextEvent')}
          </Button>
          <Button onClick={onChooseScaleToRepeat} className="w-full sm:w-auto h-12 rounded-xl" variant="secondary">
            {t('dashboard.focus.chooseScaleToRepeat')}
          </Button>
        </div>
      </div>
    );
  };

  const renderNoEvents = () => {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            {t('dashboard.focus.noEventsEyebrow')}
          </span>
        </div>
        <div>
          <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-none">
            {t('dashboard.focus.noEventsTitle')}
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mt-4">
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
      content = renderRichEventCard(event, mode);
      break;
    case 'continue-draft':
      content = renderRichEventCard(draftEvent, mode);
      break;
    case 'leader-attention':
      content = renderRichEventCard(event, mode);
      break;
    case 'leader-prepared':
      content = renderRichEventCard(event, mode);
      break;
    case 'observer-event':
      content = renderRichEventCard(event, mode);
      break;
    case 'create-next-event':
      content = renderCreateNext();
      break;
    case 'no-upcoming-event':
      content = renderNoEvents();
      break;
  }

  return (
    <Card className="p-4 sm:p-6 bg-gradient-to-b from-white to-slate-50/50 dark:from-[#13131A] dark:to-[#0D0D12] border-none shadow-2xl shadow-black/5 dark:shadow-black/40 relative overflow-hidden rounded-3xl">
      {/* Decorative subtle top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-indigo-500/0"></div>
      {content}
    </Card>
  );
};
