import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { generateLyricsFromChords } from '../utils/generateLyricsFromChords';

/**
 * A transactional write deliberately avoids the stale-client overwrite race.
 * Only the missing lyrics field is changed; charts, metadata and song ownership
 * are never replaced.
 */
export async function saveGeneratedSongLyrics(args: {
  songId: string;
  organizationId: string;
  userId: string;
  expectedChords: string;
  lyrics: string;
}): Promise<void> {
  const { songId, organizationId, userId, expectedChords, lyrics } = args;
  if (!songId || !organizationId || !userId || !lyrics.trim() ||
      auth.currentUser?.uid !== userId ||
      !generateLyricsFromChords(expectedChords).hasSungContent) {
    throw new Error('INVALID_LYRICS_GENERATION');
  }
  const ref = doc(db, 'songs', songId);
  await runTransaction(db, async tx => {
    const snapshot = await tx.get(ref);
    if (auth.currentUser?.uid !== userId) throw new Error('USER_CHANGED');
    if (!snapshot.exists() || snapshot.data().organizationId !== organizationId) {
      throw new Error('SONG_ORGANIZATION_CHANGED');
    }
    const liveSong = snapshot.data();
    if (typeof liveSong.lyrics === 'string' && liveSong.lyrics.trim()) {
      throw new Error('SONG_LYRICS_ALREADY_EXIST');
    }
    if (liveSong.chords !== expectedChords) throw new Error('SONG_CHORDS_CHANGED');
    tx.update(ref, { lyrics: lyrics.trim(), lastModifiedAt: serverTimestamp(),
      lastModifiedBy: { uid: userId } });
    tx.set(doc(collection(db, 'audits')), {
      action: 'UPDATE', targetCollection: 'songs', targetId: songId,
      details: { generatedLyricsFromChords: true }, user: { uid: userId },
      organizationId, timestamp: serverTimestamp(),
    });
  });
}
