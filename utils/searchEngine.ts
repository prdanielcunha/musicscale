import { Song } from "../types";

export function getSearchableLyrics(song: any): string {
  if (!song) return "";
  return String(song.lyrics || song.cleanLyrics || "").trim();
}

export function getSearchableChords(song: any): string {
  if (!song) return "";
  return String(song.chords || song.structuredChords || "").trim();
}

export function getSearchableAliases(song: any): string {
  if (!song) return "";
  return String(song.aliases || song.keywords || "").trim();
}

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

export function normalizeMusicalKey(input: unknown): string {
  if (typeof input !== 'string') {
    if (input == null) return "";
    input = String(input);
  }
  let key = (input as string).trim().replace(/\s+/g, '');
  key = key.replace(/♯/g, '#').replace(/♭/g, 'b');
  
  if (key.length === 0) return "";
  
  const first = key[0].toUpperCase();
  const rest = key.slice(1).toLowerCase();
  
  return first + rest;
}

export interface SongSearchDocument<T = any> {
  song: T;
  titleNormalized: string;
  artistNormalized: string;
  versionNormalized: string;
  lyricsNormalized: string;
  chordsNormalized: string;
  aliasesNormalized: string;
  combinedNormalized: string;
  titleTokens: string[];
  artistTokens: string[];
  lyricsTokens: string[];
  selectedKeyNormalized?: string;
  keyNormalized?: string;
  originalKeyNormalized?: string;
}

export const GLOBAL_SEARCH_VERSION = 2;

export function isValidMusicalKeyQuery(query: string): boolean {
  if (!query) return false;
  const normalized = normalizeMusicalKey(query);
  if (!normalized) return false;
  const keyPattern = /^[A-G]([#b])?(m|maj|min|dim|aug|sus\d?)?$/;
  return keyPattern.test(normalized);
}

export function buildTrigrams(text: string): string[] {
  const normalized = normalizeSearchText(text);
  const grams = new Set<string>();
  const tokens = normalized.split(" ").filter(t => t.length > 0);
  for (const token of tokens) {
    if (token.length >= 3) {
      for (let i = 0; i <= token.length - 3; i++) {
        grams.add(token.substring(i, i + 3));
      }
    }
  }
  return Array.from(grams);
}

export interface GlobalSongSearchFields {
  searchVersion: number;
  searchTokens: string[];
  searchTitlePrefixes: string[];
  searchArtistPrefixes: string[];
  searchTitleGrams: string[];
  searchArtistGrams: string[];
  searchKeyTokens: string[];
}

export function buildGlobalSongSearchFields(song: any): GlobalSongSearchFields {
  const searchVersion = GLOBAL_SEARCH_VERSION;

  const actualTitle = String(song.title || '').trim();
  const actualArtist = String(song.artist || '').trim();
  const actualVersion = String(song.version || '').trim();
  const actualLyrics = getSearchableLyrics(song);
  const actualAliases = getSearchableAliases(song);

  const titleNormalized = normalizeSearchText(actualTitle);
  const artistNormalized = normalizeSearchText(actualArtist);
  const versionNormalized = normalizeSearchText(actualVersion);
  const lyricsNormalized = normalizeSearchText(actualLyrics);
  const aliasesNormalized = normalizeSearchText(actualAliases);

  const keyNormalized = normalizeMusicalKey(song.key);
  const originalKeyNormalized = normalizeMusicalKey(song.originalKey);
  const selectedKeyNormalized = normalizeMusicalKey(song.selectedKey);

  const titleTokens = titleNormalized ? titleNormalized.split(" ") : [];
  const artistTokens = artistNormalized ? artistNormalized.split(" ") : [];
  const lyricsTokens = lyricsNormalized ? lyricsNormalized.split(" ") : [];
  const versionTokens = versionNormalized ? versionNormalized.split(" ") : [];
  const aliasesTokens = aliasesNormalized ? aliasesNormalized.split(" ") : [];

  const keyTokens = new Set<string>();
  if (keyNormalized) keyTokens.add(keyNormalized);
  if (originalKeyNormalized) keyTokens.add(originalKeyNormalized);
  if (selectedKeyNormalized) keyTokens.add(selectedKeyNormalized);

  const searchKeyTokens = Array.from(keyTokens);

  const stopWords = new Set(["o", "a", "e", "é", "do", "da", "de", "no", "na", "os", "as", "um", "uns", "com", "que", "para", "por"]);

  const allTokens = new Set<string>();
  
  titleTokens.forEach(t => allTokens.add(t));
  artistTokens.forEach(t => allTokens.add(t));
  versionTokens.forEach(t => allTokens.add(t));
  aliasesTokens.forEach(t => allTokens.add(t));
  searchKeyTokens.forEach(t => allTokens.add(t.toLowerCase()));

  lyricsTokens.forEach(t => {
    if (t.length > 2 && !stopWords.has(t)) {
      allTokens.add(t);
    }
  });

  const searchTokens = Array.from(allTokens).filter(t => t.length > 0).slice(0, 150);

  const buildPrefixes = (tokens: string[], minLen: number, maxPrefixes: number) => {
    const prefixes = new Set<string>();
    for (const token of tokens) {
      if (token.length >= minLen) {
        for (let i = minLen; i <= token.length; i++) {
          prefixes.add(token.substring(0, i));
          if (prefixes.size >= maxPrefixes) return Array.from(prefixes);
        }
      }
    }
    return Array.from(prefixes);
  };

  const searchTitlePrefixes = buildPrefixes(titleTokens, 3, 25);
  const searchArtistPrefixes = buildPrefixes(artistTokens, 3, 15);

  const searchTitleGrams = buildTrigrams(actualTitle);
  const searchArtistGrams = buildTrigrams(actualArtist);

  return {
    searchVersion,
    searchTokens,
    searchTitlePrefixes,
    searchArtistPrefixes,
    searchTitleGrams,
    searchArtistGrams,
    searchKeyTokens
  };
}

export function buildSearchIndex<T extends { title?: string; artist?: string; version?: string; selectedKey?: string; key?: string; originalKey?: string; }>(songs: T[]): SongSearchDocument<T>[] {
  return songs.map((song) => {
    const anySong = song as any;
    const actualTitle = String(anySong.title || '').trim();
    const actualArtist = String(anySong.artist || '').trim();
    const actualVersion = String(anySong.version || '').trim();
    const actualLyrics = getSearchableLyrics(song);
    const actualChords = getSearchableChords(song);
    const actualAliases = getSearchableAliases(song);

    const titleNormalized = normalizeSearchText(actualTitle);
    const artistNormalized = normalizeSearchText(actualArtist);
    const versionNormalized = normalizeSearchText(actualVersion);
    const lyricsNormalized = normalizeSearchText(actualLyrics);
    const chordsNormalized = normalizeSearchText(actualChords);
    const aliasesNormalized = normalizeSearchText(actualAliases);
        
    const selectedKeyNormalized = normalizeMusicalKey(anySong.selectedKey);
    const keyNormalized = normalizeMusicalKey(anySong.key);
    const originalKeyNormalized = normalizeMusicalKey(anySong.originalKey);

    const combinedNormalized = `${titleNormalized} ${artistNormalized} ${versionNormalized} ${lyricsNormalized} ${aliasesNormalized}`.trim();
    
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
      aliasesNormalized,
      combinedNormalized,
      titleTokens,
      artistTokens,
      lyricsTokens,
      selectedKeyNormalized,
      keyNormalized,
      originalKeyNormalized
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
  matchOrigin?: 'title' | 'artist' | 'lyrics' | 'version' | 'chords' | 'aliases' | 'key';
}

export function scoreSongSearch<T>(
  document: SongSearchDocument<T>, 
  normalizedQuery: string, 
  queryTokens: string[],
  normalizedKeyQuery: string = "",
  allowFuzzy: boolean = false
): SearchMatch<T> | null {
  if (!normalizedQuery && !normalizedKeyQuery) return null;

  let score = 0;
  let matchOrigin: SearchMatch['matchOrigin'] = undefined;

  const keyMatch = normalizedKeyQuery && (
    document.selectedKeyNormalized === normalizedKeyQuery ||
    document.keyNormalized === normalizedKeyQuery ||
    document.originalKeyNormalized === normalizedKeyQuery
  );

  if (!normalizedQuery && !keyMatch) return null;

  const titleExact = document.titleNormalized === normalizedQuery;
  const titleStartsWith = document.titleNormalized.startsWith(normalizedQuery);
  const titleContains = document.titleNormalized.includes(normalizedQuery);
  const titleTokensMatchAll = queryTokens.length > 0 && queryTokens.every(qt => document.titleTokens.includes(qt));

  const artistExact = document.artistNormalized === normalizedQuery;
  const artistStartsWith = document.artistNormalized.startsWith(normalizedQuery);
  const artistContains = document.artistNormalized.includes(normalizedQuery);
  const artistTokensMatchAll = queryTokens.length > 0 && queryTokens.every(qt => document.artistTokens.includes(qt));

  const versionContains = document.versionNormalized && document.versionNormalized.includes(normalizedQuery);
  const aliasesContains = document.aliasesNormalized && document.aliasesNormalized.includes(normalizedQuery);
  
  const lyricsContains = document.lyricsNormalized && document.lyricsNormalized.includes(normalizedQuery);
  const lyricsTokensMatchAll = queryTokens.length > 0 && document.lyricsTokens.length > 0 && queryTokens.every(qt => document.lyricsTokens.includes(qt));

  const chordsContains = document.chordsNormalized && document.chordsNormalized.includes(normalizedQuery);

  if (titleExact) {
    score = 1000;
    matchOrigin = 'title';
  } else if (keyMatch) {
    score = 950;
    matchOrigin = 'key';
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
  } else if (aliasesContains) {
    score = 425;
    matchOrigin = 'aliases';
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

  if (score > 0) {
    if (document.titleNormalized.length > 0) {
      const lengthDiff = Math.abs(document.titleNormalized.length - normalizedQuery.length);
      score += Math.max(0, 50 - lengthDiff);
    }
    return { document, score, matchOrigin };
  }

  // Fuzzy fallback
  if (allowFuzzy && score === 0 && normalizedQuery.length >= 4) {
    let fuzzyMatched = false;
    let fuzzyScore = 0;
    let origin: SearchMatch['matchOrigin'] = undefined;
    const tolerance = normalizedQuery.length >= 6 ? 2 : 1;
        
    // Apply length limit to tokens (max 30) for fuzzy match performance
    const isFuzzyTitle = queryTokens.every(qt => 
      document.titleTokens.some(tt => tt.length <= 30 && isFuzzyMatch(tt, qt, tolerance))
    );
    const isFuzzyArtist = queryTokens.every(qt => 
      document.artistTokens.some(at => at.length <= 30 && isFuzzyMatch(at, qt, tolerance))
    );

    if (isFuzzyTitle) {
      fuzzyMatched = true;
      fuzzyScore = 50; 
      origin = 'title';
    } else if (isFuzzyArtist) {
      fuzzyMatched = true;
      fuzzyScore = 40;
      origin = 'artist';
    }

    if (fuzzyMatched) {
      return {
        document,
        score: fuzzyScore,
        matchOrigin: origin
      };
    }
  }

  return null;
}

export function searchSongs<T extends { id?: string; title?: string; artist?: string; }>(documents: SongSearchDocument<T>[], query: string): SearchMatch<T>[] {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedKeyQuery = normalizeMusicalKey(query);
  
  if (!normalizedQuery && !normalizedKeyQuery) return documents.map(doc => ({ document: doc, score: 0 }));
  
  // Limite de tamanho de token (max 30) para performance
  const queryTokens = normalizedQuery.split(" ").filter(t => t.length > 0 && t.length <= 30);
  
  let matches = documents
    .map(doc => scoreSongSearch(doc, normalizedQuery, queryTokens, normalizedKeyQuery, false))
    .filter((match): match is SearchMatch<T> => match !== null);

  // Fallback para fuzzy search apenas se nao houve correspondencia exata e a consulta tiver tamanho minimo
  if (matches.length === 0 && normalizedQuery.length >= 4) {
    // Limitar avaliacao fuzzy a no maximo 2000 candidatos para O(n) performance bound
    matches = documents.slice(0, 2000)
      .map(doc => scoreSongSearch(doc, normalizedQuery, queryTokens, normalizedKeyQuery, true))
      .filter((match): match is SearchMatch<T> => match !== null)
      .slice(0, 50); // máximo de candidatos retornados
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aTitle = (a.document.song.title || "");
    const bTitle = (b.document.song.title || "");
    const titleCmp = aTitle.localeCompare(bTitle);
    if (titleCmp !== 0) return titleCmp;
        
    const aArtist = (a.document.song.artist || "");
    const bArtist = (b.document.song.artist || "");
    const artistCmp = aArtist.localeCompare(bArtist);
    if (artistCmp !== 0) return artistCmp;

    const aId = (a.document.song.id || "");
    const bId = (b.document.song.id || "");
    return aId.localeCompare(bId);
  });

  return matches;
}

export function getSearchSnippet(text: string | undefined, query: string, maxLength: number = 80): string | null {
  if (!text || !query) return null;
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;
  
  const queryTokens = normalizedQuery.split(" ").filter(t => t.length > 0);
  if (queryTokens.length === 0) return null;

  const lines = text.split('\n');
  
  for (const line of lines) {
    const normLine = normalizeSearchText(line);
    if (normLine.includes(normalizedQuery)) {
      return formatSnippet(line, maxLength);
    }
  }

  for (const line of lines) {
    const normLine = normalizeSearchText(line);
    if (normLine && queryTokens.every(qt => normLine.includes(qt))) {
      return formatSnippet(line, maxLength);
    }
  }

  for (const line of lines) {
    const normLine = normalizeSearchText(line);
    if (normLine && queryTokens.some(qt => normLine.includes(qt))) {
      return formatSnippet(line, maxLength);
    }
  }

  return null;
}

function formatSnippet(line: string, maxLength: number): string | null {
  let snippet = line.trim();
  if (!snippet) return null;
  if (snippet.length > maxLength) {
     snippet = snippet.substring(0, maxLength) + "…";
  }
  return `…${snippet}…`;
}
