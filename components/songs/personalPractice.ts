import type { PopulatedSong } from "../../types";
import {
  buildSongParts,
  getFocusedSongParts,
} from "./songParts";

export interface PersonalPracticeSongSummary {
  songId: string;
  title: string;
  order: number;
  focusPartCount: number;
  totalPartCount: number;
  partLabels: string[];
}

export interface PersonalPracticeSummary {
  assignmentNames: string[];
  songs: PersonalPracticeSongSummary[];
  songCount: number;
  partCount: number;
  firstSongId: string | null;
}

/**
 * Builds a personal practice queue without creating new song data.
 * The queue deliberately preserves the setlist order so preparation matches
 * the real worship flow instead of inventing an unrelated ranking.
 */
export function buildPersonalPracticeSummary(
  songs: PopulatedSong[] | null | undefined,
  assignmentNames: string[] | null | undefined,
): PersonalPracticeSummary {
  const normalizedAssignments = (assignmentNames || [])
    .map(value => String(value).trim())
    .filter(Boolean);

  const practiceSongs = (songs || [])
    .map((song, index): PersonalPracticeSongSummary | null => {
      const parts = buildSongParts(song);
      const focusedParts = getFocusedSongParts(parts, normalizedAssignments);
      if (focusedParts.length === 0) return null;

      return {
        songId: song.id,
        title: song.title,
        order: index + 1,
        focusPartCount: focusedParts.length,
        totalPartCount: parts.length,
        partLabels: focusedParts.map(part => part.displayLabel),
      };
    })
    .filter((song): song is PersonalPracticeSongSummary => Boolean(song));

  return {
    assignmentNames: normalizedAssignments,
    songs: practiceSongs,
    songCount: practiceSongs.length,
    partCount: practiceSongs.reduce(
      (total, song) => total + song.focusPartCount,
      0,
    ),
    firstSongId: practiceSongs[0]?.songId || null,
  };
}
