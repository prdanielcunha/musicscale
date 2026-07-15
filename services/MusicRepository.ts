import { BaseRepository, removeUndefinedValues } from '../lib/BaseRepository';
import { 
    Song, Scale, EventType, Location, EventName, Tag, Instrument, BandScale, FixedBandScale, UserProfile, Role, LiveWorshipSession
} from '../types';
import { doc, writeBatch, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

export class MusicRepository {
    private readonly orgId: string;
    public songs: BaseRepository<Song>;
    public scales: BaseRepository<Scale>;
    public bandScales: BaseRepository<BandScale>;
    public fixedBandScales: BaseRepository<FixedBandScale>;
    public eventTypes: BaseRepository<EventType>;
    public locations: BaseRepository<Location>;
    public eventNames: BaseRepository<EventName>;
    public tags: BaseRepository<Tag>;
    public instruments: BaseRepository<Instrument>;
    public users: BaseRepository<UserProfile>;
    public roles: BaseRepository<Role>;
    public liveSessions: BaseRepository<LiveWorshipSession>;

    constructor(orgId: string, userProfile?: UserProfile | null) {
        this.orgId = orgId;
        this.songs = new class extends BaseRepository<Song> {
            async create(data: Omit<Song, 'id' | 'createdAt' | 'createdBy' | 'organizationId'>): Promise<string> {
                const id = await super.create(data);
                if (typeof window !== 'undefined') {
                    // Fire-and-forget reprocessing to queue auto-curation
                    import('./firebase').then(({ auth }) => {
                        auth.currentUser?.getIdToken().then(token => {
                            if (token) {
                                fetch('/api/curation/auto-process-song', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                    body: JSON.stringify({ songId: id })
                                }).catch(err => console.error("Auto-process error:", err));
                            }
                        }).catch(() => {});
                    }).catch(() => {});
                }
                return id;
            }
        }('songs', orgId, userProfile);
        this.scales = new class extends BaseRepository<Scale> {
            async create(data: Omit<Scale, 'id' | 'createdAt' | 'createdBy' | 'organizationId'>): Promise<string> {
                if (!data.songIds || data.songIds.length === 0) {
                    throw new Error("Não é permitido criar ou atualizar uma escala de músicas sem nenhuma música selecionada.");
                }
                const id = await super.create(data);
                try {
                    if (data.songIds && data.songIds.length > 0 && data.date) {
                        const { updateSongsLastScheduledAtSafely } = await import('./musicBatchHelpers');
                        const res = await updateSongsLastScheduledAtSafely({
                            organizationId: this.orgId,
                            songIds: data.songIds,
                            scheduledDate: data.date
                        });
                        console.info(`[ScaleRepository] Create trigger updated lastScheduledAt:`, res);
                    }
                } catch (err) {
                    console.error("[ScaleRepository] Failed to update post-create lastScheduledAt:", err);
                }
                return id;
            }

            async update(id: string, data: Partial<Scale>): Promise<void> {
                if (data.songIds !== undefined && (!data.songIds || data.songIds.length === 0)) {
                    throw new Error("Não é permitido criar ou atualizar uma escala de músicas sem nenhuma música selecionada.");
                }
                await super.update(id, data);
                try {
                    const updatedScale = await this.getById(id);
                    if (updatedScale && updatedScale.songIds && updatedScale.songIds.length > 0 && updatedScale.date) {
                        const { updateSongsLastScheduledAtSafely } = await import('./musicBatchHelpers');
                        const res = await updateSongsLastScheduledAtSafely({
                            organizationId: this.orgId,
                            songIds: updatedScale.songIds,
                            scheduledDate: updatedScale.date
                        });
                        console.info(`[ScaleRepository] Update trigger updated lastScheduledAt:`, res);
                    }
                } catch (err) {
                    console.error("[ScaleRepository] Failed to update post-update lastScheduledAt:", err);
                }
            }
        }('scales', orgId, userProfile);
        this.bandScales = new class extends BaseRepository<BandScale> {
            async create(data: Omit<BandScale, 'id' | 'createdAt' | 'createdBy' | 'organizationId'>): Promise<string> {
                if (!data.assignments || data.assignments.filter(a => a.userId && a.instrumentId).length === 0) {
                    throw new Error("Não é permitido criar ou atualizar uma escala da banda sem nenhum integrante selecionado.");
                }
                return await super.create(data);
            }

            async update(id: string, data: Partial<BandScale>): Promise<void> {
                if (data.assignments !== undefined && (!data.assignments || data.assignments.filter(a => a.userId && a.instrumentId).length === 0)) {
                    throw new Error("Não é permitido criar ou atualizar uma escala da banda sem nenhum integrante selecionado.");
                }
                await super.update(id, data);
            }
        }('bandScales', orgId, userProfile);
        this.fixedBandScales = new BaseRepository<FixedBandScale>('fixedBandScales', orgId, userProfile);
        this.eventTypes = new BaseRepository<EventType>('eventTypes', orgId, userProfile);
        this.locations = new BaseRepository<Location>('locations', orgId, userProfile);
        this.eventNames = new BaseRepository<EventName>('eventNames', orgId, userProfile);
        this.tags = new BaseRepository<Tag>('tags', orgId, userProfile);
        this.instruments = new BaseRepository<Instrument>('instruments', orgId, userProfile);
        this.roles = new BaseRepository<Role>('roles', orgId, userProfile);
        this.liveSessions = new BaseRepository<LiveWorshipSession>('liveSessions', orgId, userProfile);
        
        // Custom users repository to fetch from organization_members correctly handling multi-tenancy
        this.users = new class extends BaseRepository<UserProfile> {
            async list() {
                // Fetch strictly from organizations/{orgId}/members to enforce active organization isolation
                const { collection, getDocs, doc, getDoc } = await import('firebase/firestore');
                const { db } = await import('./firebase');
                
                if (!orgId) return [];

                const profilesMap = new Map<string, UserProfile>();

                // Construct purely tenant-isolated query
                const qMembers = collection(db, 'organizations', orgId, 'members');
                const snapMembers = await getDocs(qMembers).catch(() => null);

                if (snapMembers && !snapMembers.empty) {
                    const memberDocs = snapMembers.docs;
                    for (const mDoc of memberDocs) {
                        const memberData = mDoc.data();
                        const uid = mDoc.id; 
                        if (!uid) continue;
                        
                        const memberRole = memberData.musicscaleRole || memberData.organizationRole || memberData.ministryFunction;
                        const memberRoleId = memberData.roleId;

                        profilesMap.set(uid, {
                            id: uid,
                            uid: uid,
                            email: memberData.email || '',
                            displayName: memberData.displayName || memberData.name || 'Usuário',
                            photoURL: memberData.photoURL || '',
                            role: memberRole,
                            roleId: memberRoleId,
                            organizationRole: memberData.organizationRole,
                            musicscaleRole: memberData.musicscaleRole,
                            ministryFunction: memberData.ministryFunction,
                            systemRole: memberData.systemRole,
                            specialtyIds: memberData.specialtyIds,
                            organizationId: orgId
                        } as any);
                    }

                    // Optional enrichment from user profile to guarantee we show latest global data if incomplete
                    // Execute in parallel chunks to avoid hanging
                    const uids = Array.from(profilesMap.keys());
                    const chunkSize = 10;
                    for (let i = 0; i < uids.length; i += chunkSize) {
                        const chunk = uids.slice(i, i + chunkSize);
                        await Promise.all(chunk.map(async (uid) => {
                            try {
                                const userDoc = await getDoc(doc(db, 'users', uid));
                                if (userDoc.exists()) {
                                    const udata = userDoc.data() as any;
                                    const existing = profilesMap.get(uid);
                                    if (existing) {
                                        profilesMap.set(uid, {
                                            ...udata, // Base user data
                                            ...existing, // Override with authoritative member data
                                            email: existing.email || udata.email,
                                            displayName: existing.displayName !== 'Usuário' ? existing.displayName : (udata.displayName || udata.name || 'Usuário'),
                                            photoURL: existing.photoURL || udata.photoURL,
                                            specialtyIds: existing.specialtyIds || udata.specialtyIds,
                                        });
                                    }
                                }
                            } catch(e) {}
                        }));
                    }
                }
                
                return Array.from(profilesMap.values());
            }

            async update(id: string, data: Partial<UserProfile>): Promise<void> {
                const { writeBatch, doc } = await import('firebase/firestore');
                const { db } = await import('./firebase');
                const batch = writeBatch(db);
                
                // Update specific role fields in new member subcollection
                if (data.roleId !== undefined || data.role !== undefined || data.musicscaleRole !== undefined || data.ministryFunction !== undefined || data.specialtyIds !== undefined) {
                    const memberUpdate: any = {};
                    if (data.roleId !== undefined) memberUpdate.roleId = data.roleId;
                    if (data.role !== undefined) memberUpdate.role = data.role;
                    if (data.musicscaleRole !== undefined) memberUpdate.musicscaleRole = data.musicscaleRole;
                    if (data.ministryFunction !== undefined) memberUpdate.ministryFunction = data.ministryFunction;
                    if (data.specialtyIds !== undefined) memberUpdate.specialtyIds = data.specialtyIds;
                    
                    // Main source of truth update
                    batch.set(doc(db, 'organizations', orgId, 'members', id), memberUpdate, { merge: true });
                    
                    // Legacy fallbacks
                    try {
                        batch.set(doc(db, 'organization_members', `${id}_${orgId}`), memberUpdate, { merge: true });
                        batch.set(doc(db, 'organization_members', `${orgId}_${id}`), memberUpdate, { merge: true });
                    } catch (e) {}
                    
                    // Update main user doc
                    batch.set(doc(db, 'users', id), data, { merge: true });
                } else {
                    batch.set(doc(db, 'users', id), data, { merge: true });
                }
                
                await batch.commit().catch(e => {
                     console.error("[MusicRepository] failed to update user role", e);
                     throw e;
                });
            }
        }('users', orgId, userProfile);
    }

    // Specialized business logic
    async submitToGlobal(user: UserProfile, songData: any, force?: boolean, isEcosystemAdminOverride?: boolean) {
        if (!this.orgId) throw new Error("Operação negada: ID da organização ausente no contexto atual.");
        
        if (user.systemRole === 'ceo' || user.systemRole === 'admin' || user.systemRole === 'global_admin' || isEcosystemAdminOverride) {
            const { saveToGlobalLibrary } = await import('./globalLibraryService');
            return await saveToGlobalLibrary({
                title: songData.title,
                artist: songData.artist,
                key: songData.key || '',
                bpm: Number(songData.bpm) || 0,
                lyrics: songData.lyrics || "",
                chords: songData.chords || "",
                chordsUrl: songData.chordsUrl || "",
                videoUrl: songData.videoUrl || "",
                language: songData.language || "unknown",
                userId: user.uid,
                userEmail: user.email,
                userName: user.displayName || 'Admin',
                systemRole: user.systemRole || 'user',
                sourceOrganizationId: this.orgId,
                source: 'manual',
                force: force,
                isMillionsnestAdmin: isEcosystemAdminOverride,
                freshness: songData.freshness
            });
        }

        return await addDoc(collection(db, 'songSubmissions'), {
            title: songData.title,
            artist: songData.artist,
            key: songData.key || 'C',
            bpm: songData.bpm !== undefined && songData.bpm !== null && songData.bpm !== "" ? Number(songData.bpm) : null,
            suggestedBpm: songData.suggestedBpm || null,
            bpmConfidence: songData.bpmConfidence || 'unknown',
            bpmSource: songData.bpmSource || 'not_detected',
            lyrics: songData.lyrics || "",
            chords: songData.chords || "",
            chordsUrl: songData.chordsUrl || "",
            videoUrl: songData.videoUrl || "",
            language: songData.language || "unknown",
            organizationId: this.orgId,
            submittedBy: user.uid,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
    }

    async linkScales(musicScaleId: string, bandScaleId: string) {
        if (!musicScaleId || !bandScaleId) {
            console.error("linkScales failed: missing id", { musicScaleId, bandScaleId });
            return;
        }
        const batch = writeBatch(db);
        batch.update(doc(db, 'scales', musicScaleId), { bandScaleId });
        batch.update(doc(db, 'bandScales', bandScaleId), { musicScaleId });
        await batch.commit();
    }

    async unlinkScales(musicScaleId: string, bandScaleId: string) {
        const batch = writeBatch(db);
        batch.update(doc(db, 'scales', musicScaleId), { bandScaleId: null });
        batch.update(doc(db, 'bandScales', bandScaleId), { musicScaleId: null });
        await batch.commit();
    }

    async upsertLiveSession(scaleId: string, data: Partial<LiveWorshipSession>) {
        const docRef = doc(db, 'liveSessions', scaleId);
        const batch = writeBatch(db);
        batch.set(docRef, removeUndefinedValues({
            ...data,
            id: scaleId,
            scaleId: scaleId,
            organizationId: this.orgId,
            lastUpdated: Date.now()
        }), { merge: true });
        await batch.commit();
    }

    async updateSongChords(songId: string, chords: string) {
        await this.songs.update(songId, { 
            chords,
            chordsLastModifiedAt: serverTimestamp() as any 
        } as any);
    }

    public bandScaleCommands = {
        create: async (payload: any, idempotencyKey: string) => {
            const { auth } = await import('./firebase');
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Usuário não autenticado.");

            const res = await fetch('/api/v1/band-scales', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Idempotency-Key': idempotencyKey,
                    'X-Organization-Id': this.orgId
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const err = new Error(errData.error || "Erro ao criar escala de banda.");
                (err as any).correlationId = errData.correlationId;
                (err as any).status = res.status;
                throw err;
            }

            return await res.json();
        },
        update: async (scaleId: string, expectedVersion: number, payload: any, idempotencyKey: string) => {
            const { auth } = await import('./firebase');
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Usuário não autenticado.");

            const res = await fetch(`/api/v1/band-scales/${scaleId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Idempotency-Key': idempotencyKey,
                    'X-Organization-Id': this.orgId
                },
                body: JSON.stringify({ ...payload, expectedVersion })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const err = new Error(errData.error || "Erro ao atualizar escala de banda.");
                (err as any).correlationId = errData.correlationId;
                (err as any).status = res.status;
                throw err;
            }

            return await res.json();
        }
    };

    public musicScaleCommands = {
        publish: async (musicScaleId: string, payload: any, idempotencyKey: string) => {
            const { auth } = await import('./firebase');
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Usuário não autenticado.");

            const res = await fetch(`/api/v1/music-scales/${musicScaleId}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Idempotency-Key': idempotencyKey,
                    'X-Organization-Id': this.orgId
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const err = new Error(errData.error || "Erro ao publicar escala de música.");
                (err as any).correlationId = errData.correlationId;
                (err as any).status = res.status;
                throw err;
            }

            return await res.json();
        }
    };

    public musicScaleResponses = {
        respondOwn: async (
            musicScaleId: string,
            payload: { status: 'accepted' | 'maybe' | 'declined'; reason?: string | null },
            idempotencyKey: string
        ): Promise<any> => {
            const { auth } = await import('./firebase');
            const token = await auth.currentUser?.getIdToken();
            if (!token) throw new Error("Usuário não autenticado");

            const res = await fetch(`/api/v1/music-scales/${musicScaleId}/my-response`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'Idempotency-Key': idempotencyKey,
                    'X-Organization-Id': this.orgId
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const err = new Error(errData.error || "Erro ao enviar resposta.");
                (err as any).correlationId = errData.correlationId;
                (err as any).status = res.status;
                (err as any).errorCode = errData.errorCode;
                (err as any).messageKey = errData.messageKey;
                throw err;
            }

            return await res.json();
        }
    };
}
