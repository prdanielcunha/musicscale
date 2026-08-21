import { classifyLine, generateLyricsOnly, LineType } from "./chordEngine";
import { normalizeSearchText } from "./searchEngine";

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

export function extractSearchableChordLyrics(chords: unknown): string {
  if (typeof chords !== "string" || !chords.trim()) return "";

  const lines = chords.split(/\r?\n/);
  const classifiedLines = lines.map((line, index) => classifyLine(line, index, lines));
  const singableLines = classifiedLines.filter(
    ({ type }) => type === LineType.LYRIC_LINE || type === LineType.CHORD_AND_LYRIC_LINE,
  );

  return generateLyricsOnly(singableLines).trim();
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
