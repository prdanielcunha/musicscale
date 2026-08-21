import { describe, expect, it } from "vitest";
import {
  buildGlobalSongContentSearchTokens,
  extractSearchableChordLyrics,
  getGlobalSongSearchableContent,
} from "../../utils/globalSongSearchContent";

describe("global song searchable content", () => {
  it("uses lyrics first and cleanLyrics as textual fallback", () => {
    expect(getGlobalSongSearchableContent({ lyrics: "  Fé eu tu  ", cleanLyrics: "fallback" }).lyricsText)
      .toBe("Fé eu tu");
    expect(getGlobalSongSearchableContent({ lyrics: "   ", cleanLyrics: "Fallback lyric" }).lyricsText)
      .toBe("Fallback lyric");
    expect(buildGlobalSongContentSearchTokens({ lyrics: "Fé eu tu" })).toEqual(["fe", "eu", "tu"]);
  });

  it("extracts singable chord text without indexing chord symbols", () => {
    const chords = [
      "C       G",
      "Porque Ele vive",
      "Am      F",
      "Posso crer no amanhã",
      "[G]Porque [C]Ele vive",
    ].join("\n");

    expect(extractSearchableChordLyrics(chords)).toBe(
      "Porque Ele vive\nPosso crer no amanhã\nPorque Ele vive",
    );
    expect(buildGlobalSongContentSearchTokens({ chords })).toEqual([
      "porque",
      "ele",
      "vive",
      "posso",
      "crer",
      "no",
      "amanha",
    ]);
  });

  it("excludes tabs, chord dictionaries, metadata, site noise, and section headers", () => {
    const chords = [
      "Tom: G",
      "[Refrão]",
      "G C",
      "Tu és fiel",
      "e|----------------|",
      "B|--1--3--5-------|",
      "022100",
      "Remover anúncios",
      "[Chorus]",
      "Grace remains",
    ].join("\n");

    const tokens = buildGlobalSongContentSearchTokens({ chords });
    expect(tokens).toEqual(["tu", "es", "fiel", "grace", "remains"]);
    for (const excluded of ["tom", "g", "refrao", "chorus", "remover", "anuncios", "022100"]) {
      expect(tokens).not.toContain(excluded);
    }
  });

  it("keeps lyrics and chord-derived lyrics as separate origins and deduplicates combined tokens", () => {
    const content = getGlobalSongSearchableContent({
      lyrics: "Porque Ele vive",
      chords: "G C\nPorque Ele vive",
    });

    expect(content).toEqual({
      lyricsText: "Porque Ele vive",
      chordLyricsText: "Porque Ele vive",
      combinedText: "Porque Ele vive\nPorque Ele vive",
    });
    expect(buildGlobalSongContentSearchTokens({
      lyrics: "Porque Ele vive",
      chords: "G C\nPorque Ele vive",
    })).toEqual(["porque", "ele", "vive"]);
  });

  it("normalizes language-agnostic PT, EN, and ES content in first-occurrence order", () => {
    expect(buildGlobalSongContentSearchTokens({
      lyrics: "Calvário e fé\nAmazing grace\nGracia y canción",
    })).toEqual(["calvario", "e", "fe", "amazing", "grace", "gracia", "y", "cancion"]);
  });

  it("does not cap content tokens at 150 or discard a late explicit word", () => {
    const uniqueTokens = Array.from({ length: 151 }, (_, index) => `palavra${index}`);
    const lyrics = [...uniqueTokens, "muralhas"].join(" ");
    const tokens = buildGlobalSongContentSearchTokens({ lyrics });

    expect(tokens).toHaveLength(152);
    expect(tokens[150]).toBe("palavra150");
    expect(tokens[151]).toBe("muralhas");
  });

  it("is deterministic", () => {
    const song = { lyrics: "fé eu tu fé", chords: "C G\nWalls fall down" };
    expect(buildGlobalSongContentSearchTokens(song)).toEqual(buildGlobalSongContentSearchTokens(song));
  });

  it("handles missing and unexpected legacy values without stringifying objects", () => {
    const unexpectedSongs = [
      undefined,
      null,
      [],
      { lyrics: { text: "hidden" }, cleanLyrics: 42, chords: ["C", "G"], structuredChords: {} },
    ];

    for (const song of unexpectedSongs) {
      expect(() => getGlobalSongSearchableContent(song)).not.toThrow();
      expect(buildGlobalSongContentSearchTokens(song)).toEqual([]);
      expect(buildGlobalSongContentSearchTokens(song)).not.toContain("object");
    }
  });

  it("uses structuredChords only as the legacy textual fallback", () => {
    expect(getGlobalSongSearchableContent({ structuredChords: "Am F\nTu amor permanece" }).chordLyricsText)
      .toBe("Tu amor permanece");
    expect(getGlobalSongSearchableContent({ chords: {}, structuredChords: "C G\nGrace remains" }).chordLyricsText)
      .toBe("Grace remains");
  });
});
