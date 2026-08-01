import React from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../common/Card';
import Button from '../common/Button';
import { HomeExperience, HomeAttentionItem, HomeEventSummary, getLocalDateKey, HomeEventSongSummary, canUsePerformanceMode } from '../../utils/homeExperience';
import { Calendar, Play, AlertCircle, CheckCircle2, Plus, MapPin, Clock, Users, Music } from 'lucide-react';

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
    // 1. draft: Rascunho
    if (
      targetEvent.status === 'draft' ||
      currentMode === 'continue-draft' ||
      (attentionItems && attentionItems.some(i => i.code === 'draft'))
    ) {
      return {
        label: t('dashboard.focus.scaleDraft', 'Rascunho'),
        style: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      };
    }

    // 2. missing-repertoire ou songCount === 0: Repertório incompleto
    if (
      (targetEvent.type === 'music' && targetEvent.songCount === 0) ||
      (attentionItems && attentionItems.some(i => i.code === 'missing-repertoire'))
    ) {
      return {
        label: t('dashboard.focus.repertoireIncomplete', 'Repertório incompleto'),
        style: 'bg-rose-500/10 text-rose-500 border-rose-500/20'
      };
    }

    // 3. missing-team: Equipe incompleta
    if (attentionItems && attentionItems.some(i => i.code === 'missing-team')) {
      return {
        label: t('dashboard.focus.teamIncomplete', 'Equipe incompleta'),
        style: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      };
    }

    // 4. missing-time ou missing-location: Dados incompletos
    if (
      attentionItems &&
      attentionItems.some(i => i.code === 'missing-time' || i.code === 'missing-location')
    ) {
      return {
        label: t('dashboard.focus.incompleteData', 'Dados incompletos'),
        style: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      };
    }

    // 5. pending-responses: Aguardando respostas
    if (
      attentionItems &&
      attentionItems.some(i => i.code === 'pending-responses')
    ) {
      return {
        label: t('dashboard.focus.pendingResponses', 'Aguardando respostas'),
        style: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
      };
    }

    // 6. demais pendências não críticas: Em preparação
    if (attentionItems && attentionItems.length > 0) {
      return {
        label: t('dashboard.focus.inPreparation', 'Em preparação'),
        style: 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      };
    }

    // 7. sem pendências: Escala pronta
    return {
      label: t('dashboard.focus.repertoireReady', 'Escala pronta'),
      style: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
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
        return dateObj.toLocaleDateString(standardLocale, { day: 'numeric', month: 'long', year: 'numeric' });
      } catch {
        return targetEvent.date;
      }
    };

    const showPerformance = canUsePerformanceMode(targetEvent, canUsePerformance);

    return (
      <div className="space-y-6">
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-md">
              {fixed}{relative ? ` • ${relative}` : ''}
            </span>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">•</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {targetEvent.type === 'music' ? t('nav.my_scales', 'Escala de Música') : t('nav.band_scales', 'Escala de Banda')}
            </span>
          </div>
          <div className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-md border ${statusBadge.style}`}>
            {statusBadge.label}
          </div>
        </div>

        {/* Main Details */}
        <div className="space-y-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              {targetEvent.title || t('dashboard.focus.untitledEvent')}
            </h2>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="font-semibold">{formattedDate()}</span>
              </div>
              {targetEvent.time && (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{targetEvent.time}</span>
                </div>
              )}
              {targetEvent.locationName && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="truncate">{targetEvent.locationName}</span>
                </div>
              )}
            </div>

            {/* Sua função / Atribuição */}
            {targetEvent.isUserAssigned && targetEvent.userFunctionNames.length > 0 && (
              <div className="mt-4 p-3 bg-indigo-500/[0.04] border border-indigo-500/10 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {t('dashboard.focus.functionLabel', 'Sua Função:')}
                  </p>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {targetEvent.userFunctionNames.join(' • ')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Repertoire Setlist Preview */}
        {targetEvent.type === 'music' && (
          <div className="border-t border-slate-100 dark:border-white/[0.06] pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" />
                {t('dashboard.focus.songsInScale', 'Repertório • {{count}} músicas', { count: targetEvent.songCount })}
              </h3>
            </div>
            
            {targetEvent.songs && targetEvent.songs.length > 0 ? (
              <div className="grid gap-2.5 sm:grid-cols-1 md:grid-cols-3">
                {targetEvent.songs.slice(0, 3).map((song, idx) => {
                  const effectiveKey = getEffectiveKey(song);
                  return (
                    <div key={song.id || idx} className="bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] rounded-xl p-3 flex justify-between items-center hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="text-xs font-mono font-bold text-slate-400">{song.order}</span>
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{song.title}</span>
                      </div>
                      {effectiveKey && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10 shrink-0">
                          {effectiveKey}
                        </span>
                      )}
                    </div>
                  );
                })}
                {targetEvent.songCount > 3 && (
                  <div className="md:col-span-3 flex items-center">
                    <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">
                      + {targetEvent.songCount - 3} {t('dashboard.focus.moreSongs', 'músicas')}
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

        {/* Attention Items */}
        {attentionItems && attentionItems.length > 0 && (
          <div className="border-t border-slate-100 dark:border-white/[0.06] pt-5">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              {t('dashboard.focus.attentionEyebrow', 'Requer atenção')}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
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
                  <li key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400">
                    {icon}
                    <span>{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Actions Button Bar */}
        <div className="border-t border-slate-100 dark:border-white/[0.06] pt-5 flex flex-col sm:flex-row gap-3">
          {currentMode === 'assigned-event' && (
            <>
              {showPerformance ? (
                <Button onClick={() => onOpenPerformance(targetEvent)} className="w-full sm:w-auto" variant="primary">
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  {t('dashboard.focus.enterPerformance', 'Entrar no Modo Performance')}
                </Button>
              ) : (
                <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto" variant="primary">
                  {t('dashboard.focus.openRepertoire', 'Abrir repertório')}
                </Button>
              )}
              {showPerformance && (
                <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto" variant="secondary">
                  {t('dashboard.focus.viewScaleDetails', 'Ver detalhes da escala')}
                </Button>
              )}
            </>
          )}

          {currentMode === 'leader-attention' && (
            <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto" variant="primary">
              {t('dashboard.focus.resolveIssues', 'Resolver pendências')}
            </Button>
          )}

          {currentMode === 'leader-prepared' && (
            <>
              {showPerformance ? (
                <Button onClick={() => onOpenPerformance(targetEvent)} className="w-full sm:w-auto" variant="primary">
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  {t('dashboard.focus.enterPerformance', 'Entrar no Modo Performance')}
                </Button>
              ) : (
                <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto" variant="primary">
                  {t('dashboard.focus.openScale', 'Abrir escala')}
                </Button>
              )}
              {showPerformance && (
                <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto" variant="secondary">
                  {t('dashboard.focus.viewScaleDetails', 'Ver detalhes da escala')}
                </Button>
              )}
            </>
          )}

          {currentMode === 'observer-event' && (
            <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto" variant="primary">
              {t('dashboard.focus.viewDetails', 'Ver detalhes')}
            </Button>
          )}

          {currentMode === 'continue-draft' && (
            <Button onClick={() => onOpenEvent(targetEvent)} className="w-full sm:w-auto" variant="primary">
              {t('dashboard.focus.continuePreparing', 'Continuar preparando')}
            </Button>
          )}
        </div>

        {/* Response Actions Container */}
        {responseActions && (
          <div className="border-t border-slate-100 dark:border-white/[0.06] pt-5">
            {responseActions}
          </div>
        )}
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
    <Card className="p-6 sm:p-8 bg-white dark:bg-[#101014] border border-slate-200 dark:border-white/[0.08] shadow-sm relative overflow-hidden">
      {content}
    </Card>
  );
};
