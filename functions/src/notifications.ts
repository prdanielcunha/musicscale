import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();

interface NotificationPayload {
  recipientId: string;
  type: 'band_scale' | 'scale' | 'suggestion' | 'system';
  title: string;
  message: string;
  link: string;
  metadata?: Record<string, any>;
}

interface NormalizedAssignment {
  userId: string;
  instrumentId: string | null;
}

export function generateDeterministicId(orgId: string, eventType: string, eventId: string, recipientId: string, extra?: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${orgId}|${eventType}|${eventId}|${recipientId}|${extra || ''}`);
  return hash.digest('hex');
}

function normalizeAssignment(raw: any): NormalizedAssignment | null {
  if (!raw) return null;
  
  // Format A: { userId, instrumentId }
  if (typeof raw.userId === 'string' && raw.userId.trim() !== '') {
    return {
      userId: raw.userId,
      instrumentId: typeof raw.instrumentId === 'string' ? raw.instrumentId : null
    };
  }
  
  // Format B: { user: { uid }, instrument?: { id } }
  if (raw.user && typeof raw.user.uid === 'string' && raw.user.uid.trim() !== '') {
    return {
      userId: raw.user.uid,
      instrumentId: (raw.instrument && typeof raw.instrument.id === 'string') ? raw.instrument.id : null
    };
  }
  
  return null;
}

async function createNotification(orgId: string, payload: NotificationPayload, eventId: string, instrumentId?: string | null) {
  const docId = generateDeterministicId(orgId, payload.type, eventId, payload.recipientId, instrumentId || '');
  try {
    const docRef = db.doc(`organizations/${orgId}/notifications/${docId}`);
    
    logger.info("Attempting to create notification", {
      scaleId: eventId,
      normalizedAssignmentUserId: payload.recipientId,
      resolvedRecipientAuthUid: payload.recipientId, // It is the same
      instrumentId: instrumentId || null,
      notificationId: docId,
      action: 'created',
      skipReason: null
    });

    await docRef.create({
      ...payload,
      isRead: false,
      isArchived: false,
      createdAt: FieldValue.serverTimestamp(),
      sourceEventId: eventId,
      organizationId: orgId,
      idempotencyKey: docId
    });
    logger.info(`Notification created with deterministic ID ${docId} for user ${payload.recipientId} in org ${orgId}`);
  } catch (err: any) {
    if (err.code === 6 || err.message?.includes('ALREADY_EXISTS')) { // grpc status 6: ALREADY_EXISTS
      logger.info(`Idempotent write matched. Notification ${payload.recipientId} already processed for event ${eventId}`, {
        scaleId: eventId,
        normalizedAssignmentUserId: payload.recipientId,
        resolvedRecipientAuthUid: payload.recipientId,
        instrumentId: instrumentId || null,
        notificationId: docId,
        action: 'already_exists',
        skipReason: 'already_exists'
      });
      return;
    }
    logger.error('Failed to create notification', { orgId, payload, err });
  }
}

const instrumentCache = new Map<string, string>();

async function getInstrumentName(instrumentId: string | null): Promise<string> {
  if (!instrumentId) return 'sua função';
  if (instrumentCache.has(instrumentId)) {
    return instrumentCache.get(instrumentId)!;
  }
  
  try {
    const instSnap = await db.collection('instruments').doc(instrumentId).get();
    if (instSnap.exists) {
      const name = instSnap.data()?.name || 'sua função';
      instrumentCache.set(instrumentId, name);
      return name;
    }
  } catch (err) {
    logger.error(`Error fetching instrument ${instrumentId}`, err);
  }
  return 'sua função';
}

const DEPLOY_VERSION = process.env.GITHUB_SHA || 'local';

export const onBandScaleWritten = onDocumentWritten(
  {
    document: 'bandScales/{scaleId}',
    region: 'us-east1',
    retry: true,
  },
  async (event) => {
    // Deprecated: Escala de Música is the canonical source of events.
    // BandScale isolated save/edit no longer triggers notifications.
    return;
  }
);

export const onSuggestionCreated = onDocumentCreated(
  {
    document: 'suggestions/{suggestionId}',
    region: 'us-east1',
    retry: true,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const suggestionData = snap.data();
    const orgId = suggestionData.organizationId;
    if (!orgId) return;

    const creatorName = suggestionData.createdBy?.name || suggestionData.createdBy?.displayName || 'Alguém';
    const songsCount = suggestionData.songs?.length || 0;
    
    // Find admins to notify
    const usersSnap = await db.collection('users')
      .where('organizationId', '==', orgId)
      .where('role', 'in', ['Administrador', 'Dono'])
      .get();

    for (const doc of usersSnap.docs) {
      await createNotification(orgId, {
        recipientId: doc.id,
        type: 'suggestion',
        title: 'Nova Indicação de Música',
        message: `${creatorName} indicou ${songsCount} música(s) para o repertório.`,
        link: `/suggestions`,
        metadata: {
          suggestionId: event.params.suggestionId
        }
      }, event.params.suggestionId);
    }
  }
);
