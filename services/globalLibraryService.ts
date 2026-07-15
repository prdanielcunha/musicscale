import { collection, doc, query, getDocs, getDoc, setDoc, addDoc, updateDoc, deleteDoc, where, limit, startAfter, orderBy, DocumentData, QueryDocumentSnapshot, serverTimestamp, increment, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { GlobalSong, SongSubmission, Song, FreshnessMetadata } from '../types';

const GLOBAL_SONGS_COLLECTION = 'globalSongs';
const SUBMISSIONS_COLLECTION = 'songSubmissions';

export const incrementGlobalSongImportCount = async (songId: string) => {
  const docRef = doc(db, GLOBAL_SONGS_COLLECTION, songId);
  await updateDoc(docRef, { importCount: increment(1) });
};

export const updateGlobalSongStatus = async (songId: string, status: 'active' | 'draft', systemRole: string) => {
  if (systemRole !== 'ceo' && systemRole !== 'admin' && systemRole !== 'global_admin') throw new Error('Permission denied');
  const docRef = doc(db, GLOBAL_SONGS_COLLECTION, songId);
  await updateDoc(docRef, { status, lastModifiedAt: serverTimestamp() });
};

export const deleteGlobalSong = async (songId: string, systemRole: string, isMillionsnestAdmin?: boolean) => {
  if (systemRole !== 'ceo' && systemRole !== 'admin' && systemRole !== 'global_admin' && !isMillionsnestAdmin) throw new Error('Permission denied');
  const docRef = doc(db, GLOBAL_SONGS_COLLECTION, songId);
  await deleteDoc(docRef);
};

export const updateGlobalSong = async (songId: string, payload: Partial<GlobalSongPayload>, systemRole: string, isMillionsnestAdmin?: boolean) => {
  if (systemRole !== 'ceo' && systemRole !== 'admin' && systemRole !== 'global_admin' && !isMillionsnestAdmin) throw new Error('Permission denied');
  const docRef = doc(db, GLOBAL_SONGS_COLLECTION, songId);

  const updateData: any = { ...payload, lastModifiedAt: serverTimestamp() };
  
  if (payload.title) {
    updateData.normalizedTitle = payload.title.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  if (payload.artist) {
    updateData.normalizedArtist = payload.artist.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  if (payload.freshness) {
    const nowIso = new Date().toISOString();
    updateData.freshness = {
      status: payload.freshness.status || 'default',
      source: 'manual',
      manualResetAt: nowIso
    };
  }

  await updateDoc(docRef, updateData);
};

export const getGlobalSongs = async (
  searchTerm: string = '',
  lastVisible?: QueryDocumentSnapshot<DocumentData>,
  pageSize: number = 20
) => {
  const collRef = collection(db, GLOBAL_SONGS_COLLECTION);
  let q;

  if (searchTerm.trim()) {
    const normalizedTerm = searchTerm.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    q = query(
      collRef,
      where('normalizedTitle', '>=', normalizedTerm),
      where('normalizedTitle', '<=', normalizedTerm + '\uf8ff'),
      limit(pageSize + 10)  // fetch slightly more to allow for draft filtering
    );
  } else {
    q = query(
      collRef,
      orderBy('importCount', 'desc'),
      limit(pageSize + 10) // fetch slightly more to allow for draft filtering
    );
  }

  if (lastVisible) {
    q = query(q, startAfter(lastVisible));
  }

  const snapshot = await getDocs(q);
  // manual status filter to avoid composite index requirement
  const allFetched = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }) as GlobalSong);
  const songs = allFetched.filter(s => s.status === 'active').slice(0, pageSize);
  return {
    songs,
    lastVisible: snapshot.docs[snapshot.docs.length - 1]
  };
};

export const getGlobalLibraryMetrics = async () => {
  const collRef = collection(db, GLOBAL_SONGS_COLLECTION);
  const q = query(collRef);
  const snapshot = await getDocs(q);
  
  let total = 0;
  let completa = 0;
  let cifra = 0;
  let letra = 0;
  
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.status !== 'active') return;
    
    total++;
    const hasChords = !!(data.chords && typeof data.chords === 'string' && data.chords.trim());
    const hasLyrics = !!(data.lyrics && typeof data.lyrics === 'string' && data.lyrics.trim());
    
    if (hasChords && hasLyrics) completa++;
    if (hasChords) cifra++;
    if (hasLyrics) letra++;
  });
  
  return { total, completa, cifra, letra };
};

export const submitSong = async (submission: Omit<SongSubmission, 'id'>) => {
  const docRef = await addDoc(collection(db, SUBMISSIONS_COLLECTION), submission);
  return docRef.id;
};

export interface GlobalSongPayload {
  title: string;
  artist: string;
  key?: string;
  bpm?: number;
  lyrics?: string;
  chords?: string;
  chordsUrl?: string;
  videoUrl?: string;
  language?: 'pt' | 'en' | 'es' | 'other' | 'unknown';
  userId: string;
  userEmail: string;
  userName: string;
  systemRole: string;
  sourceOrganizationId: string;
  source: 'manual' | 'backup_import' | 'ai_import';
  sourceSongId?: string;
  freshness?: FreshnessMetadata;
}

export const checkGlobalDuplicates = async (title: string, artist: string, key?: string) => {
  const normalizedTitle = title.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedArtist = artist.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let isDuplicate = false;
  let matches: any[] = [];

  try {
    const dupeQuery = query(
      collection(db, GLOBAL_SONGS_COLLECTION),
      where('normalizedTitle', '==', normalizedTitle)
    );
    const dupeSnap = await getDocs(dupeQuery);
    
    if (!dupeSnap.empty) {
       for(const doc of dupeSnap.docs){
           const data = doc.data();
           if (data.normalizedArtist !== normalizedArtist) continue;
           matches.push({ ...data, id: doc.id });
           if(!key || !data.key || key === data.key) {
               isDuplicate = true;
           }
       }
    }
  } catch(e) {
     console.error('Error checking for duplicate global song', e);
  }

  return { isDuplicate, matches };
};

export const saveToGlobalLibrary = async (payload: GlobalSongPayload & { isMillionsnestAdmin?: boolean, force?: boolean }) => {
  if (payload.systemRole !== 'ceo' && payload.systemRole !== 'admin' && payload.systemRole !== 'global_admin' && !payload.isMillionsnestAdmin) {
    throw new Error('Permission denied. Only ecosystem admins can save directly to the global library.');
  }

  const normalizedTitle = payload.title.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedArtist = payload.artist.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Deduplication check
  let isDuplicate = false;
  let existingId = null;

  try {
    const dupeQuery = query(
      collection(db, GLOBAL_SONGS_COLLECTION),
      where('normalizedTitle', '==', normalizedTitle)
    );
    const dupeSnap = await getDocs(dupeQuery);
    
    // Simplistic deduplication logic for now
    if (!dupeSnap.empty) {
       for(const doc of dupeSnap.docs){
           const data = doc.data();
           if (data.normalizedArtist !== normalizedArtist) continue;
           // Consider dupe if keys match or if no key
           if(!payload.key || !data.key || payload.key === data.key) {
               isDuplicate = true;
               existingId = doc.id;
               break;
           }
       }
    }
  } catch(e) {
     console.error('Error checking for duplicate global song', e);
  }

  if (isDuplicate && existingId && !payload.force) {
    // If it exists, we could theoretically merge or update, but for now we skip to avoid overwriting curated global content
    return { status: 'skipped', reason: 'duplicate', id: existingId };
  }

  const newGlobalSongRef = doc(collection(db, GLOBAL_SONGS_COLLECTION));
  
  const nowIso = new Date().toISOString();
  const globalSongData = {
    title: payload.title,
    normalizedTitle,
    artist: payload.artist,
    normalizedArtist,
    key: payload.key || '',
    bpm: payload.bpm || 0,
    lyrics: payload.lyrics || '',
    chords: payload.chords || '',
    chordsUrl: payload.chordsUrl || '',
    videoUrl: payload.videoUrl || '',
    language: payload.language || 'unknown',
    status: 'active',
    importCount: 0,
    createdBy: {
      uid: payload.userId,
      displayName: payload.userName,
      email: payload.userEmail
    },
    createdAt: serverTimestamp(),
    source: payload.source,
    sourceOrganizationId: payload.sourceOrganizationId,
    sourceSongId: payload.sourceSongId || '',
    lastModifiedBy: payload.userId,
    lastModifiedAt: serverTimestamp(),
    freshness: {
      status: payload.freshness?.status || 'default',
      source: 'manual',
      manualResetAt: nowIso
    }
  };

  await setDoc(newGlobalSongRef, globalSongData);
  
  // Create audit log
  try {
    await addDoc(collection(db, 'audit_logs'), {
      action: 'global_song_created',
      userId: payload.userId,
      userEmail: payload.userEmail,
      systemRole: payload.systemRole,
      sourceOrganizationId: payload.sourceOrganizationId,
      source: payload.source,
      songTitle: payload.title,
      globalSongId: newGlobalSongRef.id,
      timestamp: serverTimestamp()
    });
  } catch(e) {
    console.error('Failed to write audit log', e);
  }

  return { status: 'created', id: newGlobalSongRef.id };
};


// ...outros métodos de admin serão implementados em Cloud Functions ou Admin Panel.

export const updateGlobalSongFreshnessInBatch = async (
  songIds: string[],
  status: 'default' | 'new' | 'old',
  systemRole: string,
  isMillionsnestAdmin?: boolean
) => {
  if (systemRole !== 'ceo' && systemRole !== 'admin' && systemRole !== 'global_admin' && !isMillionsnestAdmin) {
    throw new Error('Permission denied');
  }

  const nowIso = new Date().toISOString();
  // Safe chunk size for Firestore batches
  const chunkSize = 500;
  for (let i = 0; i < songIds.length; i += chunkSize) {
    const chunk = songIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const songId of chunk) {
      const docRef = doc(db, GLOBAL_SONGS_COLLECTION, songId);
      batch.update(docRef, {
        'freshness.status': status,
        'freshness.source': 'manual',
        'freshness.manualResetAt': nowIso,
        lastModifiedAt: serverTimestamp()
      });
    }
    await batch.commit();
  }
};

export const updateGlobalSongLanguageInBatch = async (
  songIds: string[],
  language: 'pt' | 'en' | 'es' | 'other' | 'unknown',
  systemRole: string,
  isMillionsnestAdmin?: boolean
) => {
  if (systemRole !== 'ceo' && systemRole !== 'admin' && systemRole !== 'global_admin' && !isMillionsnestAdmin) {
    throw new Error('Permission denied');
  }

  const chunkSize = 500;
  for (let i = 0; i < songIds.length; i += chunkSize) {
    const chunk = songIds.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const songId of chunk) {
      const docRef = doc(db, GLOBAL_SONGS_COLLECTION, songId);
      batch.update(docRef, {
        language,
        lastModifiedAt: serverTimestamp()
      });
    }
    await batch.commit();
  }
};

