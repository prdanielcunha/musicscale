import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { removeUndefinedValues } from '../lib/BaseRepository';
import type { Song } from '../types';
import { medleyRepertoireRepairPatch, type MedleyRepertoireDraft } from '../utils/medleyRepertoireSong';

const canonicalId = async (organizationId: string, arrangementId: string) => {
  // The same arrangement has one identity even when multiple authorized users save it.
  const bytes = new TextEncoder().encode(organizationId + '\u0000' + arrangementId);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'medley_' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 40);
};

/** Tenant-scoped atomic create/repair; no title-based matching or global write. */
export async function upsertMedleyRepertoireSong({
  organizationId, userId, displayName, photoURL, draft, existingId,
}: {
  organizationId: string;
  userId: string;
  displayName?: string | null;
  photoURL?: string | null;
  draft: MedleyRepertoireDraft;
  existingId?: string;
}): Promise<{ id: string; created: boolean; changed: boolean }> {
  const arrangementId = draft.metadata?.medley?.arrangementId;
  if (!organizationId || !userId || !arrangementId ||
      auth.currentUser?.uid !== userId || draft.sourceType !== 'medley') {
    throw new Error('MEDLEY_INVALID_CONTEXT');
  }
  const id = existingId || await canonicalId(organizationId, arrangementId);
  const ref = doc(db, 'songs', id);
  const actor = { uid: userId, displayName: displayName || null, photoURL: photoURL || null };

  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (auth.currentUser?.uid !== userId) throw new Error('MEDLEY_USER_CHANGED');
    if (snapshot.exists()) {
      const song = { ...snapshot.data(), id: snapshot.id } as Song;
      if (song.organizationId !== organizationId || song.sourceType !== 'medley' ||
          song.metadata?.medley?.arrangementId !== arrangementId) {
        throw new Error('MEDLEY_IDENTITY_CONFLICT');
      }
      const patch = medleyRepertoireRepairPatch(song, draft);
      if (!patch) return { id, created: false, changed: false };
      transaction.update(ref, removeUndefinedValues({
        ...patch, lastModifiedAt: serverTimestamp(), lastModifiedBy: actor,
      }));
      const audit = doc(collection(db, 'audits'));
      transaction.set(audit, {
        action: 'UPDATE', targetCollection: 'songs', targetId: id,
        details: { generatedMedleyRepair: true },
        organizationId, user: actor, timestamp: serverTimestamp(),
      });
      return { id, created: false, changed: true };
    }
    // Never resurrect a manually deleted existing song by treating it as new.
    if (existingId) throw new Error('MEDLEY_REPAIR_TARGET_MISSING');
    transaction.set(ref, removeUndefinedValues({
      ...draft, organizationId, createdBy: actor, createdAt: serverTimestamp(),
    }));
    const audit = doc(collection(db, 'audits'));
    transaction.set(audit, {
      action: 'CREATE', targetCollection: 'songs', targetId: id,
      details: { generatedMedley: true },
      organizationId, user: actor, timestamp: serverTimestamp(),
    });
    return { id, created: true, changed: true };
  });
}
