import { describe, expect, it } from "vitest";
import { buildPersonalPracticeSummary } from "../../components/songs/personalPractice";

describe("personal practice intelligence", () => {
  const songs = [
    {
      id: "song-1",
      title: "Abertura",
      chords: "[Verso]\nC G Am F",
      tabs: [],
      metadata: {},
    },
    {
      id: "song-2",
      title: "Promessas",
      chords: "[Solo Guitarra]\nAm F C G\n[Riff Baixo]\nAm G F",
      tabs: [],
      metadata: {},
    },
    {
      id: "song-3",
      title: "Final",
      chords: "[Lead Guitar]\nG D Em C\n[Refrão]\nC G D",
      tabs: [],
      metadata: {
        sectionAnnotations: [
          {
            section: "Lead Guitar",
            type: "solo",
            instrument: "guitar",
            confidence: "high",
          },
        ],
      },
    },
  ] as any;

  it("keeps the real setlist order and includes only songs relevant to the assignment", () => {
    const summary = buildPersonalPracticeSummary(songs, ["Guitarra"]);

    expect(summary.songCount).toBe(2);
    expect(summary.partCount).toBe(2);
    expect(summary.firstSongId).toBe("song-2");
    expect(summary.songs.map(song => song.songId)).toEqual(["song-2", "song-3"]);
    expect(summary.songs.map(song => song.order)).toEqual([2, 3]);
    expect(summary.songs[0].partLabels).toEqual(["Solo Guitarra"]);
  });

  it("does not invent a technical focus for non-instrument assignments", () => {
    const summary = buildPersonalPracticeSummary(songs, ["Vocal", "Ministro"]);

    expect(summary.songCount).toBe(0);
    expect(summary.partCount).toBe(0);
    expect(summary.firstSongId).toBeNull();
  });
});
