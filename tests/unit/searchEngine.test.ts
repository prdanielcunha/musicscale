import { describe, it, expect } from "vitest";
import { normalizeSearchText, buildSearchIndex, scoreSongSearch, searchSongs, isFuzzyMatch } from "../../utils/searchEngine";
import { Song } from "../../types";

describe("searchEngine", () => {
  describe("normalizeSearchText", () => {
    it("handles accents", () => {
      expect(normalizeSearchText("Ah, Jesus!")).toBe("ah jesus");
      expect(normalizeSearchText("ORAÇÃO")).toBe("oracao");
      expect(normalizeSearchText("Espírito Santo")).toBe("espirito santo");
    });
    
    it("handles case", () => {
      expect(normalizeSearchText("A b C")).toBe("a b c");
    });

    it("handles punctuation", () => {
      expect(normalizeSearchText("hello, world. this-is/a_test")).toBe("hello world this is a test");
    });

    it("handles apostrophes", () => {
      expect(normalizeSearchText("Coração d'Ele")).toBe("coracao d ele");
    });

    it("handles duplicate spaces", () => {
      expect(normalizeSearchText("a   b")).toBe("a b");
    });

    it("handles unicode", () => {
      expect(normalizeSearchText("çãõñ")).toBe("caon");
    });

    it("handles empty string", () => {
      expect(normalizeSearchText("")).toBe("");
    });

    it("handles null/undefined", () => {
      expect(normalizeSearchText(null)).toBe("");
      expect(normalizeSearchText(undefined)).toBe("");
    });

    it("handles C# and Bb without breaking textual search", () => {
      expect(normalizeSearchText("C#")).toBe("c");
      expect(normalizeSearchText("Bb")).toBe("bb");
      expect(normalizeSearchText("F#m")).toBe("f m");
    });

    it("handles invisible chars", () => {
      expect(normalizeSearchText("a\u200Bb")).toBe("a b");
    });
  });

  describe("matching and ranking", () => {
    const mockSong = (id: string, title: string, artist: string, lyrics: string, version: string = "", chords: string = ""): Song => ({
      id, title, artist, lyrics, version, chords,
      organizationId: "org1", key: "C", tagIds: [], status: "active",
      createdAt: "", lastPlayed: null, chordsUrl: "", videoUrl: "", createdBy: { uid: "user1", displayName: "User 1", photoURL: null }
    });

    const songs = [
      mockSong("1", "Ah, Jesus", "Artist A", "eu vejo a glória do Senhor", "live", "C Am F G"),
      mockSong("2", "Jesus", "Artist B", "Letra diferente", "", "D Bm G A"),
      mockSong("3", "Oração", "Artist C", "outra letra", "", ""),
      mockSong("4", "Artist Song", "Ah, Jesus", "mais letra", "", ""),
    ];

    const docs = buildSearchIndex(songs);

    it("exact title", () => {
      const results = searchSongs(docs, "Ah, Jesus");
      expect(results[0].document.song.id).toBe("1");
      expect(results[0].score).toBeGreaterThan(900);
      expect(results[0].matchOrigin).toBe("title");
    });

    it("title starts with", () => {
      const results = searchSongs(docs, "Ah");
      expect(results[0].document.song.id).toBe("1");
      expect(results[0].matchOrigin).toBe("title");
    });

    it("part of title", () => {
      const results = searchSongs(docs, "esu");
      expect(results[0].document.song.id).toBe("2");
      expect(results[1].document.song.id).toBe("1");
    });

    it("out of order title tokens", () => {
      const results = searchSongs(docs, "jesus ah");
      expect(results[0].document.song.id).toBe("1");
      expect(results[0].score).toBeGreaterThanOrEqual(700);
    });

    it("artist match", () => {
      const results = searchSongs(docs, "Artist B");
      expect(results[0].document.song.id).toBe("2");
      expect(results[0].matchOrigin).toBe("artist");
    });

    it("version match", () => {
      const results = searchSongs(docs, "live");
      expect(results[0].document.song.id).toBe("1");
      expect(results[0].matchOrigin).toBe("version");
    });

    it("lyrics part match", () => {
      const results = searchSongs(docs, "glória");
      expect(results[0].document.song.id).toBe("1");
      expect(results[0].matchOrigin).toBe("lyrics");
    });

    it("lyrics multiple words", () => {
      const results = searchSongs(docs, "vejo senhor");
      expect(results[0].document.song.id).toBe("1");
      expect(results[0].matchOrigin).toBe("lyrics");
    });

    it("chords match", () => {
      const results = searchSongs(docs, "Am F");
      expect(results[0].document.song.id).toBe("1");
      expect(results[0].matchOrigin).toBe("chords");
    });

    it("no results", () => {
      const results = searchSongs(docs, "xyz");
      expect(results.length).toBe(0);
    });
    
    it("title exact > title partial", () => {
      const results = searchSongs(docs, "Jesus");
      expect(results[0].document.song.id).toBe("2"); // exact title "Jesus"
      expect(results[1].document.song.id).toBe("1"); // partial "Ah, Jesus"
    });

    it("title > artist", () => {
      const results = searchSongs(docs, "Ah, Jesus");
      // song 1 is title exact, song 4 is artist exact
      expect(results[0].document.song.id).toBe("1");
      expect(results[1].document.song.id).toBe("4");
    });

    it("artist > lyrics", () => {
      const docs = buildSearchIndex([
        mockSong("1", "A", "Glória", "B"),
        mockSong("2", "B", "C", "vejo a glória"),
      ]);
      const results = searchSongs(docs, "glória");
      expect(results[0].document.song.id).toBe("1");
      expect(results[1].document.song.id).toBe("2");
    });

    it("lyrics > chords", () => {
      const docs = buildSearchIndex([
        mockSong("1", "A", "B", "C Am", "D"),
        mockSong("2", "C", "D", "E", "F", "C Am"),
      ]);
      const results = searchSongs(docs, "C Am");
      expect(results[0].document.song.id).toBe("1");
      expect(results[1].document.song.id).toBe("2");
    });

    it("tie breaker stable", () => {
      const docs = buildSearchIndex([
        mockSong("2", "B", "A", "D", "E", "F"),
        mockSong("1", "A", "A", "D", "E", "F"),
      ]);
      const results = searchSongs(docs, "D");
      // both lyrics match, same score.
      // Tie break 1: title alphabetically. "A" < "B"
      expect(results[0].document.song.id).toBe("1");
      expect(results[1].document.song.id).toBe("2");
    });
  });
});
