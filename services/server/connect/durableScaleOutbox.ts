import { randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { publishCanonicalScaleEventToConnect } from './canonicalScalePublishedEvent.js';

export type ConnectScaleTrigger = 'scale.published' | 'scale.presence_pending';
export type ConnectScaleReceiptOutbox = {
  schemaVersion: 1;
  state: 'pending' | 'processing' | 'complete' | 'needs_review';
  musicScaleId: string;
  publishRevision: number;
  triggers: ConnectScaleTrigger[];
  delivered: ConnectScaleTrigger[];
  attempts: number;
  leaseToken?: string;
  leaseUntil?: string;
  retryAt?: string;
  resultCode?: string;
};

/** Written alongside the scale and its idempotency receipt, never after commit. */
export function makeConnectScaleReceiptOutbox(input: {
  enabled: boolean; musicScaleId: string; publishRevision: number; createdResponseCount: number;
}): ConnectScaleReceiptOutbox | undefined {
  if (!input.enabled) return undefined;
  if (!input.musicScaleId || input.musicScaleId.length > 180 ||
      !Number.isSafeInteger(input.publishRevision) || input.publishRevision < 1) {
    throw new Error('CONNECT_OUTBOX_INVALID_CANONICAL_PUBLISH');
  }
  return {
    schemaVersion: 1, state: 'pending', musicScaleId: input.musicScaleId,
    publishRevision: input.publishRevision,
    triggers: input.createdResponseCount > 0
      ? ['scale.published', 'scale.presence_pending'] : ['scale.published'],
    delivered: [], attempts: 0,
  };
}

export function safeConnectOutboxScope(organizationId: string, targetsJson: string | undefined): boolean {
  if (!organizationId || organizationId.length > 180 || /[\\/\u0000-\u001f\u007f]/.test(organizationId) ||
      !targetsJson || targetsJson.length > 16000) return false;
  try {
    const parsed: unknown = JSON.parse(targetsJson);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return false;
    const entries = Object.entries(parsed);
    if (entries.length > 100 || !Object.hasOwn(parsed, organizationId)) return false;
    return entries.every(([id, value]) =>
      id.length > 0 && id.length <= 180 && !/[\\/\u0000-\u001f\u007f]/.test(id) &&
      !!value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).length === 2 &&
      typeof (value as { conversationId?: unknown }).conversationId === 'string' &&
      typeof (value as { recipientUid?: unknown }).recipientUid === 'string' &&
      ['conversationId', 'recipientUid'].every(key => {
        const field = (value as Record<string, unknown>)[key] as string;
        return field.length > 0 && field.length <= 180 && !/[\\/\u0000-\u001f\u007f]/.test(field);
      }));
  } catch { return false; }
}

function validMarker(value: unknown): value is ConnectScaleReceiptOutbox {
  const v = value as ConnectScaleReceiptOutbox;
  return !!v && v.schemaVersion === 1 &&
    ['pending', 'processing', 'complete', 'needs_review'].includes(v.state) &&
    typeof v.musicScaleId === 'string' && v.musicScaleId.length > 0 &&
    Number.isSafeInteger(v.publishRevision) && v.publishRevision > 0 &&
    Array.isArray(v.triggers) && v.triggers.length >= 1 && v.triggers.length <= 2 &&
    v.triggers.every(t => t === 'scale.published' || t === 'scale.presence_pending') &&
    Array.isArray(v.delivered) && v.delivered.every(t => v.triggers.includes(t)) &&
    Number.isInteger(v.attempts) && v.attempts >= 0 && v.attempts <= 3;
}

/**
 * Bounded opportunistic recovery. It reads ONLY existing private, organization-scoped
 * _commandReceipts from a server-approved target mapping. A crash between a
 * Connect 202 and receipt update may replay the identical event ID; Connect's
 * persistent event key deduplicates it. No WhatsApp, Meta or member notifications.
 *
 * This is not a scheduler. Complete unattended delivery requires a separately
 * authorized, protected periodic runner and live positive end-to-end proof.
 */
export async function recoverConnectScaleReceipts(options: {
  organizationId: string;
  enabled: boolean;
  signingSecret?: string;
  targetsJson?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  limit?: number;
  db?: ReturnType<typeof getFirestore>;
}): Promise<{ scanned: number; completed: number; review: number; pending: number }> {
  const counts = { scanned: 0, completed: 0, review: 0, pending: 0 };
  if (!options.enabled || !options.signingSecret || options.signingSecret.length < 32 ||
      !safeConnectOutboxScope(options.organizationId, options.targetsJson)) return counts;
  const db = options.db ?? getFirestore();
  const clock = options.now ?? Date.now;
  const limit = Math.max(1, Math.min(5, options.limit ?? 3));
  const receipts = db.collection('organizations').doc(options.organizationId).collection('_commandReceipts');
  // Single-field 'in' query: no collectionGroup scan, cross-tenant query,
  // composite index or new Firestore collection.
  const items = await receipts.where('connectOutbox.state', 'in', ['pending', 'processing']).limit(limit).get();
  for (const row of items.docs) {
    counts.scanned++;
    const token = randomUUID();
    const now = clock();
    const claimed = await db.runTransaction(async tx => {
      const snap = await tx.get(row.ref);
      const body = snap.data();
      const marker: unknown = body?.connectOutbox;
      if (!validMarker(marker) || (marker.state !== 'pending' && marker.state !== 'processing') ||
          body?.commandType !== 'musicScale.publish' ||
          body?.organizationId !== options.organizationId ||
          body?.entityId !== marker.musicScaleId ||
          body?.result?.version !== marker.publishRevision) return null;
      if ((marker.state === 'processing' && Date.parse(marker.leaseUntil ?? '') > now) ||
          Date.parse(marker.retryAt ?? '') > now) return null;
      if (marker.attempts >= 3) {
        tx.update(row.ref, { 'connectOutbox.state': 'needs_review', 'connectOutbox.resultCode': 'retry_limit' });
        return null;
      }
      tx.update(row.ref, {
        'connectOutbox.state': 'processing',
        'connectOutbox.leaseToken': token,
        'connectOutbox.leaseUntil': new Date(now + 30000).toISOString(),
        'connectOutbox.attempts': marker.attempts + 1,
      });
      return { ...marker, attempts: marker.attempts + 1 } as ConnectScaleReceiptOutbox;
    });
    if (!claimed) continue;

    const delivered = new Set(claimed.delivered);
    let code: 'accepted' | 'stale_or_superseded' | 'transport_unconfirmed' = 'accepted';
    try {
      for (const trigger of claimed.triggers) {
        if (delivered.has(trigger)) continue;
        const outcome = await publishCanonicalScaleEventToConnect({
          enabled: true, trigger, organizationId: options.organizationId,
          musicScaleId: claimed.musicScaleId, publishRevision: claimed.publishRevision,
          signingSecret: options.signingSecret, targetsJson: options.targetsJson,
          fetchImpl: options.fetchImpl, now: clock,
          loadCanonicalScale: async () => {
            const snapshot = await db.collection('scales').doc(claimed.musicScaleId).get();
            if (!snapshot.exists) return null;
            const data = snapshot.data() || {};
            return { organizationId: data.organizationId, status: data.status,
              publishRevision: data.publishRevision, updatedAt: data.updatedAt?.toDate?.() };
          },
        });
        if (outcome === 'accepted' || outcome === 'duplicate') delivered.add(trigger);
        else { code = outcome === 'stale_revision' ? 'stale_or_superseded' : 'transport_unconfirmed'; break; }
      }
    } catch { code = 'transport_unconfirmed'; }

    const finished = await db.runTransaction(async tx => {
      const current = await tx.get(row.ref);
      const marker: unknown = current.data()?.connectOutbox;
      if (!validMarker(marker) || marker.state !== 'processing' || marker.leaseToken !== token) return null;
      const complete = claimed.triggers.every(trigger => delivered.has(trigger));
      const review = !complete && (code === 'stale_or_superseded' || claimed.attempts >= 3);
      const state = complete ? 'complete' : review ? 'needs_review' : 'pending';
      tx.update(row.ref, {
        'connectOutbox.state': state,
        'connectOutbox.delivered': [...delivered],
        'connectOutbox.leaseToken': '',
        'connectOutbox.leaseUntil': '',
        'connectOutbox.retryAt': !complete && !review
          ? new Date(clock() + Math.min(3600000, 30000 * 2 ** claimed.attempts)).toISOString() : '',
        'connectOutbox.resultCode': complete ? 'accepted_by_connect' : code,
      });
      return state;
    });
    if (finished === 'complete') counts.completed++;
    else if (finished === 'needs_review') counts.review++;
    else if (finished === 'pending') counts.pending++;
  }
  return counts;
}
