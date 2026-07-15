import { db } from "./firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export interface FeedbackData {
  type: 'bug' | 'idea' | 'experience' | 'rating';
  message?: string;
  rating?: 'positive' | 'negative' | 'neutral';
  context?: string;
  metadata?: Record<string, any>;
}

export const submitFeedback = async (
  userId: string | undefined,
  organizationId: string | undefined,
  data: FeedbackData
) => {
  const systemInfo = {
    userAgent: navigator.userAgent,
    route: window.location.pathname,
    screen: `${window.screen.width}x${window.screen.height}`,
    language: navigator.language,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    connection: (navigator as any).connection ? (navigator as any).connection.effectiveType : 'unknown',
  };

  const payload = {
    userId: userId || 'anonymous',
    organizationId: organizationId || 'none',
    timestamp: serverTimestamp(),
    systemInfo,
    status: 'new',
    ...data
  };

  // We write to a root "feedbacks" collection so the system owner can easily review all global feedback
  await addDoc(collection(db, "feedbacks"), payload);
};
