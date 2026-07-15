import { SongSnapshot, NormalizedSongIdentity } from './types.js';
import { normalizeTitle } from './titleNormalization.js';
import { normalizeArtist } from './artistNormalization.js';
import { normalizeLyrics, extractOpeningLyrics, extractChorusLyrics } from './lyricsNormalization.js';
import { generateFingerprint } from './fingerprint.js';

export function extractSongIdentity(snapshot: SongSnapshot): NormalizedSongIdentity {
  const { normalizedTitle, compactTitle, titleTokens, removedTerms } = normalizeTitle(snapshot.title);
  
  const originalArtist = snapshot.artist?.trim() || '';
  const normalizedArtists = normalizeArtist(originalArtist);

  const rawTextForLyrics = snapshot.chords ? snapshot.chords : snapshot.lyrics;
  const normalizedLyrics = normalizeLyrics(rawTextForLyrics);
  const openingLyrics = extractOpeningLyrics(rawTextForLyrics);
  const chorusLyrics = extractChorusLyrics(rawTextForLyrics);

  const titleFingerprint = generateFingerprint(normalizedTitle) ?? '';
  const lyricsFingerprint = generateFingerprint(normalizedLyrics);
  const openingFingerprint = generateFingerprint(openingLyrics);
  const chorusFingerprint = generateFingerprint(chorusLyrics);

  // Use a stable string for the master content fingerprint
  const contentInput = [
    titleFingerprint,
    normalizedArtists.join('|'),
    lyricsFingerprint ?? '',
  ].join('::');
  
  const contentFingerprint = generateFingerprint(contentInput) ?? '';

  return {
    originalTitle: snapshot.title,
    normalizedTitle,
    compactTitle,
    titleTokens,
    removedTitleTerms: removedTerms,
    originalArtist: originalArtist.length > 0 ? originalArtist : undefined,
    normalizedArtists,
    normalizedLyrics,
    openingLyrics,
    chorusLyrics,
    titleFingerprint,
    lyricsFingerprint,
    openingFingerprint,
    chorusFingerprint,
    contentFingerprint,
    externalReferences: {
      youtubeVideoId: extractYoutubeId(snapshot.videoUrl),
      chordsUrl: snapshot.chordsUrl || null,
      sourceUrl: null, // For future CCLI/SongSelect linkage
    }
  };
}

export function extractYoutubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  // Ensure we only read from valid youtube.com or youtu.be domains.
  let cleanUrl = url.trim();
  try {
     const parsed = new URL(cleanUrl);
     if (!parsed.hostname.endsWith('youtube.com') && !parsed.hostname.endsWith('youtu.be')) {
         return null; 
     }
  } catch (e) {
     return null; // Invalid URL structure
  }
  
  // Exclude playlists or channels from being evaluated as direct video equivalents unless they carry a video id
  const match = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|watch\?v=|watch\?.+&v=))([^#&?]*).*/);
  return (match && match[1]?.length === 11) ? match[1] : null;
}
