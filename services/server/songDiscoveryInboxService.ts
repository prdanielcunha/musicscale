import { getFirestore } from 'firebase-admin/firestore';
import { adminDb } from '../../services/firebaseAdmin.js';
import { normalizeBaseText } from '../../utils/songDiscovery/textNormalization.js';
import { sanitizeFirestoreData } from './firestoreSanitizer.js';

export interface SongDiscoveryInboxRecord {
    inboxId: string; // deterministically orgId_songId
    sourceOrganizationId: string;
    sourceSongId: string;
    title: string;
    normalizedTitle: string;
    artist: string;
    sourceCreatedAt: number;
    sourceUpdatedAt: number;
    status: 'pending' | 'processing' | 'analyzed' | 'ignored' | 'failed';
    analysisResult?: any;
    candidateId?: string | null;
    matchedGlobalSongId?: string | null;
    attempts: number;
    lastErrorCode?: string | null;
    createdAt: number;
    updatedAt: number;
}

export class SongDiscoveryInboxService {
    private db: FirebaseFirestore.Firestore;

    constructor(injectedDb?: any) {
        this.db = injectedDb || adminDb || getFirestore();
    }

    public async registerInboxRecord(
        songId: string, 
        organizationId: string, 
        songData: any
    ): Promise<{ outcome: 'queued' | 'already_queued' | 'ignored' | 'error'; reason?: string; isNew?: boolean }> {
        // Validate eligibility
        if (!songData) return { outcome: 'ignored', reason: 'No song data' };
        if (!songData.title || typeof songData.title !== 'string' || songData.title.trim().length === 0) {
            return { outcome: 'ignored', reason: 'Invalid or missing title' };
        }

        if (songData.deleted || songData.archived || songData.isDraft || songData.originGlobalSongId) {
            return { outcome: 'ignored', reason: 'Not eligible (draft, deleted, archived, or already linked)' };
        }

        const normalizedTitle = normalizeBaseText(songData.title);
        
        // Artist might be missing from some old data
        const artist = songData.artist || 'Desconhecido';
        
        const inboxId = `${organizationId}_${songId}`;
        const ref = this.db.collection('songDiscoveryInbox').doc(inboxId);
        
        const sourceCreatedAt = songData.createdAt || Date.now();
        const sourceUpdatedAt = songData.updatedAt || Date.now();

        let isNew = false;
        let finalStatus = 'pending';

        await this.db.runTransaction(async (t) => {
            const doc = await t.get(ref);
            if (doc.exists) {
                const existing = doc.data() as SongDiscoveryInboxRecord;
                let newStatus = existing.status;
                if (existing.status === 'ignored' || existing.status === 'failed') {
                    newStatus = 'pending';
                }
                
                finalStatus = newStatus;

                t.update(ref, sanitizeFirestoreData({
                    title: songData.title,
                    normalizedTitle,
                    artist,
                    sourceUpdatedAt,
                    status: newStatus,
                    updatedAt: Date.now()
                }));
            } else {
                isNew = true;
                const record: SongDiscoveryInboxRecord = {
                    inboxId,
                    sourceOrganizationId: organizationId,
                    sourceSongId: songId,
                    title: songData.title,
                    normalizedTitle,
                    artist,
                    sourceCreatedAt,
                    sourceUpdatedAt,
                    status: 'pending',
                    attempts: 0,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                };
                t.set(ref, sanitizeFirestoreData(record));
            }
        });

        if (finalStatus !== 'pending' && !isNew) {
             return { outcome: 'already_queued', reason: `Already in status ${finalStatus}` };
        }

        return { outcome: 'queued', isNew };
    }
}
