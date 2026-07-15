import { auth } from './firebase';

export type EmotionType = 'delight' | 'friction' | 'hesitation' | 'recovery' | 'abandonment';

interface EmotionEvent {
  type: EmotionType;
  context: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

class EmotionTelemetry {
  private sessionTimeline: EmotionEvent[] = [];
  private static instance: EmotionTelemetry;

  private constructor() {}

  static getInstance() {
    if (!EmotionTelemetry.instance) {
      EmotionTelemetry.instance = new EmotionTelemetry();
    }
    return EmotionTelemetry.instance;
  }

  track(type: EmotionType, context: string, metadata?: Record<string, any>) {
    const event: EmotionEvent = {
        type,
        context,
        metadata,
        timestamp: Date.now()
    };
    
    this.sessionTimeline.push(event);
    
    // In a real scenario, this would quietly sync with a backend using requestIdleCallback
    if ('requestIdleCallback' in window) {
       (window as any).requestIdleCallback(() => this.syncQuietly(event));
    } else {
       setTimeout(() => this.syncQuietly(event), 2000);
    }
  }

  private async syncQuietly(event: EmotionEvent) {
    try {
       const user = auth.currentUser;
       if (!user) return;
       
       await fetch('/api/telemetry/emotion', {
           method: 'POST',
           headers: {
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${await user.getIdToken()}`
           },
           body: JSON.stringify({ event, sessionId: this.getSessionId() }),
           keepalive: true // Ensure it sends even if navigating away
       });
    } catch (e) {
       // Silent fail - never blocks the user
    }
  }

  private getSessionId() {
      let sessionId = sessionStorage.getItem('ms_session_id');
      if (!sessionId) {
          sessionId = Math.random().toString(36).substr(2, 9);
          sessionStorage.setItem('ms_session_id', sessionId);
      }
      return sessionId;
  }
}

export const emotionTracker = EmotionTelemetry.getInstance();
