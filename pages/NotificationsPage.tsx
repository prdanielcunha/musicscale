import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR, es, enUS } from "date-fns/locale";
import { Bell, Check, Trash2, ArrowLeft, Mail, Share2, Square, CheckSquare } from "lucide-react";
import { useNotifications, Notification } from "../contexts/NotificationContext";
import { useMusic } from "../contexts/MusicDataContext";
import { useToast } from "../contexts/ToastContext";
import ScaleNotificationDetailModal from "../components/scales/ScaleNotificationDetailModal";

const NotificationsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { notifications, markAsRead, markAsUnread, markAllAsRead, deleteNotification, unreadCount } = useNotifications();
  const { populatedScales, populatedBandScales } = useMusic();
  const { toast } = useToast();

  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const getLocale = () => {
    switch (i18n.language) {
      case "pt": return ptBR;
      case "es": return es;
      default: return enUS;
    }
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return "";
    let date = dateValue;
    if (typeof dateValue.toDate === "function") {
      date = dateValue.toDate();
    } else if (typeof dateValue === "string") {
      date = new Date(dateValue);
    }

    if (i18n.language.startsWith('en')) {
      return format(date, "MMM dd, yyyy, HH:mm", { locale: getLocale() });
    }
    return format(date, "dd MMM yyyy, HH:mm", { locale: getLocale() });
  };

  const formatEventDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);

    if (i18n.language.startsWith('en')) {
      return format(date, "EEEE, MMMM do", { locale: getLocale() });
    }
    return format(date, "EEEE, dd 'de' MMMM", { locale: getLocale() });
  };

  const findScaleForNotification = (notification: Notification) => {
    const scaleId = notification.metadata?.scaleId || notification.metadata?.musicScaleId;
    if (!scaleId) return null;

    const musicScale = populatedScales.find(s => s.id === scaleId);
    if (musicScale) return musicScale;

    const bandScale = populatedBandScales.find(b => b.id === scaleId);
    if (bandScale) return bandScale;

    const linkedBandScale = populatedBandScales.find(b => b.musicScaleId === scaleId);
    if (linkedBandScale) return linkedBandScale;

    return null;
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setSelectedNotification(notification);
    setIsDetailModalOpen(true);
  };

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => setSelectedIds(notifications.map(n => n.id));
  const selectNone = () => setSelectedIds([]);

  const handleBulkAction = async (action: 'read' | 'unread' | 'delete') => {
    for (const id of selectedIds) {
      if (action === 'read') await markAsRead(id);
      if (action === 'unread') await markAsUnread(id);
      if (action === 'delete') await deleteNotification(id);
    }
    if (action === 'delete') {
      setSelectedIds([]);
    }
  };

  const handleShare = async (notification: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    const scale = findScaleForNotification(notification);
    if (!scale) {
      toast({ title: t('notifications.cannotShare', 'Esta notificação não possui uma escala vinculada para compartilhar.'), type: 'error' });
      return;
    }

    const url = `${window.location.origin}/scales/${scale.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: (scale as any).title || scale.eventName || 'Escala',
          text: t('notifications.shareText', 'Confira esta escala:'),
          url
        });
      } catch (err) {
        console.error("Error sharing", err);
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: t('notifications.linkCopied', 'Link copiado para a área de transferência') });
    }
  };

  const activeScale = selectedNotification ? findScaleForNotification(selectedNotification) : null;

  const getLocalizedTitle = (notif: Notification) => {
    if (i18n.language.startsWith('en')) {
      if (notif.type === 'music_scale_assignment') return "You have been scheduled!";
      if (notif.type === 'music_scale_changed') return "Music Scale Updated";
      if (notif.type === 'music_scale_cancelled') return "Music Scale Cancelled";
      if (notif.type === 'music_scale_published') return "Music Scale Published";
      if (notif.type === 'band_scale' && notif.metadata?.action === 'role_changed') return "Your role in the scale has been changed";
    } else if (i18n.language.startsWith('es')) {
      if (notif.type === 'music_scale_assignment') return "¡Has sido programado!";
      if (notif.type === 'music_scale_changed') return "Escala Musical Actualizada";
      if (notif.type === 'music_scale_cancelled') return "Escala Musical Cancelada";
      if (notif.type === 'music_scale_published') return "Escala Musical Publicada";
      if (notif.type === 'band_scale' && notif.metadata?.action === 'role_changed') return "Su función en la escala ha sido modificada";
    }

    // In PT, use the server-generated title (which is already formatted correctly with 'tocar', 'cantar', etc)
    if (notif.type === 'music_scale_assignment' && notif.title) {
      return notif.title.replace(' tocar Sua função', '').replace('Sua função', '').trim() || 'Você foi escalado!';
    }
    if (notif.type === 'music_scale_cancelled' && !notif.title) return "Escala Cancelada";
    if (notif.type === 'music_scale_published' && !notif.title) return "Escala Publicada";
    if (notif.type === 'music_scale_changed' && !notif.title) return "Escala Alterada";

    return notif.title || '';
  };

  const getLocalizedMessage = (notif: Notification) => {
    if (notif.type === 'band_scale' && notif.metadata?.action === 'role_changed') {
      const parts = notif.message.split('como ');
      const role = parts.length > 1 ? parts[1].replace('.', '') : "";
      if (i18n.language.startsWith('en')) {
        return `You are now scheduled as ${role}.`;
      } else if (i18n.language.startsWith('es')) {
        return `Ahora estás programado como ${role}.`;
      }
      return notif.message;
    }
    if (['music_scale_assignment', 'music_scale_changed', 'music_scale_cancelled', 'music_scale_published'].includes(notif.type || '')) {
      const scale = findScaleForNotification(notif);
      if (scale) {
        const datePart = formatEventDate(scale.date);

        if (i18n.language.startsWith('en')) {
          const timePart = scale.time ? ` at ${scale.time}` : '';
          if (notif.type === 'music_scale_cancelled') return `The event on ${datePart}${timePart} has been cancelled.`;
          return `At the event on ${datePart}${timePart}.`;
        } else if (i18n.language.startsWith('es')) {
          const timePart = scale.time ? ` a las ${scale.time}` : '';
          if (notif.type === 'music_scale_cancelled') return `El evento del día ${datePart}${timePart} ha sido cancelado.`;
          return `En el evento del día ${datePart}${timePart}.`;
        }

        const timePart = scale.time ? ` às ${scale.time}` : '';
        if (notif.type === 'music_scale_cancelled') return `O evento do dia ${datePart}${timePart} foi cancelado.`;
        return `No evento do dia ${datePart}${timePart}.`;
      }
    }
    return notif.message;
  };

  return (
    <div className="ms-notifications-page w-full max-w-5xl mx-auto px-4 py-6 md:py-8 min-h-[100dvh]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="premium-interactive md:hidden -ml-2 flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-white/[0.05] hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            aria-label={t('common.back', 'Voltar')}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl" aria-hidden="true">
              <Bell className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{t('sidebar.notifications', 'Notificações')}</h1>
              <p className="text-sm text-slate-400" aria-live="polite">
                {unreadCount > 0
                  ? t('notifications.unreadCountMsg', 'Você tem {{count}} notificação não lida', { count: unreadCount, defaultValue_plural: 'Você tem {{count}} notificações não lidas' })
                  : t('notifications.noNewNotifications', "Nenhuma notificação nova")}
              </p>
            </div>
          </div>
        </div>

        {notifications.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4" role="toolbar" aria-label={t('notifications.actions', 'Ações de notificações')}>
            <button
              type="button"
              onClick={selectedIds.length === notifications.length ? selectNone : selectAll}
              className="premium-interactive mr-auto flex min-h-11 items-center gap-2 rounded-xl bg-slate-800 px-3 text-sm font-medium text-slate-300 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            >
              {selectedIds.length === notifications.length ? (
                <CheckSquare className="w-4 h-4 text-indigo-400" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {selectedIds.length === notifications.length ? t('notifications.selectNone', 'Desmarcar Todas') : t('notifications.selectAll', 'Selecionar Todas')}
            </button>

            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handleBulkAction('read')}
                  className="premium-interactive flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  title={t('notifications.markAsRead', 'Marcar como lida')}
                  aria-label={t('notifications.markAsRead', 'Marcar como lida')}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('unread')}
                  className="premium-interactive flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  title={t('notifications.scaleDetail.markUnread', 'Marcar como não lida')}
                  aria-label={t('notifications.scaleDetail.markUnread', 'Marcar como não lida')}
                >
                  <Mail className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction('delete')}
                  className="premium-interactive flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                  title={t('notifications.scaleDetail.delete', 'Excluir')}
                  aria-label={t('notifications.scaleDetail.delete', 'Excluir')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            {unreadCount > 0 && selectedIds.length === 0 && (
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="premium-interactive flex min-h-11 items-center gap-2 rounded-xl bg-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <Check className="w-4 h-4" />
                {t('notifications.markAllAsRead', 'Marcar todas como lidas')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
            <Bell className="w-12 h-12 text-slate-600 mb-4" aria-hidden="true" />
            <h3 className="text-lg font-medium text-slate-300">{t('notifications.emptyTitle', 'Caixa de entrada vazia')}</h3>
            <p className="text-slate-500 mt-1 max-w-sm">
              {t('notifications.emptyMessage', 'Você ainda não recebeu nenhuma notificação. Novas escalas e atualizações aparecerão aqui.')}
            </p>
          </div>
        ) : (
          notifications.map((notification) => {
            const isSelected = selectedIds.includes(notification.id);
            return (
              <div
                key={notification.id}
                data-testid={`notification-card-${notification.id}`}
                className={`group flex items-start gap-3 rounded-2xl border p-3 sm:gap-4 sm:p-4 transition-all ${
                  !notification.isRead
                    ? "bg-indigo-500/10 border-indigo-500/20 shadow-lg shadow-indigo-500/5"
                    : "bg-white/[0.03] border-white/5 hover:bg-white/[0.06]"
                } ${isSelected ? "ring-2 ring-indigo-500" : ""}`}
              >
                <button
                  type="button"
                  className="premium-interactive flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-white/[0.05] hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  onClick={(e) => toggleSelection(notification.id, e)}
                  aria-pressed={isSelected}
                  aria-label={isSelected ? t('notifications.deselectNotification', 'Desmarcar notificação') : t('notifications.selectNotification', 'Selecionar notificação')}
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>

                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  onClick={() => handleNotificationClick(notification)}
                  aria-label={`${getLocalizedTitle(notification)}. ${getLocalizedMessage(notification)}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {!notification.isRead && (
                      <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" aria-label={t('notifications.unread', 'Não lida')} />
                    )}
                    <h4 className={`font-medium truncate ${!notification.isRead ? "text-white" : "text-slate-300"}`}>
                      {getLocalizedTitle(notification)}
                    </h4>
                    <span className="text-xs text-slate-500 ml-auto shrink-0">
                      {formatDate(notification.createdAt)}
                    </span>
                  </div>
                  <p className={`text-sm ${!notification.isRead ? "text-slate-300" : "text-slate-400"} line-clamp-2`}>
                    {getLocalizedMessage(notification)}
                  </p>
                </button>

                <div className="flex shrink-0 items-center gap-1" role="group" aria-label={t('notifications.itemActions', 'Ações da notificação')}>
                  <button
                    type="button"
                    onClick={(e) => handleShare(notification, e)}
                    className="premium-interactive flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-indigo-400/10 hover:text-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    title={t('actions.share', 'Compartilhar')}
                    aria-label={t('actions.share', 'Compartilhar')}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  {notification.isRead ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsUnread(notification.id);
                      }}
                      className="premium-interactive flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-indigo-400/10 hover:text-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      title={t('notifications.scaleDetail.markUnread', 'Marcar como não lida')}
                      aria-label={t('notifications.scaleDetail.markUnread', 'Marcar como não lida')}
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                      className="premium-interactive flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-indigo-400/10 hover:text-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      title={t('notifications.markAsRead', 'Marcar como lida')}
                      aria-label={t('notifications.markAsRead', 'Marcar como lida')}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="premium-interactive flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-400/10 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                    title={t('notifications.scaleDetail.delete', 'Excluir')}
                    aria-label={t('notifications.scaleDetail.delete', 'Excluir')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ScaleNotificationDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        notification={selectedNotification}
        scale={activeScale}
      />
    </div>
  );
};

export default NotificationsPage;
