import { db, auth } from './firebase';
import { collection, query, where, orderBy, limit, startAfter, getDocs, doc, getDoc, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export interface CurationFilters {
    status?: string | 'all';
    classification?: string;
    limitMsgs?: number;
    lastDoc?: QueryDocumentSnapshot<DocumentData>;
}

import { parseTimestampToMillis } from '../utils/curation/timestamp.js';
import { GlobalLibraryCandidateReviewLog } from '../utils/songDiscovery/curationTypes.js';

export interface NormalizedReviewLog extends GlobalLibraryCandidateReviewLog {
    timestampMillis: number | null;
}

export interface CandidateViewModel {
    candidateId: string;
    title: string;
    artist: string;
    normalizedTitle: string;
    status: string;
    classification: string;
    snapshot: any;
    occurrenceCount: number;
    organizationCount: number;
    firstDiscoveredAt: number | null;
    lastDiscoveredAt: number | null;
    errorMsg?: string;
    canonicalIdentity?: any;
    analysisSummary?: any;
    processing?: any;
}

export const mapCandidateToViewModel = (data: any): CandidateViewModel => {
    return {
        candidateId: data.id || data.candidateId,
        title: data.title || data.snapshot?.title || data.snapshot?.songTitle || data.canonicalIdentity?.originalTitle || 'Sem Título',
        artist: data.artist || data.snapshot?.artist || data.canonicalIdentity?.normalizedArtists?.join(', ') || 'Desconhecido',
        normalizedTitle: data.normalizedTitle || data.canonicalIdentity?.normalizedTitle || '',
        status: data.status || 'pending',
        classification: data.classification || data.analysisSummary?.classification || 'pending',
        snapshot: data.snapshot || null,
        occurrenceCount: data.occurrenceCount || 0,
        organizationCount: data.organizationCount || 0,
        firstDiscoveredAt: parseTimestampToMillis(data.firstDiscoveredAt) || parseTimestampToMillis(data.discovery?.discoveredAt) || null,
        lastDiscoveredAt: parseTimestampToMillis(data.lastDiscoveredAt) || parseTimestampToMillis(data.discovery?.discoveredAt) || null,
        errorMsg: data.processing?.lastErrorCode || data.errorMsg,
        canonicalIdentity: data.canonicalIdentity,
        analysisSummary: data.analysisSummary,
        processing: data.processing
    };
};

export const curationService = {
    async fetchCandidates(filters: CurationFilters) {
        let candidates: any[] = [];
        let hasMore = true;
        let lastDoc = null;

        const limitCount = filters.limitMsgs || 20;

        const fetchLegacy = async () => {
            const legacyQ = query(
                collection(db, 'globalLibraryCandidates'),
                where('status', '==', 'pending_analysis'),
                limit(limitCount)
            );
            const legacySnap = await getDocs(legacyQ);
            return legacySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        };

        const fetchCurrent = async () => {
            let q = query(
                collection(db, 'globalLibraryCandidates'),
                orderBy('firstDiscoveredAt', 'desc'),
                limit(limitCount)
            );

        if (filters.status && filters.classification && filters.status !== 'all') {
            q = query(
                collection(db, 'globalLibraryCandidates'),
                where('classification', '==', filters.classification),
                where('status', '==', filters.status),
                orderBy('firstDiscoveredAt', 'desc'),
                limit(limitCount)
            );
        } else if (filters.classification) {
             q = query(
                collection(db, 'globalLibraryCandidates'),
                where('classification', '==', filters.classification),
                orderBy('firstDiscoveredAt', 'desc'),
                limit(limitCount)
             );
        } else if (filters.status && filters.status !== 'all') {
             q = query(
                collection(db, 'globalLibraryCandidates'),
                where('status', '==', filters.status),
                orderBy('firstDiscoveredAt', 'desc'),
                limit(limitCount)
             );
        } else if (filters.status === 'all') {
            q = query(
                collection(db, 'globalLibraryCandidates'),
                where('status', 'in', ['pending_review', 'approved', 'linked', 'rejected']),
                orderBy('firstDiscoveredAt', 'desc'),
                limit(limitCount)
            );
        }


            if (filters.lastDoc) {
                q = query(q, startAfter(filters.lastDoc));
            }

            const snap = await getDocs(q);
            return {
                docs: snap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
                lastDoc: snap.docs[snap.docs.length - 1] || null,
                hasMore: snap.docs.length === limitCount
            };
        };

        if (filters.status === 'pending_analysis') {
            // Legacy only
            candidates = await fetchLegacy();
            // Sort in memory
            candidates.sort((a, b) => {
                const aTime = (a.firstDiscoveredAt || a.discovery?.discoveredAt)?.seconds || 0;
                const bTime = (b.firstDiscoveredAt || b.discovery?.discoveredAt)?.seconds || 0;
                return bTime - aTime;
            });
            hasMore = candidates.length === limitCount; // rough estimate
        } else if (filters.status === 'all') {
            // Both
            const [legacyDocs, currentData] = await Promise.all([
                // Only fetch legacy if we are on the first page, simplifying pagination for legacy. 
                // Alternatively, we just fetch it always and rely on memory sort and deduplication.
                // Since this is for a transitional phase, it's ok. 
                filters.lastDoc ? Promise.resolve([]) : fetchLegacy(),
                fetchCurrent()
            ]);
            
            const combined = [...currentData.docs, ...legacyDocs];
            
            // Deduplicate by ID
            const uniqueMap = new Map();
            combined.forEach(doc => {
                if (!uniqueMap.has(doc.id)) {
                    uniqueMap.set(doc.id, doc);
                }
            });
            candidates = Array.from(uniqueMap.values());
            
            // Sort in memory globally
            candidates.sort((a, b) => {
                const aTime = (a.firstDiscoveredAt || a.discovery?.discoveredAt)?.seconds || 0;
                const bTime = (b.firstDiscoveredAt || b.discovery?.discoveredAt)?.seconds || 0;
                return bTime - aTime;
            });

            lastDoc = currentData.lastDoc;
            hasMore = currentData.hasMore;
        } else {
            // Current only
            const currentData = await fetchCurrent();
            candidates = currentData.docs;
            lastDoc = currentData.lastDoc;
            hasMore = currentData.hasMore;
        }

        return {
            candidates: candidates.map(mapCandidateToViewModel),
            lastDoc,
            hasMore
        };
    },

    async fetchCandidateDetails(candidateId: string) {
        const docRef = doc(db, 'globalLibraryCandidates', candidateId);
        const snapshot = await getDoc(docRef);
        if (!snapshot.exists()) return null;
        return mapCandidateToViewModel({ id: snapshot.id, ...snapshot.data() });
    },

    async fetchOccurrences(candidateId: string) {
        const q = query(collection(db, `globalLibraryCandidates/${candidateId}/occurrences`), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const occurrences = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

        const orgMap = new Map();
        try {
            const orgIds = Array.from(new Set(occurrences.map((o: any) => o.snapshot?.organizationId).filter(id => id)));
            for(let i=0; i<orgIds.length; i+=10) {
                const chunk = orgIds.slice(i, i+10);
                const orgQuery = query(collection(db, 'organizations'), where('__name__', 'in', chunk));
                const orgSnap = await getDocs(orgQuery);
                orgSnap.forEach(doc => orgMap.set(doc.id, doc.data().name || doc.data().title || 'Desconhecido'));
            }
        } catch(e) {}

        return occurrences.map((o: any) => ({
            ...o,
            __organizationName: o.snapshot?.organizationId ? (orgMap.get(o.snapshot.organizationId) || 'Organização não encontrada') : 'Desconhecido'
        }));
    },
    
    async fetchMatches(candidateId: string) {
        const q = query(collection(db, `globalLibraryCandidates/${candidateId}/matches`), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const matches = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

        const globalSongsMap = new Map();
        try {
             const matchIds = matches.map(m => m.id);
             if (matchIds.length > 0) {
                  for(let i=0; i<matchIds.length; i+=10) {
                      const chunk = matchIds.slice(i, i+10);
                      const gsQuery = query(collection(db, 'globalSongs'), where('__name__', 'in', chunk));
                      const gsSnap = await getDocs(gsQuery);
                      gsSnap.forEach(doc => globalSongsMap.set(doc.id, doc.data()));
                  }
             }
        } catch(e) { }

        return matches.map(m => {
             const gs: any = globalSongsMap.get(m.id);
             return {
                 ...m,
                 __globalSongDetails: gs ? { title: gs.title, artist: gs.artist, key: gs.key, language: gs.language } : null
             };
        });
    },

    async fetchReviewLogs(candidateId: string): Promise<NormalizedReviewLog[]> {
        const snapshot = await getDocs(collection(db, `globalLibraryCandidates/${candidateId}/reviewLogs`));
        
        return snapshot.docs.map(doc => {
            const data = doc.data() as GlobalLibraryCandidateReviewLog;
            const timestampMillis = parseTimestampToMillis(data.timestamp) ?? parseTimestampToMillis(data.createdAt);
            
            return {
                ...data,
                id: doc.id,
                timestampMillis
            };
        }).sort((a, b) => {
            const timeA = a.timestampMillis ?? 0;
            const timeB = b.timestampMillis ?? 0;
            if (timeB !== timeA) {
                return timeB - timeA; // desc
            }
            return a.id.localeCompare(b.id); // stable tie-breaker
        });
    },

    async approveAsNew(candidateId: string, occurrenceId: string, idempotencyKey: string) {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Usuário não autenticado");

        const response = await fetch('/api/curation/approve', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ candidateId, occurrenceId, idempotencyKey })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Erro ao aprovar candidata");
        }
        
        return data;
    },

    async linkToExisting(candidateId: string, globalSongId: string, idempotencyKey: string, forceModeratedMatch: boolean = false) {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Usuário não autenticado");

        const response = await fetch('/api/curation/link', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ candidateId, globalSongId, idempotencyKey, forceModeratedMatch })
        });

        const data = await response.json();
        
        if (!response.ok) {
            const err = new Error(data.error || "Erro ao vincular candidata");
            (err as any).requiresConfirmation = data.requiresConfirmation;
            (err as any).rejected = data.rejected;
            throw err;
        }
        
        return data;
    },

    async rejectCandidate(candidateId: string, reasonCode: string, optionalNote: string, idempotencyKey: string) {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Usuário não autenticado");

        const response = await fetch('/api/curation/reject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ candidateId, reasonCode, optionalNote, idempotencyKey })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Erro ao rejeitar candidata");
        }
        
        return data;
    }
};
