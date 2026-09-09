import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  PreparationSnapshot,
  StoredPreparationState,
} from '../utils/preparationIntelligence';

const COLLECTION_NAME = 'musicscalePreparation';

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return typeof millis === 'number' && Number.isFinite(millis) ? millis : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function scopedDocumentId(organizationId: string, scaleId: string): string {
  return `${encodeURIComponent(organizationId)}__${encodeURIComponent(scaleId)}`;
}

function deserializeState(data: any): StoredPreparationState | null {
  if (
    !data ||
    typeof data.organizationId !== 'string' ||
    typeof data.scaleId !== 'string' ||
    typeof data.acknowledgedFingerprint !== 'string' ||
    !data.acknowledgedSnapshot
  ) {
    return null;
  }

  return {
    organizationId: data.organizationId,
    scaleId: data.scaleId,
    acknowledgedFingerprint: data.acknowledgedFingerprint,
    acknowledgedSnapshot: data.acknowledgedSnapshot as PreparationSnapshot,
    preparedFingerprint:
      typeof data.preparedFingerprint === 'string'
        ? data.preparedFingerprint
        : null,
    acknowledgedAtMs: toMillis(data.acknowledgedAt),
    preparedAtMs: toMillis(data.preparedAt),
  };
}

export async function listPreparationStates(
  userId: string,
  organizationId: string
): Promise<StoredPreparationState[]> {
  const ref = collection(db, 'users', userId, COLLECTION_NAME);
  const snapshot = await getDocs(
    query(ref, where('organizationId', '==', organizationId))
  );

  return snapshot.docs
    .map(document => deserializeState(document.data()))
    .filter((state): state is StoredPreparationState => state !== null);
}

export async function ensurePreparationBaseline(
  userId: string,
  organizationId: string,
  snapshot: PreparationSnapshot
): Promise<void> {
  const ref = doc(
    db,
    'users',
    userId,
    COLLECTION_NAME,
    scopedDocumentId(organizationId, snapshot.scaleId)
  );

  await setDoc(
    ref,
    {
      organizationId,
      scaleId: snapshot.scaleId,
      acknowledgedFingerprint: snapshot.fingerprint,
      acknowledgedSnapshot: snapshot,
      preparedFingerprint: null,
      acknowledgedAt: serverTimestamp(),
      preparedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: false }
  );
}

export async function acknowledgePreparationChanges(
  userId: string,
  organizationId: string,
  snapshot: PreparationSnapshot
): Promise<void> {
  const ref = doc(
    db,
    'users',
    userId,
    COLLECTION_NAME,
    scopedDocumentId(organizationId, snapshot.scaleId)
  );

  await setDoc(
    ref,
    {
      organizationId,
      scaleId: snapshot.scaleId,
      acknowledgedFingerprint: snapshot.fingerprint,
      acknowledgedSnapshot: snapshot,
      acknowledgedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function markPreparationReady(
  userId: string,
  organizationId: string,
  snapshot: PreparationSnapshot
): Promise<void> {
  const ref = doc(
    db,
    'users',
    userId,
    COLLECTION_NAME,
    scopedDocumentId(organizationId, snapshot.scaleId)
  );

  await setDoc(
    ref,
    {
      organizationId,
      scaleId: snapshot.scaleId,
      acknowledgedFingerprint: snapshot.fingerprint,
      acknowledgedSnapshot: snapshot,
      preparedFingerprint: snapshot.fingerprint,
      acknowledgedAt: serverTimestamp(),
      preparedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
