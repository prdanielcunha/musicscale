import { logger } from '../lib/logger';

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
  query,
  orderBy,
  writeBatch,
  onSnapshot,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { createOrgQuery } from '../lib/firestore-utils';
import type { User, Suggestion, SuggestedSong } from '../types';

const suggestionsCollection = collection(db, 'suggestions');

const createCreatedBy = (user: User) => ({
  uid: user.uid,
  displayName: user.displayName,
  photoURL: user.photoURL,
});

const toISOString = (date: any): string | null => {
  if (!date) return null;
  if (date instanceof Timestamp) return date.toDate().toISOString();
  if (typeof date.toDate === 'function') return date.toDate().toISOString();
  return date;
};

export const getSuggestions = async (orgId: string): Promise<Suggestion[]> => {
    const q = createOrgQuery('suggestions', orgId);
    const snapshot = await getDocs(q);
    const suggestions = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            createdAt: toISOString(data.createdAt)!,
        } as Suggestion;
    });
    return suggestions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const onSuggestionsUpdate = (
    orgId: string,
    onUpdate: (suggestions: Suggestion[]) => void,
    onError: (error: Error) => void
): (() => void) => {
    try {
        const q = createOrgQuery('suggestions', orgId);
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const suggestions: Suggestion[] = snapshot.docs.map(doc => {
                const data = doc.data();
                // For pending writes from serverTimestamp(), createdAt is null. 
                // We use the current date as a temporary fallback until the server confirms.
                const createdAt = data.createdAt ? toISOString(data.createdAt)! : new Date().toISOString();
                return {
                    id: doc.id,
                    ...data,
                    createdAt,
                } as Suggestion;
            });
            
            // Client-side sort is safer against "INTERNAL ASSERTION FAILED" in some SDK versions
            suggestions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            onUpdate(suggestions);
        }, (error) => {
            logger.error("Error listening to suggestions:", error);
            onError(error);
        });

        return unsubscribe;
    } catch (e) {
        logger.error("Failed to setup suggestions listener:", e);
        onError(e as Error);
        return () => {};
    }
};

export const addSuggestion = async (user: User, orgId: string, suggestionData: { songs: Omit<SuggestedSong, 'id'>[] }): Promise<string> => {
    const songsWithIds = suggestionData.songs.map(song => ({
        ...song,
        id: Math.random().toString(36).substring(2, 11) // simple unique id for the sub-item
    }));

    const docRef = await addDoc(suggestionsCollection, {
        songs: songsWithIds,
        createdBy: createCreatedBy(user),
        organizationId: orgId,
        createdAt: serverTimestamp(),
        isRead: false,
        isArchived: false,
    });
    return docRef.id;
};

export const markSuggestionsAsRead = async (suggestionIds: string[]): Promise<void> => {
    const batch = writeBatch(db);
    suggestionIds.forEach(id => {
        const suggestionRef = doc(db, 'suggestions', id);
        batch.update(suggestionRef, { isRead: true });
    });
    await batch.commit();
};

export const markSuggestionsAsArchived = async (suggestionIds: string[]): Promise<void> => {
    const batch = writeBatch(db);
    suggestionIds.forEach(id => {
        const suggestionRef = doc(db, 'suggestions', id);
        batch.update(suggestionRef, { isArchived: true });
    });
    await batch.commit();
};

export const deleteSuggestions = async (suggestionIds: string[]): Promise<void> => {
    const batch = writeBatch(db);
    suggestionIds.forEach(id => {
        const suggestionRef = doc(db, 'suggestions', id);
        batch.delete(suggestionRef);
    });
    await batch.commit();
};

// Automatically archive suggestions older than 30 days
export const checkOldSuggestionsForAutoArchive = async (orgId: string): Promise<void> => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Fetch specific to org
        const q = createOrgQuery('suggestions', orgId);
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        let updateCount = 0;

        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            
            // Skip if already archived
            if (data.isArchived === true) return;

            const createdAt = data.createdAt;
            if (!createdAt) return;

            // Convert Firestore Timestamp to JS Date
            let createdDate: Date;
            if (createdAt instanceof Timestamp) {
                createdDate = createdAt.toDate();
            } else {
                // Fallback if it's a string (shouldn't happen in raw firestore data but safe to check)
                createdDate = new Date(createdAt);
            }

            if (createdDate < thirtyDaysAgo) {
                const ref = doc(db, 'suggestions', docSnap.id);
                batch.update(ref, { isArchived: true });
                updateCount++;
            }
        });

        if (updateCount > 0) {
            await batch.commit();
            logger.info(`Auto-archived ${updateCount} old suggestions.`);
        }
    } catch (error) {
        logger.error("Failed to run auto-archive check:", error);
    }
};
