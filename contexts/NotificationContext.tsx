import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from "react";
import { useTranslation } from "react-i18next";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

export interface Notification {
  id: string;
  recipientId: string;
  type: "band_scale" | "scale" | "suggestion" | "system" | "music_scale_assignment" | "music_scale_published" | "music_scale_changed" | "music_scale_cancelled";
  title: string;
  message: string;
  link: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  isArchived: boolean;
  createdAt: any;
  readAt?: any;
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

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, organization } = useAuth();
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    if (!user || !organization?.id) {
      setNotifications([]);
      setInitialLoadComplete(false);
      isFirstLoadRef.current = true;
      return;
    }

    const q = query(
      collection(db, `organizations/${organization.id}/notifications`),
      where("recipientId", "==", user.uid),
      where("isArchived", "==", false)
      // Note: We don't order by createdAt here if we don't have a composite index, 
      // we'll sort in memory.
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = [];
      const newNotifs: Notification[] = [];
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const data = { id: change.doc.id, ...change.doc.data() } as Notification;
          if (!isFirstLoadRef.current && !data.isRead) {
            newNotifs.push(data);
          }
        }
      });

      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() } as Notification);
      });

      // Sort by createdAt descending
      notifs.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setNotifications(notifs);

      // Show toast for newly arriving notifications
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
            localizedTitle = t('notifications.scaleUpdated', 'Escala de Músicas Atualizada');
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
      console.error("Error listening to notifications:", {
        organizationId: organization.id,
        authenticatedUid: user.uid,
        errorCode: error.code,
        errorMessage: error.message
      });
    });

    return () => unsubscribe();
  }, [user, organization?.id, toast]);

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
      // Optimistic update
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error("Error archiving notification", e);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!organization?.id) return;
    try {
      const ref = doc(db, `organizations/${organization.id}/notifications`, id);
      await deleteDoc(ref);
      // Optimistic update
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
