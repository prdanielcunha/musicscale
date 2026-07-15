import { logger } from '../lib/logger';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
  query,
  where,
  setDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { createOrgQuery } from '../lib/firestore-utils';
import type { User, UserProfile, Role, Permissions, Song, Scale, EventType, Location, EventName, Tag, Instrument, InstrumentCategory, BandScale, BandMember, FixedBandScale } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  logger.error('Firestore Error: ', errInfo);
  throw new Error(JSON.stringify(errInfo));
}

// Helper to create 'createdBy'/'lastModifiedBy' object
const createAuditable = (user: User) => ({
  uid: user.uid,
  displayName: user.displayName,
  photoURL: user.photoURL,
});

// Helper to convert Firestore Timestamps to ISO strings
const toISOString = (date: any): string | null => {
    if (!date) return null;
    if (date instanceof Timestamp) return date.toDate().toISOString();
    return date; 
};

const convertDocTimestamps = (data: any) => {
    const newData = { ...data };
    if (data.createdAt) newData.createdAt = toISOString(data.createdAt);
    if (data.lastModifiedAt) newData.lastModifiedAt = toISOString(data.lastModifiedAt);
    if (data.chordsLastModifiedAt) newData.chordsLastModifiedAt = toISOString(data.chordsLastModifiedAt);
    return newData;
}

// Generic fetch function
const getCollectionData = async <T extends { id: string }>(collectionName: string): Promise<T[]> => {
    try {
        const snapshot = await getDocs(collection(db, collectionName));
        return snapshot.docs.map(doc => ({ ...convertDocTimestamps(doc.data()), id: doc.id } as T));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, collectionName);
        throw error;
    }
};

const getCollectionDataOrg = async <T extends { id: string }>(collectionName: string, orgId: string): Promise<T[]> => {
    if (!orgId || orgId === 'undefined') return [];
    try {
        const q = createOrgQuery(collectionName, orgId);
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...convertDocTimestamps(doc.data()), id: doc.id } as T));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, collectionName);
        return [];
    }
};

// Generic add function
const addCollectionDoc = async <T>(collectionName: string, user: UserProfile, data: T, explicitOrgId?: string) => {
    const targetOrgId = explicitOrgId || user.organizationId;
    if (!targetOrgId) throw new Error("Operação negada: ID da organização ausente no contexto atual.");
    try {
        const docRef = await addDoc(collection(db, collectionName), {
            ...data,
            organizationId: targetOrgId,
            createdBy: {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL
            },
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, collectionName);
        throw error;
    }
};

// Generic update function
const updateCollectionDoc = async <T extends {id: string}>(collectionName: string, user: UserProfile, data: T, explicitOrgId?: string) => {
    const { id, ...dataToUpdate } = data;
    const targetOrgId = explicitOrgId || user.organizationId;
    if (!targetOrgId) throw new Error("Operação negada: ID da organização ausente no contexto atual.");
    const docRef = doc(db, collectionName, id);
    try {
        await updateDoc(docRef, {
            ...dataToUpdate,
            // To ensure consistency, although usually updates shouldn't change the organizationId, 
            // if we need to we can, but we better keep it secure
            lastModifiedBy: {
                uid: user.uid,
                displayName: user.displayName,
                photoURL: user.photoURL
            },
            lastModifiedAt: serverTimestamp(),
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
    }
};

// Generic delete function
const deleteCollectionDocs = async (collectionName: string, ids: string[], orgId?: string) => {
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            if (orgId) {
                batch.delete(doc(db, collectionName, id));
            } else {
                batch.delete(doc(db, collectionName, id));
            }
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, collectionName);
    }
};

// Músicas
export const getSongs = (orgId: string) => getCollectionDataOrg<Song>('songs', orgId);

export const addSong = async (user: UserProfile, data: Omit<Song, 'id' | 'createdAt' | 'lastPlayed' | 'createdBy'>, orgId?: string) => {
    const songData = {
        ...data,
        freshness: data.freshness || {
            status: 'new',
            source: 'auto',
            autoUpdatedAt: new Date().toISOString()
        }
    };
    const id = await addCollectionDoc('songs', user, songData, orgId);
    if (typeof window !== 'undefined') {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (token) {
                fetch('/api/curation/auto-process-song', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ songId: id })
                }).catch(() => {});
            }
        } catch(e) {}
    }
    return id;
};

export const updateSong = (user: UserProfile, data: Song, orgId?: string) => updateCollectionDoc('songs', user, data, orgId);

export const submitSongToGlobalLibrary = async (user: UserProfile, songData: any, explicitOrgId?: string) => {
    const targetOrgId = explicitOrgId || user.organizationId;
    if (!targetOrgId) throw new Error("Operação negada: ID da organização ausente no contexto atual.");
    try {
        const docRef = await addDoc(collection(db, 'songSubmissions'), {
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
            organizationId: targetOrgId,
            submittedBy: user.uid,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        return docRef.id;
    } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'songSubmissions');
        throw error;
    }
};

export const updateSongsStatus = async (ids: string[], status: 'active' | 'inactive', orgId: string) => {
    try {
        const batch = writeBatch(db);
        ids.forEach(id => {
            const docRef = doc(db, 'songs', id);
            batch.update(docRef, { status });
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'songs');
    }
};
export const deleteSong = (id: string, orgId: string) => deleteCollectionDocs('songs', [id], orgId);
export const deleteSongs = (ids: string[], orgId: string) => deleteCollectionDocs('songs', ids, orgId);
export const updateSongChords = async (user: UserProfile, songId: string, chords: string, explicitOrgId?: string) => {
    const targetOrgId = explicitOrgId || user.organizationId;
    if (!targetOrgId) throw new Error("Operação negada: ID da organização ausente no contexto atual.");
    const docRef = doc(db, 'songs', songId);
    try {
        const existingSong = await getDoc(docRef);
        const existingData = existingSong.data();
        
        const updateData: any = {
            chords,
            chordsLastModifiedBy: { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL },
            chordsLastModifiedAt: serverTimestamp(),
        };

        if (!existingData?.chordsCreatedBy) {
            updateData.chordsCreatedBy = { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL };
        }
        
        await updateDoc(docRef, updateData);
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `songs/${songId}`);
    }
};

// Escalas
export const getScales = (orgId: string) => getCollectionDataOrg<Scale>('scales', orgId);
export const addScale = (user: UserProfile, data: Omit<Scale, 'id' | 'createdBy' | 'createdAt'>, orgId?: string) => {
    if (!data.songIds || data.songIds.length === 0) {
        throw new Error("Não é permitido criar ou atualizar uma escala de músicas sem nenhuma música selecionada.");
    }
    return addCollectionDoc('scales', user, data, orgId);
};
export const updateScale = (user: UserProfile, data: Scale, orgId?: string) => {
    if (!data.songIds || data.songIds.length === 0) {
        throw new Error("Não é permitido criar ou atualizar uma escala de músicas sem nenhuma música selecionada.");
    }
    return updateCollectionDoc('scales', user, data, orgId);
};
export const deleteScale = (id: string) => deleteCollectionDocs('scales', [id]);
export const deleteScales = (ids: string[]) => deleteCollectionDocs('scales', ids);

// Escalas de Banda
export const getBandScales = (orgId: string) => getCollectionDataOrg<BandScale>('bandScales', orgId);
export const addBandScale = (user: UserProfile, data: Omit<BandScale, 'id' | 'createdBy' | 'createdAt'>, orgId?: string) => {
    if (!data.assignments || data.assignments.filter(a => a.userId && a.instrumentId).length === 0) {
        throw new Error("Não é permitido criar ou atualizar uma escala da banda sem nenhum integrante selecionado.");
    }
    return addCollectionDoc('bandScales', user, data, orgId);
};
export const updateBandScale = (user: UserProfile, data: BandScale, orgId?: string) => {
    if (!data.assignments || data.assignments.filter(a => a.userId && a.instrumentId).length === 0) {
        throw new Error("Não é permitido criar ou atualizar uma escala da banda sem nenhum integrante selecionado.");
    }
    return updateCollectionDoc('bandScales', user, data, orgId);
};
export const deleteBandScales = (ids: string[]) => deleteCollectionDocs('bandScales', ids);

// Escalas Fixas (Modelos)
export const getFixedBandScales = (orgId: string) => getCollectionDataOrg<FixedBandScale>('fixedBandScales', orgId);
export const addFixedBandScale = (user: UserProfile, data: Omit<FixedBandScale, 'id' | 'createdBy' | 'createdAt'>, orgId?: string) => addCollectionDoc('fixedBandScales', user, data, orgId);
export const updateFixedBandScale = (user: UserProfile, data: FixedBandScale, orgId?: string) => updateCollectionDoc('fixedBandScales', user, data, orgId);
export const deleteFixedBandScales = (ids: string[]) => deleteCollectionDocs('fixedBandScales', ids);

// Vinculação de escalas
export const linkScales = async (musicScaleId: string, bandScaleId: string) => {
    try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'scales', musicScaleId), { bandScaleId });
        batch.update(doc(db, 'bandScales', bandScaleId), { musicScaleId });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'scales/bandScales');
    }
};

export const unlinkScales = async (musicScaleId: string, bandScaleId: string) => {
    try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'scales', musicScaleId), { bandScaleId: null });
        batch.update(doc(db, 'bandScales', bandScaleId), { musicScaleId: null });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'scales/bandScales');
    }
};

// Auxiliares (Database Page)
export const getEventTypes = (orgId: string) => getCollectionDataOrg<EventType>('eventTypes', orgId);
export const addEventType = (user: UserProfile, data: { name: string }, orgId?: string) => addCollectionDoc('eventTypes', user, data, orgId);
export const updateEventType = (user: UserProfile, data: EventType, orgId?: string) => updateCollectionDoc('eventTypes', user, data, orgId);
export const deleteEventTypes = (ids: string[]) => deleteCollectionDocs('eventTypes', ids);

export const getLocations = (orgId: string) => getCollectionDataOrg<Location>('locations', orgId);
export const addLocation = (user: UserProfile, data: { name: string }, orgId?: string) => addCollectionDoc('locations', user, data, orgId);
export const updateLocation = (user: UserProfile, data: Location, orgId?: string) => updateCollectionDoc('locations', user, data, orgId);
export const deleteLocations = (ids: string[]) => deleteCollectionDocs('locations', ids);

export const getEventNames = (orgId: string) => getCollectionDataOrg<EventName>('eventNames', orgId);
export const addEventName = (user: UserProfile, data: { name: string }, orgId?: string) => addCollectionDoc('eventNames', user, data, orgId);
export const updateEventName = (user: UserProfile, data: EventName, orgId?: string) => updateCollectionDoc('eventNames', user, data, orgId);
export const deleteEventNames = (ids: string[]) => deleteCollectionDocs('eventNames', ids);

export const getTags = (orgId: string) => getCollectionDataOrg<Tag>('tags', orgId);
export const addTag = (user: UserProfile, data: { name: string }, orgId?: string) => addCollectionDoc('tags', user, data, orgId);
export const updateTag = (user: UserProfile, data: Tag, orgId?: string) => updateCollectionDoc('tags', user, data, orgId);
export const deleteTags = (ids: string[]) => deleteCollectionDocs('tags', ids);

export const getInstruments = (orgId: string) => getCollectionDataOrg<Instrument>('instruments', orgId);
export const addInstrument = (user: UserProfile, data: { name: string, category: InstrumentCategory }, orgId?: string) => addCollectionDoc('instruments', user, data, orgId);
export const updateInstrument = (user: UserProfile, data: Instrument, orgId?: string) => updateCollectionDoc('instruments', user, data, orgId);
export const deleteInstruments = (ids: string[]) => deleteCollectionDocs('instruments', ids);


// Organizações
export const getOrganizationData = async (orgId: string) => {
    if (!orgId) return null;
    try {
        const docRef = doc(db, 'organizations', orgId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: orgId, ...docSnap.data() } as any;
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, `organizations/${orgId}`);
        return null;
    }
};

// Usuários e Funções
// Roles are strictly tied to an org.
export const getRoles = async (orgId: string) => {
    return getCollectionDataOrg<Role>('roles', orgId);
};
export const addRole = (user: UserProfile, data: Omit<Role, 'id'>) => addCollectionDoc('roles', user, data);
export const updateRole = (user: UserProfile, data: Role) => updateCollectionDoc('roles', user, data);
export const deleteRole = (id: string) => deleteCollectionDocs('roles', [id]);

export const getUserProfileData = async (uid: string): Promise<UserProfile | null> => {
    try {
        const docRef = doc(db, 'users', uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { uid, ...convertDocTimestamps(docSnap.data()) } as UserProfile;
        }
        return null;
    } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${uid}`);
        return null;
    }
};

export const getAllUserProfiles = async (orgId: string): Promise<UserProfile[]> => {
    if (!orgId) return [];
    try {
        const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({
            ...convertDocTimestamps(doc.data()),
            uid: doc.id
        } as UserProfile));
    } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'users');
        return [];
    }
};

export const createUserProfile = async (user: User, orgId: string, roleName: string = 'Visitante'): Promise<void> => {
    try {
        let defaultRole;
        if (orgId) {
            try {
                const roles = await getRoles(orgId);
                defaultRole = roles.find(r => r.name === roleName);
            } catch (err) {
                console.warn("Could not fetch roles for orgId", orgId, err);
            }
        }
        
        const profileData: any = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            roleId: defaultRole?.id || 'visitor',
            role: defaultRole?.name || 'Visitante', // Added for shared rules compatibility
            createdAt: serverTimestamp(),
            organizationId: orgId || null
        };

        if (orgId) {
           profileData.organizationId = orgId;
        }

        await setDoc(doc(db, 'users', user.uid), profileData);
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
};

export const updateUserProfileData = async (uid: string, data: Partial<UserProfile>) => {
    try {
        const docRef = doc(db, 'users', uid);
        await setDoc(docRef, {
            ...data,
            lastModifiedAt: serverTimestamp()
        }, { merge: true });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
};

export const deleteUserProfile = async (uid: string) => {
    try {
        await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
}
export const deleteUserProfiles = (uids: string[]) => deleteCollectionDocs('users', uids);

export const updateUserRoleId = async (uid: string, roleId: string, orgId: string) => {
    try {
        const roles = await getRoles(orgId);
        const role = roles.find(r => r.id === roleId);
        return updateUserProfileData(uid, { 
            roleId, 
            role: role?.name || 'Visitante' 
        });
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
};

export const updateUserRolesBatch = async (updates: { uid: string, roleId: string }[], orgId: string) => {
    try {
        const roles = await getRoles(orgId);
        const batch = writeBatch(db);
        updates.forEach(({ uid, roleId }) => {
            const role = roles.find(r => r.id === roleId);
            batch.update(doc(db, 'users', uid), { 
                roleId,
                role: role?.name || 'Visitante',
                lastModifiedAt: serverTimestamp()
            });
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
};

export const seedDefaultRolesForOrg = async (user: UserProfile, orgId: string): Promise<string | null> => {
    try {
        const rolesCollection = collection(db, 'roles');
        // Fetch only roles for this org or global
        const q = createOrgQuery('roles', orgId);
        const rolesSnapshot = await getDocs(q);
        const existingRoleNames = rolesSnapshot.docs.map(doc => doc.data().name);

        const defaultRoles: Omit<Role, 'id'>[] = [
            {
                name: 'Dono', description: 'Acesso total e controle financeiro.',
                permissions: { canManageUsers: true, canManageRoles: true, canManageRepertoire: true, canManageScales: true, canManageChords: true, canViewContent: true }
            },
            {
                name: 'Administrador', description: 'Acesso total à plataforma e membros.',
                permissions: { canManageUsers: true, canManageRoles: true, canManageRepertoire: true, canManageScales: true, canManageChords: true, canViewContent: true }
            },
            {
                name: 'Líder / Ministro', description: 'Pode gerenciar repertório e escalas.',
                permissions: { canManageUsers: false, canManageRoles: false, canManageRepertoire: true, canManageScales: true, canManageChords: true, canViewContent: true }
            },
            {
                name: 'Músico / Vocal', description: 'Acesso ao repertório e escalas.',
                permissions: { canManageUsers: false, canManageRoles: false, canManageRepertoire: false, canManageScales: false, canManageChords: true, canViewContent: true }
            },
            {
                name: 'Membro', description: 'Acesso ao repertório e cifras.',
                permissions: { canManageUsers: false, canManageRoles: false, canManageRepertoire: false, canManageScales: false, canManageChords: true, canViewContent: true }
            },
            {
                name: 'Visitante', description: 'Apenas visualização do acervo.',
                permissions: { canManageUsers: false, canManageRoles: false, canManageRepertoire: false, canManageScales: false, canManageChords: false, canViewContent: true }
            },
        ];

        let adminRoleId = rolesSnapshot.docs.find(doc => doc.data().name === 'Administrador')?.id || null;
        const rolesToAdd = defaultRoles.filter(dr => !existingRoleNames.includes(dr.name));

        if (rolesToAdd.length === 0) {
            return adminRoleId;
        }

        const batch = writeBatch(db);

        rolesToAdd.forEach(roleData => {
            const docRef = doc(rolesCollection);
            if (roleData.name === 'Administrador') {
                adminRoleId = docRef.id;
            }
            batch.set(docRef, {
                ...roleData,
                organizationId: orgId,
                createdBy: { uid: user.uid, displayName: user.displayName || null, photoURL: user.photoURL || null },
                createdAt: serverTimestamp(),
            });
        });
        await batch.commit();
        return adminRoleId;
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'roles');
        return null;
    }
};

export const seedDefaultInstrumentsForOrg = async (user: UserProfile, orgId: string): Promise<void> => {
    try {
        const instrumentsCollection = collection(db, 'instruments');
        const q = createOrgQuery('instruments', orgId);
        const snapshot = await getDocs(q);
        const existingNames = snapshot.docs.map(doc => doc.data().name);

        const defaultInstruments = [
            { name: 'Líder', category: 'Ministro' },
            { name: 'Ministro', category: 'Ministro' },
            { name: 'Vocal', category: 'Voz' },
            { name: 'Backing Vocal', category: 'Voz' },
            { name: 'Soprano', category: 'Voz' },
            { name: 'Contralto', category: 'Voz' },
            { name: 'Tenor', category: 'Voz' },
            { name: 'Instrumentista', category: 'Instrumento' },
            { name: 'Violão', category: 'Instrumento' },
            { name: 'Guitarra', category: 'Instrumento' },
            { name: 'Teclado', category: 'Instrumento' },
            { name: 'Piano', category: 'Instrumento' },
            { name: 'Baixo', category: 'Instrumento' },
            { name: 'Bateria', category: 'Instrumento' },
            { name: 'Percussão', category: 'Instrumento' },
        ];

        const itemsToAdd = defaultInstruments.filter(inst => !existingNames.includes(inst.name));
        if (itemsToAdd.length === 0) return;

        const batch = writeBatch(db);

        itemsToAdd.forEach(inst => {
            const docRef = doc(instrumentsCollection);
            batch.set(docRef, {
                ...inst,
                organizationId: orgId,
                createdBy: { uid: user.uid, displayName: user.displayName || null, photoURL: user.photoURL || null },
                createdAt: serverTimestamp(),
            });
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'instruments');
    }
};

export const seedDefaultTagsForOrg = async (user: UserProfile, orgId: string): Promise<void> => {
    try {
        const tagsCollection = collection(db, 'tags');
        const q = createOrgQuery('tags', orgId);
        const snapshot = await getDocs(q);
        const existingNames = snapshot.docs.map(doc => doc.data().name);

        const defaultTags = [
            'Louvor', 'Adoração', 'Celebração', 'Rápida', 'Lenta', 
            'Moderada', 'Santa Ceia', 'Oferta', 'Apelo', 'Meditação'
        ];

        const itemsToAdd = defaultTags.filter(name => !existingNames.includes(name));
        if (itemsToAdd.length === 0) return;

        const batch = writeBatch(db);
        itemsToAdd.forEach(name => {
            const docRef = doc(tagsCollection);
            batch.set(docRef, {
                name,
                organizationId: orgId,
                createdBy: { uid: user.uid, displayName: user.displayName || null, photoURL: user.photoURL || null },
                createdAt: serverTimestamp(),
            });
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'tags');
    }
};

export const seedDefaultEventTypesForOrg = async (user: UserProfile, orgId: string): Promise<void> => {
    try {
        const eventsCollection = collection(db, 'eventTypes');
        const q = createOrgQuery('eventTypes', orgId);
        const snapshot = await getDocs(q);
        const existingNames = snapshot.docs.map(doc => doc.data().name);

        const defaultEvents = ['Culto', 'Ensaio', 'Evangelismo', 'Outro'];

        const itemsToAdd = defaultEvents.filter(name => !existingNames.includes(name));
        if (itemsToAdd.length === 0) return;

        const batch = writeBatch(db);
        itemsToAdd.forEach(name => {
            const docRef = doc(eventsCollection);
            batch.set(docRef, {
                name,
                organizationId: orgId,
                createdBy: { uid: user.uid, displayName: user.displayName || null, photoURL: user.photoURL || null },
                createdAt: serverTimestamp(),
            });
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'eventTypes');
    }
};

export const seedDefaultLocationsForOrg = async (user: UserProfile, orgId: string): Promise<void> => {
    try {
        const locationsCollection = collection(db, 'locations');
        const q = createOrgQuery('locations', orgId);
        const snapshot = await getDocs(q);
        const existingNames = snapshot.docs.map(doc => doc.data().name);

        const defaultLocations = ['Templo Principal', 'Salão Jovem', 'Externo'];

        const itemsToAdd = defaultLocations.filter(name => !existingNames.includes(name));
        if (itemsToAdd.length === 0) return;

        const batch = writeBatch(db);
        itemsToAdd.forEach(name => {
            const docRef = doc(locationsCollection);
            batch.set(docRef, {
                name,
                organizationId: orgId,
                createdBy: { uid: user.uid, displayName: user.displayName || null, photoURL: user.photoURL || null },
                createdAt: serverTimestamp(),
            });
        });
        await batch.commit();
    } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'locations');
    }
};
