import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { useTranslation } from "react-i18next";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";
import { shouldWaitForStartupQuietWindow, waitForStartupQuietWindow } from "../lib/startupWorkScheduler";

export interface Notification {
  id: string;
  recipientId: string;
  type: "band_scale" | "scale" | "suggestion" | "system" | "music_scale_assignment" | "music_scale_published" | "music_scale_changed" | "music_scale_cancelled";
  title: string;
  message: string;
  link: string;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  isArchived: boolean;
  createdAt: { toMillis?: () => number } | string | number | null;
  readAt?: { toMillis?: () => number };
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archiveNotification: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const getCreatedAtMillis = (createdAt: Notification["createdAt"]): number | null => {
  if (!createdAt) return null;
  if (typeof createdAt === "number") return Number.isFinite(createdAt) ? createdAt : null;
  if (typeof createdAt === "string") {
    const parsed = Date.parse(createdAt);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof createdAt.toMillis === "function") {
    const millis = createdAt.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, organization } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [, setInitialLoadComplete] = useState(false);
  const isFirstLoadRef = useRef(true);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const listenerStartedAtRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    setNotifications([]);
    setInitialLoadComplete(false);
    isFirstLoadRef.current = true;
    seenNotificationIdsRef.current = new Set();
    listenerStartedAtRef.current = 0;

    if (!user || !organization?.id) {
      return () => {
        mounted = false;
      };
    }

    const organizationId = organization.id;
    const userId = user.uid;

    const attachListener = () => {
      if (!mounted) return;

      listenerStartedAtRef.current = Date.now();
      const q = query(
        collection(db, `organizations/${organizationId}/notifications`),
        where("recipientId", "==", userId),
        where("isArchived", "==", false)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        if (!mounted) return;

        const notifs: Notification[] = [];
        const newNotifs: Notification[] = [];
        const currentIds = new Set<string>();

        snapshot.forEach((snapshotDoc) => {
          const data = { id: snapshotDoc.id, ...snapshotDoc.data() } as Notification;
          notifs.push(data);
          currentIds.add(snapshotDoc.id);
        });

        if (!isFirstLoadRef.current) {
          snapshot.docChanges().forEach((change) => {
            if (change.type !== "added") return;

            const data = { id: change.doc.id, ...change.doc.data() } as Notification;
            const createdAtMillis = getCreatedAtMillis(data.createdAt);
            const isFresh = createdAtMillis !== null && createdAtMillis >= listenerStartedAtRef.current - 15000;
            const wasAlreadySeen = seenNotificationIdsRef.current.has(data.id);

            if (!wasAlreadySeen && !data.isRead && isFresh) {
              newNotifs.push(data);
            }
          });
        }

        currentIds.forEach((id) => seenNotificationIdsRef.current.add(id));

        notifs.sort((a, b) => {
          const timeA = getCreatedAtMillis(a.createdAt) || 0;
          const timeB = getCreatedAtMillis(b.createdAt) || 0;
          return timeB - timeA;
        });

        setNotifications(notifs);

        if (!isFirstLoadRef.current) {
          newNotifs.forEach((notif) => {
            let localizedTitle = notif.title;
            let localizedMessage = notif.message;

            if (notif.type === 'music_scale_assignment') {
              if (i18n.language.startsWith('en')) {
                localizedTitle = "You have been scheduled!";
              } else if (i18n.language.startsWith('es')) {
                localizedTitle = "¡Has sido programado!";
              } else {
                localizedTitle = notif.title.replace(' tocar Sua função', '').replace('Sua função', '').trim() || 'Você foi escalado!';
              }
              localizedMessage = t('notifications.newScalePublished', 'Uma nova escala de música foi publicada.');
            } else if (notif.type === 'music_scale_changed') {
              localizedTitle = t(
                'notifications.scaleChangedTitle',
                'Sua escala mudou'
              );
              localizedMessage = t(
                'notifications.scaleChangedDescription',
                'Repertório, tom, função ou detalhes da escala foram atualizados. Veja exatamente o que mudou.'
              );
            } else if (notif.type === 'band_scale' && notif.metadata?.action === 'role_changed') {
              const parts = notif.message.split('como ');
              const role = parts.length > 1 ? parts[1].replace('.', '') : "";

              if (i18n.language.startsWith('en')) {
                localizedTitle = "Your role in the scale has been changed";
                localizedMessage = `You are now scheduled as ${role}.`;
              } else if (i18n.language.startsWith('es')) {
                localizedTitle = "Su función en la escala ha sido modificada";
                localizedMessage = `Ahora estás programado como ${role}.`;
              }
            }

            toast({
              id: `notification:${notif.id}`,
              type: "feedback",
              message: localizedTitle,
              description: localizedMessage,
              duration: 5000,
            });
          });
        }

        setInitialLoadComplete(true);
        isFirstLoadRef.current = false;
      }, (error) => {
        if (!mounted) return;
        console.error("Error listening to notifications:", {
          organizationId,
          authenticatedUid: userId,
          errorCode: error.code,
          errorMessage: error.message
        });
      });
    };

    // Preserve synchronous listener setup whenever no deferral is required
    // (desktop, test, SSR, or after the one-time startup quiet window). On a
    // real cold mobile start, attach only after first operational paint/idle.
    if (shouldWaitForStartupQuietWindow()) {
      void waitForStartupQuietWindow().then(attachListener);
    } else {
      attachListener();
    }

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [user, organization?.id, toast, i18n.language]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id: string) => {
    if (!organization?.id) return;
    try {
      const ref = doc(db, `organizations/${organization.id}/notifications`, id);
      await updateDoc(ref, {
        isRead: true,
        readAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Error marking as read", e);
    }
  };

  const markAsUnread = async (id: string) => {
    if (!organization?.id) return;
    try {
      const ref = doc(db, `organizations/${organization.id}/notifications`, id);
      await updateDoc(ref, {
        isRead: false,
        readAt: null,
      });
    } catch (e) {
      console.error("Error marking as unread", e);
    }
  };

  const markAllAsRead = async () => {
    if (!organization?.id) return;
    const unread = notifications.filter((n) => !n.isRead);
    for (const notif of unread) {
      await markAsRead(notif.id);
    }
  };

  const archiveNotification = async (id: string) => {
    if (!organization?.id) return;
    try {
      const ref = doc(db, `organizations/${organization.id}/notifications`, id);
      await updateDoc(ref, {
        isArchived: true,
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("Error archiving notification", e);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!organization?.id) return;
    try {
      const ref = doc(db, `organizations/${organization.id}/notifications`, id);
      await updateDoc(ref, {
        isArchived: true,
        archivedAt: new Date().toISOString(),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("Error deleting notification", e);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        archiveNotification,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
