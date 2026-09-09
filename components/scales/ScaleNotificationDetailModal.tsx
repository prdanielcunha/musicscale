import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Trash2, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Scale } from '../../types';
import { Notification, useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import AssignmentResponseActions from './AssignmentResponseActions';
import AddToCalendarButton from '../common/AddToCalendarButton';
import { useMusic } from '../../contexts/MusicDataContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  notification: Notification | null;
  scale: Scale | null;
}

export const ScaleNotificationDetailModal: React.FC<Props> = ({ isOpen, onClose, notification, scale }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { markAsUnread, deleteNotification } = useNotifications();
  const { songs, locations, eventTypes, eventNames } = useMusic();

  const userAssignments = useMemo(() => {
    if (!scale || !user || !scale.eventAssignments || !Array.isArray(scale.eventAssignments)) return [];
    return scale.eventAssignments.filter(a => a.userId === user?.uid && a.active !== false);
  }, [scale, user]);

  const functionsText = useMemo(() => {
    if (userAssignments.length === 0) return null;
    const names = Array.from(new Set(userAssignments.map(a => typeof a.functionName === 'string' ? a.functionName : '').filter(Boolean))) as string[];
    const formatter = new Intl.ListFormat(i18n.language, { style: 'long', type: 'conjunction' });
    return names.length > 0 ? formatter.format(names) : null;
  }, [userAssignments, i18n.language]);

  const headerTitle = useMemo(() => {
    if (!notification) return '';

    if (notification.type === 'music_scale_changed') {
      return t(
        'notifications.scaleDetail.changedTitle',
        'Sua escala mudou'
      );
    }

    if (userAssignments.length > 0) {
      const hasInstrument = userAssignments.some(a => a.functionCategory === 'musical_instrument');
      const hasVocal = userAssignments.some(a => a.functionCategory === 'vocal');
      const hasTech = userAssignments.some(a => a.functionCategory === 'technical');
      
      const funcText = functionsText || '';

      if (hasInstrument) {
        return t('notifications.scaleDetail.assignedInstrument', 'Você foi escalado para tocar {{functions}}', { functions: funcText });
      } else if (hasVocal) {
        return t('notifications.scaleDetail.assignedVocal', 'Você foi escalado para cantar no {{functions}}', { functions: funcText });
      } else if (hasTech) {
        return t('notifications.scaleDetail.assignedTechnical', 'Você foi escalado para servir no {{functions}}', { functions: funcText });
      } else {
        return t('notifications.scaleDetail.assignedGeneral', 'Você foi escalado como {{functions}}', { functions: funcText });
      }
    }
    
    return t('notifications.scaleDetail.assignedFallback', 'Você foi escalado para este evento');
  }, [notification, userAssignments, functionsText, t]);

  const eventName = useMemo(() => {
    if (!scale) return '';
    if (scale.title && typeof scale.title === 'string') return scale.title;
    
    // Fallback to eventName (EventName object or string)
    if (scale.eventName) {
      if (typeof scale.eventName === 'string') return scale.eventName;
      if (typeof scale.eventName === 'object') {
        const nameVal = (scale.eventName as any).name;
        if (typeof nameVal === 'string') return nameVal;
        if (nameVal && typeof nameVal === 'object' && 'name' in nameVal && typeof (nameVal as any).name === 'string') {
          return (nameVal as any).name;
        }
      }
    }
    
    // Fallback to eventType (EventType object or string)
    if (scale.eventType) {
      if (typeof scale.eventType === 'string') return scale.eventType;
      if (typeof scale.eventType === 'object') {
        const nameVal = (scale.eventType as any).name;
        if (typeof nameVal === 'string') return nameVal;
        if (nameVal && typeof nameVal === 'object' && 'name' in nameVal && typeof (nameVal as any).name === 'string') {
          return (nameVal as any).name;
        }
      }
    }
    
    return t('notifications.scaleDetail.organizationEvent', 'Evento da organização');
  }, [scale, t]);

  const formattedDate = useMemo(() => {
    if (!scale || !scale.date || typeof scale.date !== 'string') return '';
    try {
      const d = new Date(scale.date + 'T00:00:00');
      return new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
    } catch {
      return typeof scale.date === 'string' ? scale.date : '';
    }
  }, [scale, i18n.language]);
  
  const formattedTime = scale?.time;

  const eventStart = useMemo(() => {
    if (!scale || !scale.date) return undefined;
    return new Date(`${scale.date}T${scale.time || '00:00'}:00`);
  }, [scale]);

  const changeItems = useMemo(() => {
    if (notification?.type !== 'music_scale_changed') return [];

    const metadata = notification.metadata as Record<string, any> | undefined;
    const summary = metadata?.preparationChangeSummary as Record<string, any> | undefined;
    const items: string[] = [];

    const songName = (songId: unknown) => {
      if (typeof songId !== 'string') {
        return t('notifications.scaleDetail.changes.unknownSong', 'Música');
      }
      return songs.find(song => song.id === songId)?.title ||
        t('notifications.scaleDetail.changes.unknownSong', 'Música');
    };

    const locationName = (locationId: unknown) => {
      if (typeof locationId !== 'string') return '—';
      return locations.find(location => location.id === locationId)?.name || '—';
    };

    const eventName = (eventId: unknown) => {
      if (typeof eventId !== 'string') return '—';
      return eventNames.find(event => event.id === eventId)?.name ||
        eventTypes.find(event => event.id === eventId)?.name ||
        '—';
    };

    const formatDateValue = (value: unknown) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
      const date = new Date(`${value}T12:00:00`);
      if (Number.isNaN(date.getTime())) return value;
      return new Intl.DateTimeFormat(i18n.language, {
        day: '2-digit',
        month: 'short',
      }).format(date);
    };

    if (summary?.version === 1 && summary?.songs && summary?.event) {
      const added = Array.isArray(summary.songs.added) ? summary.songs.added : [];
      added.forEach((songId: unknown) => {
        items.push(t(
          'notifications.scaleDetail.changes.songAdded',
          '“{{song}}” foi adicionada.',
          { song: songName(songId) }
        ));
      });

      const removed = Array.isArray(summary.songs.removed) ? summary.songs.removed : [];
      removed.forEach((songId: unknown) => {
        items.push(t(
          'notifications.scaleDetail.changes.songRemoved',
          '“{{song}}” foi removida.',
          { song: songName(songId) }
        ));
      });

      const keyChanged = Array.isArray(summary.songs.keyChanged)
        ? summary.songs.keyChanged
        : [];
      keyChanged.forEach((change: any) => {
        items.push(t(
          'notifications.scaleDetail.changes.songKeyChanged',
          '“{{song}}”: tom {{from}} → {{to}}.',
          {
            song: songName(change?.songId),
            from: change?.from || '—',
            to: change?.to || '—',
          }
        ));
      });

      const bpmChanged = Array.isArray(summary.songs.bpmChanged)
        ? summary.songs.bpmChanged
        : [];
      bpmChanged.forEach((change: any) => {
        items.push(t(
          'notifications.scaleDetail.changes.songBpmChanged',
          '“{{song}}”: BPM {{from}} → {{to}}.',
          {
            song: songName(change?.songId),
            from: change?.from ?? '—',
            to: change?.to ?? '—',
          }
        ));
      });

      const reordered = Array.isArray(summary.songs.reordered)
        ? summary.songs.reordered
        : [];
      reordered.forEach((change: any) => {
        items.push(t(
          'notifications.scaleDetail.changes.songOrderChanged',
          '“{{song}}”: posição {{from}} → {{to}}.',
          {
            song: songName(change?.songId),
            from: change?.from,
            to: change?.to,
          }
        ));
      });

      if (summary.event.date) {
        items.push(t(
          'notifications.scaleDetail.changes.dateChanged',
          'Data: {{from}} → {{to}}.',
          {
            from: formatDateValue(summary.event.date.from),
            to: formatDateValue(summary.event.date.to),
          }
        ));
      }

      if (summary.event.time) {
        items.push(t(
          'notifications.scaleDetail.changes.timeChanged',
          'Horário: {{from}} → {{to}}.',
          {
            from: summary.event.time.from || '—',
            to: summary.event.time.to || '—',
          }
        ));
      }

      if (summary.event.locationId) {
        items.push(t(
          'notifications.scaleDetail.changes.locationChanged',
          'Local: {{from}} → {{to}}.',
          {
            from: locationName(summary.event.locationId.from),
            to: locationName(summary.event.locationId.to),
          }
        ));
      }

      if (summary.event.eventNameId || summary.event.eventTypeId) {
        const eventChange = summary.event.eventNameId || summary.event.eventTypeId;
        items.push(t(
          'notifications.scaleDetail.changes.eventChanged',
          'Evento: {{from}} → {{to}}.',
          {
            from: eventName(eventChange.from),
            to: eventName(eventChange.to),
          }
        ));
      }

      if (summary.event.durationMinutes) {
        items.push(t(
          'notifications.scaleDetail.changes.durationChanged',
          'Duração: {{from}} min → {{to}} min.',
          {
            from: summary.event.durationMinutes.from ?? '—',
            to: summary.event.durationMinutes.to ?? '—',
          }
        ));
      }

      if (summary.event.notesChanged) {
        items.push(t(
          'notifications.scaleDetail.changes.notesChanged',
          'As orientações da escala foram atualizadas.'
        ));
      }
    }

    if (metadata?.functionsChanged === true) {
      const previous = Array.isArray(metadata.previousFunctionNames)
        ? metadata.previousFunctionNames.filter(Boolean)
        : [];
      const current = Array.isArray(metadata.functionNames)
        ? metadata.functionNames.filter(Boolean)
        : [];
      const formatter = new Intl.ListFormat(i18n.language, {
        style: 'long',
        type: 'conjunction'
      });
      items.push(t(
        'notifications.scaleDetail.changes.roleChanged',
        'Sua função: {{from}} → {{to}}.',
        {
          from: previous.length ? formatter.format(previous) : '—',
          to: current.length ? formatter.format(current) : '—',
        }
      ));
    }

    return items;
  }, [notification, songs, locations, eventTypes, eventNames, i18n.language, t]);

  const formattedSentAt = useMemo(() => {
    if (!notification) return '';
    try {
      const d = new Date(notification.createdAt);
      const datePart = new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
      const timePart = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(d);
      return `${datePart}, ${timePart}`;
    } catch {
      return '';
    }
  }, [notification, i18n.language]);

  if (!isOpen || !notification) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full sm:max-w-[560px] max-h-[90dvh] flex flex-col bg-[#121214] sm:rounded-2xl rounded-t-3xl overflow-hidden shadow-2xl z-10 border border-white/[0.08]"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/[0.05]">
            <span className="text-sm font-bold text-slate-300 uppercase tracking-widest">
              {t('notifications.scaleDetail.header', 'Sua escala')}
            </span>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-full transition-colors"
              aria-label={t('notifications.scaleDetail.close', 'Fechar')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-8">
            {!scale ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                 <p className="text-slate-400 text-sm">
                   {t('notifications.scaleDetail.scaleUnavailable', 'Esta escala não está mais disponível.')}
                 </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Main Message & Event Title */}
                <div>
                  <h2 className="text-[22px] sm:text-[24px] font-bold text-white leading-tight mb-2">
                    {headerTitle}
                  </h2>
                  <h3 className="text-base sm:text-lg text-slate-300 font-medium">
                    {eventName}
                  </h3>
                </div>

                {notification.type === 'music_scale_changed' && changeItems.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.07] p-4 sm:p-5">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/[0.08]">
                        <RefreshCcw className="h-4 w-4 text-amber-300" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-100">
                          {t(
                            'notifications.scaleDetail.changes.title',
                            'O que mudou'
                          )}
                        </h4>
                        <p className="text-[11px] text-amber-200/60">
                          {t(
                            'notifications.scaleDetail.changes.subtitle',
                            'Revise antes de ensaiar ou ministrar.'
                          )}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {changeItems.map((item, index) => (
                        <li
                          key={`${index}-${item}`}
                          className="flex items-start gap-2 text-sm leading-relaxed text-amber-50/85"
                        >
                          <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-amber-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quick Info Card */}
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-2xl p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* When */}
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                        {t('notifications.scaleDetail.when', 'Quando')}
                      </h4>
                      <p className="text-sm font-medium text-slate-200 capitalize">
                        {formattedDate}
                      </p>
                      {formattedTime && (
                        <p className="text-sm text-slate-400">{formattedTime}</p>
                      )}
                    </div>

                    {/* Where */}
                    {(scale.location || scale.congregationName) && (
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          {t('notifications.scaleDetail.where', 'Onde')}
                        </h4>
                        <p className="text-sm font-medium text-slate-200 truncate">
                          {typeof scale.location === 'string' 
                            ? scale.location 
                            : (scale.location && typeof scale.location === 'object' && 'name' in scale.location && typeof (scale.location as any).name === 'string')
                              ? (scale.location as any).name
                              : (scale.congregationName && typeof scale.congregationName === 'string')
                                ? scale.congregationName
                                : ''}
                        </p>
                      </div>
                    )}

                    {/* Arrival */}
                    {scale.arrivalTime && (
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          {t('notifications.scaleDetail.arrival', 'Chegada')}
                        </h4>
                        <p className="text-sm font-medium text-slate-200">
                          {scale.arrivalTime}
                        </p>
                      </div>
                    )}

                    {/* Rehearsal */}
                    {scale.rehearsalTime && (
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          {t('notifications.scaleDetail.rehearsal', 'Ensaio')}
                        </h4>
                        <p className="text-sm font-medium text-slate-200">
                          {scale.rehearsalTime}
                        </p>
                      </div>
                    )}

                    {/* Your Role */}
                    {functionsText && (
                      <div className="sm:col-span-2">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          {t('notifications.scaleDetail.yourRole', 'Sua função')}
                        </h4>
                        <p className="text-sm font-medium text-slate-200">
                          {functionsText}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assignment Response Actions */}
                {scale.status === 'cancelled' ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                    <p className="text-sm font-semibold text-red-400">
                      {t('notifications.scaleDetail.cancelled', 'Este evento foi cancelado.')}
                    </p>
                  </div>
                ) : (
                  notification.type === 'music_scale_assignment' && userAssignments.length > 0 && (
                     <AssignmentResponseActions
                       musicScaleId={scale.id}
                       assignments={userAssignments}
                       eventStart={eventStart}
                     />
                  )
                )}

                {/* Primary Actions */}
                <div className="flex items-center gap-2 pt-2">
                   <button
                     onClick={() => {
                       onClose();
                       navigate(`/scales/${scale.id}`);
                     }}
                     className="flex-1 py-3 sm:py-2.5 px-4 bg-white text-black font-bold rounded-xl hover:bg-slate-200 transition-colors text-center text-sm"
                   >
                     {t('notifications.scaleDetail.viewFullScale', 'Ver escala completa')}
                   </button>
                   
                   {scale.status !== 'cancelled' && (
                     <AddToCalendarButton 
                       scale={scale} 
                       iconOnly={true}
                       alignY="top"
                       className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-white/[0.05] border border-white/[0.1] text-white rounded-xl hover:bg-white/[0.1] transition-colors flex-shrink-0"
                     />
                   )}

                   <button
                     onClick={async () => {
                       await markAsUnread(notification.id);
                       onClose();
                     }}
                     className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-white/[0.05] border border-white/[0.1] text-slate-300 hover:text-white rounded-xl hover:bg-white/[0.1] transition-colors flex-shrink-0"
                     title={t('notifications.scaleDetail.markUnread', 'Marcar como não lida')}
                   >
                     <Mail className="w-5 h-5 sm:w-4 sm:h-4" />
                   </button>

                   <button
                     onClick={async () => {
                       await deleteNotification(notification.id);
                       onClose();
                     }}
                     className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-white/[0.05] border border-white/[0.1] text-red-400 hover:text-red-300 rounded-xl hover:bg-white/[0.1] transition-colors flex-shrink-0"
                     title={t('notifications.scaleDetail.delete', 'Excluir')}
                   >
                     <Trash2 className="w-5 h-5 sm:w-4 sm:h-4" />
                   </button>
                </div>

                {/* Meta */}
                <div className="pt-6 text-center">
                  <p className="text-[11px] text-slate-500 font-medium">
                    {t('notifications.scaleDetail.sentAt', 'Enviada em {{date}}', { date: formattedSentAt })}
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ScaleNotificationDetailModal;
