import { createHash } from 'node:crypto';
import { buildGlobalSongSearchFields } from '../../utils/searchEngine.js';
import { extractSongIdentity } from '../../utils/songDiscovery/identityGenerator.js';

const hash = (input: string) => createHash('sha256').update(input).digest('hex');
const isId = (value: unknown) => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
const iso = (value: any) => value?.toDate ? value.toDate().toISOString()
  : (typeof value === 'string' ? value : null);

export function registerGlobalCurationCatalog(app: any, db: any, admin: any, requireRole: any) {
  // The canonical MillionsNest global role middleware gates every endpoint,
  // regardless of which organization the curator currently has selected.
  app.get('/api/curation/global-songs', requireRole, async (req: any, res: any) => {
    try {
      if (!db) return res.status(503).json({ error: 'DB_UNAVAILABLE' });
      const limit = Math.max(1, Math.min(25, Number(req.query.limit) || 25));
      const cursor = req.query.after;
      if (cursor !== undefined && !isId(cursor)) return res.status(400).json({ error: 'INVALID_CURSOR' });
      let q = db.collection('globalSongs').where('status', '==', 'active')
        .orderBy(admin.firestore.FieldPath.documentId()).limit(limit + 1);
      if (cursor) q = q.startAfter(cursor);
      const snap = await q.get();
      const docs = snap.docs.slice(0, limit);
      const orgIds = [...new Set(docs.map((d: any) => d.data().contribution?.organizationId).filter(isId))] as string[];
      const orgDocs = await Promise.all(orgIds.map((id: string) => db.collection('organizations').doc(id).get()));
      const names = new Map(orgDocs.filter((d: any) => d.exists).map((d: any) => [d.id, d.data().name || d.id]));
      const rows = docs.map((doc: any) => {
        const data = doc.data();
        const origin = data.contribution || {};
        return {
          id: doc.id, title: data.title || '', artist: data.artist || '',
          key: data.key || 'C', bpm: data.bpm ?? null,
          lyrics: data.lyrics || '', chords: data.chords || '',
          organizationId: origin.organizationId || '',
          organizationName: names.get(origin.organizationId) || origin.organizationId || '',
          addedBy: origin.userName || '', addedByUid: origin.userId || '',
          publicationMethod: data.publicationMethod || 'historical',
          addedAt: iso(data.createdAt), updatedAt: iso(data.updatedAt)
        };
      });
      return res.json({ songs: rows, hasMore: snap.docs.length > limit,
        nextCursor: docs.length ? docs[docs.length - 1].id : null });
    } catch (err) {
      console.error('[CurationCatalog] list failed', err);
      return res.status(500).json({ error: 'GLOBAL_SONG_LIST_FAILED' });
    }
  });

  app.patch('/api/curation/global-songs/:id', requireRole, async (req: any, res: any) => {
    try {
      if (!db) return res.status(503).json({ error: 'DB_UNAVAILABLE' });
      if (!isId(req.params.id)) return res.status(400).json({ error: 'INVALID_ID' });
      const body = req.body || {};
      const editable = ['title', 'artist', 'lyrics', 'chords', 'key', 'bpm'];
      if (!Object.keys(body).length || Object.keys(body).some(k => !editable.includes(k)))
        return res.status(400).json({ error: 'INVALID_FIELDS' });
      for (const key of editable.filter(k => k !== 'bpm')) {
        if (body[key] !== undefined && (typeof body[key] !== 'string' ||
          body[key].length > (key === 'lyrics' || key === 'chords' ? 24000 : 250)))
          return res.status(400).json({ error: 'INVALID_FIELD_' + key });
      }
      if (body.bpm !== undefined && body.bpm !== null &&
          (!Number.isFinite(body.bpm) || body.bpm < 20 || body.bpm > 350))
        return res.status(400).json({ error: 'INVALID_BPM' });
      const ref = db.collection('globalSongs').doc(req.params.id);
      const actorUid = req.ecosystemContext?.uid;
      if (!actorUid) return res.status(403).json({ error: 'FORBIDDEN' });
      await db.runTransaction(async (tx: any) => {
        const oldSnap = await tx.get(ref);
        if (!oldSnap.exists || oldSnap.data().status !== 'active') throw new Error('SONG_NOT_EDITABLE');
        const prior = oldSnap.data();
        const updated = { ...prior, ...body };
        if (!updated.title?.trim()) throw new Error('MISSING_TITLE');
        const identity = extractSongIdentity({
          title: updated.title, artist: updated.artist || '', lyrics: updated.lyrics || '',
          chords: updated.chords || '', key: updated.key || 'C',
          chordsUrl: '', videoUrl: ''
        });
        const titleMatches = await tx.get(db.collection('globalSongs')
          .where('normalizedTitle', '==', identity.normalizedTitle));
        for (const other of titleMatches.docs) {
          if (other.id === ref.id || other.data().status !== 'active') continue;
          const artists = other.data().normalizedArtists ||
            (other.data().normalizedArtist ? [other.data().normalizedArtist] : []);
          if (artists.length && identity.normalizedArtists.length &&
            artists.some((artist: string) => identity.normalizedArtists.includes(artist))) {
            throw new Error('DUPLICATE_GLOBAL_SONG');
          }
        }
        const uniqueKey = db.collection('globalSongUniqueKeys').doc(hash(identity.normalizedTitle +
          '|' + identity.normalizedArtists.join('|')));
        const keySnap = await tx.get(uniqueKey);
        if (keySnap.exists && keySnap.data().globalSongId !== ref.id)
          throw new Error('DUPLICATE_GLOBAL_SONG');
        const patch = {
          ...body,
          ...buildGlobalSongSearchFields(updated),
          normalizedTitle: identity.normalizedTitle,
          normalizedArtist: identity.normalizedArtists[0] || '',
          normalizedArtists: identity.normalizedArtists,
          normalizedLyrics: identity.normalizedLyrics,
          lyricsFingerprint: identity.lyricsFingerprint,
          contentFingerprint: identity.contentFingerprint,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: actorUid
        };
        const logRef = db.collection('globalCurationAudit').doc();
        tx.update(ref, patch);
        tx.set(uniqueKey, { globalSongId: ref.id, updatedBy: actorUid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        tx.set(logRef, { action: 'edit_global_song', songId: ref.id, actorUid,
          fields: Object.keys(body), timestamp: admin.firestore.FieldValue.serverTimestamp() });
      });
      return res.json({ success: true });
    } catch (err: any) {
      if (['SONG_NOT_EDITABLE', 'DUPLICATE_GLOBAL_SONG', 'MISSING_TITLE'].includes(err?.message))
        return res.status(409).json({ error: err.message });
      console.error('[CurationCatalog] update failed', err);
      return res.status(500).json({ error: 'GLOBAL_SONG_UPDATE_FAILED' });
    }
  });

  // Soft archive only. Never delete the customer's tenant-scoped repertoire,
  // existing published scales, or other organizations' copies.
  app.post('/api/curation/global-songs/bulk-archive', requireRole, async (req: any, res: any) => {
    if (!db) return res.status(503).json({ error: 'DB_UNAVAILABLE' });
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 25 ||
        ids.some(id => !isId(id)) || new Set(ids).size !== ids.length)
      return res.status(400).json({ error: 'INVALID_SELECTION' });
    const actorUid = req.ecosystemContext?.uid;
    if (!actorUid) return res.status(403).json({ error: 'FORBIDDEN' });
    const results = [];
    for (const id of ids) {
      try {
        const ref = db.collection('globalSongs').doc(id);
        const action = await db.runTransaction(async (tx: any) => {
          const snap = await tx.get(ref);
          if (!snap.exists || snap.data().status !== 'active') return 'already_inactive';
          const logRef = db.collection('globalCurationAudit').doc();
          tx.update(ref, { status: 'archived', archivedBy: actorUid,
            archivedAt: admin.firestore.FieldValue.serverTimestamp() });
          tx.set(logRef, { action: 'archive_global_song', songId: id, actorUid,
            timestamp: admin.firestore.FieldValue.serverTimestamp() });
          return 'archived';
        });
        results.push({ id, status: action });
      } catch {
        results.push({ id, status: 'failed' });
      }
    }
    return res.json({ results });
  });
}
