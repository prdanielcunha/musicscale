import { normalizeSearchText } from "./searchNormalization.js";

export interface GlobalSongSearchableContent {
  lyricsText: string;
  chordLyricsText: string;
  combinedText: string;
}

function getTextField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getTextWithFallback(primary: unknown, fallback: unknown): string {
  return getTextField(primary) || getTextField(fallback);
}

const SEARCH_NOISE_PATTERNS = [
  "cifra: principal",
  "rolagem automática",
  "favoritar cifra",
  "remover anúncios",
  "apple music",
  "spotify",
  "deezer",
  "formas de acorde",
  "forma dos acordes",
  "chord shape",
  "remove ads",
  "add to favorites",
  "quitar anuncios",
  "desplazamiento automático",
  "cambiar tono",
];

function isSearchNoiseLine(line: string): boolean {
  const normalized = normalizeSearchText(line);
  if (!normalized) return false;

  if (SEARCH_NOISE_PATTERNS.some(pattern => normalized.includes(normalizeSearchText(pattern)))) {
    return true;
  }

  return /^(tom|key|tono|tonalidad|capotraste|capo|cejilla|bpm|shape)\b/.test(normalized);
}

function isTabOrDictionaryLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^[eEBGDA]\s*\|[-0-9hbp/~\s|().]+$/.test(trimmed)) return true;
  if ((trimmed.match(/[-|]/g) || []).length > 10) return true;
  if (/^[xX0-9\s-]{4,12}$/.test(trimmed) && !/^\d{1,3}$/.test(trimmed)) return true;
  return false;
}

function isSearchChordToken(rawToken: string): boolean {
  let token = rawToken.trim();
  token = token.replace(/^[|(]+/, "").replace(/[|),.;:]+$/, "");
  if (!token) return false;

  return /^[A-G][#b]?(?:(?:m|M|maj|min|dim|aug|sus|add)?\d*(?:m|M|maj|min|dim|aug|sus|add)?(?:\([^)]+\))?(?:\/[A-G][#b]?)?)$/i.test(token);
}

function stripChordProChords(line: string): string {
  return line.replace(/\[[A-G][#b]?(?:[^\]]*)\]/gi, "");
}

function extractSingableLine(line: string): string {
  const withoutChordPro = stripChordProChords(line).trim();
  if (!withoutChordPro) return "";

  const tokens = withoutChordPro.split(/\s+/);
  const nonChordTokens = tokens.filter(token => !isSearchChordToken(token));
  if (nonChordTokens.length === 0) return "";

  return nonChordTokens.join(" ").trim();
}

export function extractSearchableChordLyrics(chords: unknown): string {
  if (typeof chords !== "string" || !chords.trim()) return "";

  const singableLines: string[] = [];
  for (const line of chords.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\[[^\]]+\]$/.test(trimmed)) continue;
    if (isSearchNoiseLine(trimmed)) continue;
    if (isTabOrDictionaryLine(trimmed)) continue;

    const singable = extractSingableLine(trimmed);
    if (singable) singableLines.push(singable);
  }

  return singableLines.join("\n").trim();
}

export function getGlobalSongSearchableContent(song: unknown): GlobalSongSearchableContent {
  if (!song || typeof song !== "object" || Array.isArray(song)) {
    return { lyricsText: "", chordLyricsText: "", combinedText: "" };
  }

  const record = song as Record<string, unknown>;
  const lyricsText = getTextWithFallback(record.lyrics, record.cleanLyrics);
  const chordsText = getTextWithFallback(record.chords, record.structuredChords);
  const chordLyricsText = extractSearchableChordLyrics(chordsText);
  const combinedText = [lyricsText, chordLyricsText].filter(Boolean).join("\n");

  return { lyricsText, chordLyricsText, combinedText };
}

export function buildGlobalSongContentSearchTokens(song: unknown): string[] {
  const { combinedText } = getGlobalSongSearchableContent(song);
  const normalizedContent = normalizeSearchText(combinedText);
  return normalizedContent ? Array.from(new Set(normalizedContent.split(" "))) : [];
}
