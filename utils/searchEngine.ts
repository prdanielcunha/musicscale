import { Song } from "../types";

export function normalizeSearchText(input: unknown): string {
  if (typeof input !== "string") {
    if (input == null) return "";
    return String(input).trim().toLowerCase();
  }

  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .toLowerCase()
    .replace(/['"´`\u2018-\u201D]/g, " ") // Remove quotes/apostrophes
    .replace(/[^\p{L}\p{N}]/gu, " ") // Replace punctuation with space, keep letters and numbers
    .replace(/[\u200B-\u200D\uFEFF]/g, " ") // invisible chars
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim();
}

export interface SongSearchDocument<T = any> {
  song: T;
  titleNormalized: string;
  artistNormalized: string;
  versionNormalized: string;
  lyricsNormalized: string;
  chordsNormalized: string;
  combinedNormalized: string;
  titleTokens: string[];
  artistTokens: string[];
  lyricsTokens: string[];
}

export function buildSearchIndex<T extends { title: string; artist: string; version?: string; lyrics?: string; chords?: string }>(songs: T[]): SongSearchDocument<T>[] {
  return songs.map((song) => {
    const titleNormalized = normalizeSearchText(song.title);
    const artistNormalized = normalizeSearchText(song.artist);
    const versionNormalized = normalizeSearchText(song.version);
    const lyricsNormalized = normalizeSearchText(song.lyrics);
    const chordsNormalized = normalizeSearchText(song.chords);
    
    // We don't really need combinedNormalized if we search fields separately, but good for simple fallback.
    const combinedNormalized = `${titleNormalized} ${artistNormalized} ${versionNormalized} ${lyricsNormalized}`.trim();

    const titleTokens = titleNormalized ? titleNormalized.split(" ") : [];
    const artistTokens = artistNormalized ? artistNormalized.split(" ") : [];
    const lyricsTokens = lyricsNormalized ? lyricsNormalized.split(" ") : [];

    return {
      song,
      titleNormalized,
      artistNormalized,
      versionNormalized,
      lyricsNormalized,
      chordsNormalized,
      combinedNormalized,
      titleTokens,
      artistTokens,
      lyricsTokens,
    };
  });
}

// Simple Levenshtein distance
export function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

export function isFuzzyMatch(token: string, queryToken: string, tolerance: number): boolean {
  if (Math.abs(token.length - queryToken.length) > tolerance) return false;
  return levenshteinDistance(token, queryToken) <= tolerance;
}

export interface SearchMatch<T = any> {
  document: SongSearchDocument<T>;
  score: number;
  matchOrigin?: 'title' | 'artist' | 'lyrics' | 'version' | 'chords';
}

export function scoreSongSearch<T>(document: SongSearchDocument<T>, normalizedQuery: string, queryTokens: string[]): SearchMatch<T> | null {
  if (!normalizedQuery) return null;

  let score = 0;
  let matchOrigin: SearchMatch['matchOrigin'] = undefined;

  const titleExact = document.titleNormalized === normalizedQuery;
  const titleStartsWith = document.titleNormalized.startsWith(normalizedQuery);
  const titleContains = document.titleNormalized.includes(normalizedQuery);
  const titleTokensMatchAll = queryTokens.length > 0 && queryTokens.every(qt => document.titleTokens.includes(qt));

  const artistExact = document.artistNormalized === normalizedQuery;
  const artistStartsWith = document.artistNormalized.startsWith(normalizedQuery);
  const artistContains = document.artistNormalized.includes(normalizedQuery);
  const artistTokensMatchAll = queryTokens.length > 0 && queryTokens.every(qt => document.artistTokens.includes(qt));

  const versionContains = document.versionNormalized && document.versionNormalized.includes(normalizedQuery);
  
  const lyricsContains = document.lyricsNormalized && document.lyricsNormalized.includes(normalizedQuery);
  const lyricsTokensMatchAll = queryTokens.length > 0 && document.lyricsTokens.length > 0 && queryTokens.every(qt => document.lyricsTokens.includes(qt));

  const chordsContains = document.chordsNormalized && document.chordsNormalized.includes(normalizedQuery);

  if (titleExact) {
    score = 1000;
    matchOrigin = 'title';
  } else if (titleStartsWith) {
    score = 900;
    matchOrigin = 'title';
  } else if (titleContains) {
    score = 800;
    matchOrigin = 'title';
  } else if (titleTokensMatchAll) {
    score = 700;
    matchOrigin = 'title';
  } else if (artistExact || artistStartsWith) {
    score = 600;
    matchOrigin = 'artist';
  } else if (artistContains) {
    score = 500;
    matchOrigin = 'artist';
  } else if (artistTokensMatchAll) {
    score = 450;
    matchOrigin = 'artist';
  } else if (versionContains) {
    score = 400;
    matchOrigin = 'version';
  } else if (lyricsContains) {
    score = 300;
    matchOrigin = 'lyrics';
  } else if (lyricsTokensMatchAll) {
    score = 200;
    matchOrigin = 'lyrics';
  } else if (chordsContains) {
    score = 100;
    matchOrigin = 'chords';
  }

  // Bonus points
  if (score > 0) {
    if (document.titleNormalized.length > 0) {
      // Bonus for shorter titles closer to query length
      const lengthDiff = Math.abs(document.titleNormalized.length - normalizedQuery.length);
      score += Math.max(0, 50 - lengthDiff);
    }
  }

  // Fuzzy fallback if no normal match and query length >= 4
  if (score === 0 && normalizedQuery.length >= 4) {
    // Only on title and artist
    let fuzzyMatched = false;
    let fuzzyScore = 0;
    let origin: SearchMatch['matchOrigin'] = undefined;

    const tolerance = normalizedQuery.length >= 6 ? 2 : 1;
    
    // Check if any query token is a fuzzy match to any title or artist token
    const isFuzzyTitle = queryTokens.every(qt => document.titleTokens.some(tt => isFuzzyMatch(tt, qt, tolerance)));
    const isFuzzyArtist = queryTokens.every(qt => document.artistTokens.some(at => isFuzzyMatch(at, qt, tolerance)));

    if (isFuzzyTitle) {
      fuzzyMatched = true;
      fuzzyScore = 50; // Low score for fuzzy
      origin = 'title';
    } else if (isFuzzyArtist) {
      fuzzyMatched = true;
      fuzzyScore = 40;
      origin = 'artist';
    }

    if (fuzzyMatched) {
      score = fuzzyScore;
      matchOrigin = origin;
    }
  }

  if (score > 0) {
    return {
      document,
      score,
      matchOrigin
    };
  }

  return null;
}

export function searchSongs<T extends { id: string; title: string; artist: string; }>(documents: SongSearchDocument<T>[], query: string): SearchMatch<T>[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return documents.map(doc => ({ document: doc, score: 0 }));

  const queryTokens = normalizedQuery.split(" ").filter(t => t.length > 0);
  
  const matches = documents
    .map(doc => scoreSongSearch(doc, normalizedQuery, queryTokens))
    .filter((match): match is SearchMatch<T> => match !== null);

  // Sort by score descending, then tie-breakers (title alphabetically, artist, ID)
  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const titleCmp = a.document.song.title.localeCompare(b.document.song.title);
    if (titleCmp !== 0) return titleCmp;
    
    const artistCmp = a.document.song.artist.localeCompare(b.document.song.artist);
    if (artistCmp !== 0) return artistCmp;

    return a.document.song.id.localeCompare(b.document.song.id);
  });

  return matches;
}

export function getSearchSnippet(text: string | undefined, query: string, maxLength: number = 80): string | null {
  if (!text || !query) return null;
  const normalizedQuery = normalizeSearchText(query);
  const normalizedText = normalizeSearchText(text);

  if (!normalizedQuery || !normalizedText) return null;

  const idx = normalizedText.indexOf(normalizedQuery);
  if (idx === -1) {
    // If exact doesn't match, maybe all tokens match. We could find the first token.
    const queryTokens = normalizedQuery.split(" ").filter(t => t.length > 0);
    if (queryTokens.length === 0) return null;

    let firstIdx = -1;
    for (const qt of queryTokens) {
      const matchIdx = normalizedText.indexOf(qt);
      if (matchIdx !== -1 && (firstIdx === -1 || matchIdx < firstIdx)) {
        firstIdx = matchIdx;
      }
    }
    if (firstIdx === -1) return null;
    return extractSnippet(text, normalizedText, firstIdx, maxLength);
  }

  return extractSnippet(text, normalizedText, idx, maxLength);
}

function extractSnippet(original: string, normalized: string, matchIdx: number, maxLength: number): string {
  // Approximate the original index by using ratio or simple word matching.
  // Since normalizer removes some chars, indices might shift.
  // We'll do a simple fallback: just find the word roughly at that ratio.
  const ratio = matchIdx / normalized.length;
  const originalIdx = Math.floor(ratio * original.length);

  // We want to extract a snippet around originalIdx, preferably a full line
  const startLine = original.lastIndexOf("\n", originalIdx);
  const endLine = original.indexOf("\n", originalIdx);
  
  const start = startLine === -1 ? 0 : startLine + 1;
  const end = endLine === -1 ? original.length : endLine;

  let snippet = original.substring(start, end).trim();
  
  if (snippet.length > maxLength) {
     snippet = snippet.substring(0, maxLength) + "...";
  }

  return `…${snippet}…`;
}
