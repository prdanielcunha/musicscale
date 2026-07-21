import { onDocumentWritten, onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';

if (getApps().length === 0) {
  initializeApp();
}

export interface NotificationDependencies {
  db: any;
  logger: any;
  serverTimestamp: any;
}

export interface NotificationPayload {
  recipientId: string;
  type: 'band_scale' | 'scale' | 'suggestion' | 'system';
  title: string;
  message: string;
  link: string;
  metadata?: Record<string, any>;
}

export function generateDeterministicId(orgId: string, eventType: string, eventId: string, recipientId: string, extra?: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${orgId}|${eventType}|${eventId}|${recipientId}|${extra || ''}`);
  return hash.digest('hex');
}

export async function createNotificationWithDependencies(
  deps: NotificationDependencies,
  orgId: string, 
  payload: NotificationPayload, 
  eventId: string, 
  instrumentId?: string | null
) {
  const { db, logger, serverTimestamp } = deps;
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
      createdAt: serverTimestamp(),
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
    throw err;
  }
}

export async function processBandScaleWrittenNotification(
  deps: NotificationDependencies,
  event: any
) {
  // Deprecated: Escala de Música is the canonical source of events.
  // BandScale isolated save/edit no longer triggers notifications.
  return;
}

export async function processSuggestionCreatedNotification(
  deps: NotificationDependencies,
  event: any
) {
  const { db } = deps;
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
    await createNotificationWithDependencies(deps, orgId, {
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

const DEPLOY_VERSION = process.env.GITHUB_SHA || 'local';

export const onBandScaleWritten = onDocumentWritten(
  {
    document: 'bandScales/{scaleId}',
    region: 'us-east1',
    retry: true,
  },
  async (event) => {
    return processBandScaleWrittenNotification({
      db: getFirestore(),
      logger,
      serverTimestamp: FieldValue.serverTimestamp
    }, event);
  }
);

export const onSuggestionCreated = onDocumentCreated(
  {
    document: 'suggestions/{suggestionId}',
    region: 'us-east1',
    retry: true,
  },
  async (event) => {
    return processSuggestionCreatedNotification({
      db: getFirestore(),
      logger,
      serverTimestamp: FieldValue.serverTimestamp
    }, event);
  }
);
