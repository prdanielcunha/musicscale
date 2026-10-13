import { createHash } from 'node:crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { extractSongIdentity } from '../../utils/songDiscovery/identityGenerator.js';
import { GENERIC_TITLES, MIN_LYRICS_WORDS_FOR_STRONG_MATCH } from '../../utils/songDiscovery/constants.js';

const MAX_SCAN = 50;
const hash = (input: string) => createHash('sha256').update(input).digest('hex');
const clean = (input: unknown) => String(input || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (text: string) => clean(text).split(' ').filter(Boolean);
const prefixes = (values: string[], length = 2, max = 80) => {
  const result = new Set<string>();
  for (const value of values) for (let i = length; i <= value.length; i++) {
    result.add(value.slice(0, i));
    if (result.size >= max) return [...result];
  }
  return [...result];
};
const grams = (values: string[]) => {
  const result = new Set<string>();
  for (const value of values) for (let i = 0; i < value.length - 2; i++) result.add(value.slice(i, i + 3));
  return [...result].slice(0, 80);
};
const buildSearchFields = (song: any) => {
  const titles = tokens(song.title);
  const artists = tokens(song.artist);
  const lyrical = tokens(song.lyrics).filter(t => t.length > 2).slice(0, 80);
  const chords = tokens(song.chords).filter(t => t.length > 2).slice(0, 80);
  const key = String(song.key || '').trim();
  return {
    searchVersion: 3,
    searchTokens: [...new Set([...titles, ...artists, ...lyrical, ...chords, ...tokens(song.version)])].slice(0, 150),
    searchContentTokens: [...new Set([...lyrical, ...chords])].slice(0, 150),
    searchTitlePrefixes: prefixes(titles),
    searchArtistPrefixes: prefixes(artists),
    searchTitleGrams: grams(titles),
    searchArtistGrams: grams(artists),
    searchKeyTokens: key ? [key] : []
  };
};

export async function ingestNewLocalSong(
  songId: string, organizationId: string, songData: any, injectedDb: any = getFirestore()
): Promise<'published' | 'pending' | 'already_processed' | 'ignored'> {
  if (!songData || !songData.title || songData.deleted || songData.archived ||
      songData.isDraft || songData.originGlobalSongId || songData.sourceType === 'medley') return 'ignored';

  const snapshot = {
    title: String(songData.title), artist: String(songData.artist || ''),
    lyrics: String(songData.lyrics || ''), chords: String(songData.chords || ''),
    key: String(songData.key || 'C'), bpm: songData.bpm || null,
    rhythm: songData.rhythm || '', language: songData.language || 'pt',
    chordsUrl: '', videoUrl: ''
  };
  const identity = extractSongIdentity(snapshot);
  if (!identity.normalizedTitle) return 'ignored';

  const db = injectedDb;
  const globalByTitle = await db.collection('globalSongs')
    .where('normalizedTitle', '==', identity.normalizedTitle).limit(MAX_SCAN + 1).get();
  const globalByLyrics = identity.lyricsFingerprint ? await db.collection('globalSongs')
    .where('lyricsFingerprint', '==', identity.lyricsFingerprint).limit(MAX_SCAN + 1).get() : null;
  const candidatesByTitle = await db.collection('globalLibraryCandidates')
    .where('canonicalIdentity.normalizedTitle', '==', identity.normalizedTitle)
    .limit(MAX_SCAN + 1).get();
  const candidatesByLyrics = identity.lyricsFingerprint ? await db.collection('globalLibraryCandidates')
    .where('canonicalIdentity.lyricsFingerprint', '==', identity.lyricsFingerprint)
    .limit(MAX_SCAN + 1).get() : null;

  const globals = new Map<string, any>();
  for (const doc of [...globalByTitle.docs, ...(globalByLyrics?.docs || [])]) globals.set(doc.id, doc.data());
  const candidates = new Map<string, any>();
  for (const doc of [...candidatesByTitle.docs, ...(candidatesByLyrics?.docs || [])]) candidates.set(doc.id, doc.data());

  const scanLimited = [globalByTitle, globalByLyrics, candidatesByTitle, candidatesByLyrics]
    .some(q => q && q.docs.length > MAX_SCAN);
  const sameArtist = (a: string[]) => a.length === 0 || identity.normalizedArtists.length === 0 ||
    a.some(x => identity.normalizedArtists.includes(x));
  const globalMatch = [...globals.values()].some(g =>
    (g.status !== 'archived' && g.status !== 'deleted') &&
    ((g.normalizedTitle === identity.normalizedTitle &&
      sameArtist(g.normalizedArtists || (g.normalizedArtist ? [g.normalizedArtist] : []))) ||
      Boolean(identity.lyricsFingerprint && (g.lyricsFingerprint || g.fingerprints?.lyrics) === identity.lyricsFingerprint))
  );
  const candidateMatch = [...candidates.values()].some(c => c.status === 'pending_review' &&
    ((c.canonicalIdentity?.normalizedTitle === identity.normalizedTitle &&
      sameArtist(c.canonicalIdentity?.normalizedArtists || [])) ||
      Boolean(identity.lyricsFingerprint &&
        c.canonicalIdentity?.lyricsFingerprint === identity.lyricsFingerprint)));

  const lyricWords = (identity.normalizedLyrics || '').split(/\s+/).filter(Boolean).length;
  const canPublish = !scanLimited && !globalMatch && !candidateMatch &&
    identity.normalizedArtists.length > 0 &&
    lyricWords >= MIN_LYRICS_WORDS_FOR_STRONG_MATCH &&
    !GENERIC_TITLES.has(identity.normalizedTitle);

  const creator = songData.createdBy || {};
  const creatorUid = typeof creator === 'string' ? creator : (creator.uid || '');
  const creatorName = typeof creator === 'object' ? (creator.displayName || creator.name || '') : '';
  const fingerprint = identity.contentFingerprint;
  const resolvedOriginal = candidates.get(fingerprint);
  const candidateId = resolvedOriginal && resolvedOriginal.status !== 'pending_review'
    ? hash('duplicate:' + organizationId + ':' + songId) : fingerprint;
  const candidateRef = db.collection('globalLibraryCandidates').doc(candidateId);
  const occurrenceRef = candidateRef.collection('occurrences').doc(hash(organizationId + ':' + songId));
  const localRef = db.collection('songs').doc(songId);
  const titleArtistReservation = db.collection('globalSongUniqueKeys')
    .doc(hash(identity.normalizedTitle + '|' + identity.normalizedArtists.join('|')));
  const globalRef = db.collection('globalSongs').doc('auto_' + hash(identity.normalizedTitle + '|' +
    identity.normalizedArtists.join('|')));
  const orgRef = candidateRef.collection('organizations').doc(organizationId);
  const classification = scanLimited ? 'insufficient_data' :
    (globalMatch || candidateMatch) ? 'possible_duplicate' : 'likely_unique';
  const now = Date.now();

  return db.runTransaction(async (tx: any) => {
    const [localSnap, candidateSnap, occurrenceSnap, reservationSnap, globalSnap, orgSnap] = await Promise.all([
      tx.get(localRef), tx.get(candidateRef), tx.get(occurrenceRef),
      tx.get(titleArtistReservation), tx.get(globalRef), tx.get(orgRef)
    ]);
    if (!localSnap.exists || localSnap.data()?.organizationId !== organizationId) return 'ignored';
    if (localSnap.data()?.originGlobalSongId) return 'already_processed';
    if (occurrenceSnap.exists) return 'already_processed';

    // Recheck the visible index under transaction locking. Never auto-publish
    // if another writer acquired the canonical title+artist reservation.
    const publish = canPublish && !reservationSnap.exists && !globalSnap.exists &&
      (!candidateSnap.exists || candidateSnap.data().status === 'pending_review') &&
      !candidateSnap.exists;

    const newCandidate = {
      id: candidateId, title: snapshot.title, artist: snapshot.artist,
      normalizedTitle: identity.normalizedTitle, status: 'pending_review',
      classification, snapshot,
      canonicalIdentity: {
        normalizedTitle: identity.normalizedTitle,
        compactTitle: identity.compactTitle,
        normalizedArtists: identity.normalizedArtists,
        titleFingerprint: identity.titleFingerprint,
        lyricsFingerprint: identity.lyricsFingerprint,
        contentFingerprint: identity.contentFingerprint,
        openingFingerprint: identity.openingFingerprint,
        chorusFingerprint: identity.chorusFingerprint
      },
      analysisSummary: {
        algorithmVersion: '2.0', classification, overallScore: 0,
        possibleMatchCount: globals.size, reasonCodes: [],
        warningCodes: scanLimited ? ['SEARCH_LIMITED_NO_GLOBAL_MATCH'] : []
      },
      occurrenceCount: 1, organizationCount: 1,
      firstDiscoveredAt: now, lastDiscoveredAt: now, createdAt: now,
      updatedAt: now, processing: { state: 'idle', attempts: 0 }, review: {},
      schemaVersion: 1
    };
    if (!candidateSnap.exists) tx.set(candidateRef, newCandidate);
    else tx.update(candidateRef, {
      occurrenceCount: FieldValue.increment(1),
      ...(orgSnap.exists ? {} : { organizationCount: FieldValue.increment(1) }),
      updatedAt: now, lastDiscoveredAt: now
    });
    tx.set(occurrenceRef, {
      id: occurrenceRef.id, candidateId, source: { organizationId, songId },
      snapshot, normalizedIdentity: identity,
      discovery: { discoveredAt: now, sourceContentFingerprint: fingerprint },
      processing: { algorithmVersion: '2.0', classification, overallScore: 0,
        reasonCodes: [], warningCodes: scanLimited ? ['SEARCH_LIMITED_NO_GLOBAL_MATCH'] : [] },
      idempotencyKey: organizationId + '_' + songId, schemaVersion: 1,
      createdAt: now, updatedAt: now
    });
    tx.set(orgRef, { addedAt: now }, { merge: true });
    const logRef = candidateRef.collection('reviewLogs').doc();
    tx.set(logRef, {
      id: logRef.id, candidateId, eventType: publish ? 'approved' : 'candidate_created',
      actorType: 'system', actorId: 'millionsnest-auto-curation',
      action: publish ? 'automatically_approved_as_unique' : 'queued_for_review',
      timestamp: FieldValue.serverTimestamp(), schemaVersion: 1,
      metadata: { organizationId, songId }
    });

    if (!publish) return 'pending';

    const globalSong = {
      ...snapshot, ...buildSearchFields(snapshot),
      normalizedTitle: identity.normalizedTitle,
      normalizedArtist: identity.normalizedArtists[0],
      normalizedArtists: identity.normalizedArtists,
      normalizedLyrics: identity.normalizedLyrics,
      lyricsFingerprint: identity.lyricsFingerprint,
      contentFingerprint: identity.contentFingerprint,
      openingLyrics: identity.openingLyrics,
      chorusLyrics: identity.chorusLyrics,
      status: 'active', importCount: 0,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
      createdBy: 'millionsnest-auto-curation', publicationMethod: 'automatic_curation',
      contribution: { organizationId, songId, userId: creatorUid, userName: creatorName }
    };
    tx.set(globalRef, globalSong);
    tx.set(titleArtistReservation, {
      globalSongId: globalRef.id, candidateId, createdAt: FieldValue.serverTimestamp()
    });
    tx.update(candidateRef, {
      status: 'approved', resultingGlobalSongId: globalRef.id,
      approvalIdempotencyKey: 'automatic_' + organizationId + '_' + songId,
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(localRef, { originGlobalSongId: globalRef.id, updatedAt: FieldValue.serverTimestamp() });
    return 'published';
  });
}
