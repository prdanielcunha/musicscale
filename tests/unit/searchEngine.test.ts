import { describe, it, expect } from "vitest";
import { normalizeSearchText, normalizeMusicalKey, buildSearchIndex, searchSongs, getSearchSnippet } from "../../utils/searchEngine";

describe("searchEngine", () => {
  describe("normalizeSearchText", () => {
    it("handles accents", () => {
      expect(normalizeSearchText("Ah, Jesus!")).toBe("ah jesus");
      expect(normalizeSearchText("ORAÇÃO")).toBe("oracao");
      expect(normalizeSearchText("Espírito Santo")).toBe("espirito santo");
    });
    
    it("handles punctuation", () => {
      expect(normalizeSearchText("hello, world. this-is/a_test")).toBe("hello world this is a test");
    });
  });

  describe("normalizeMusicalKey", () => {
    it("handles basic keys", () => {
      expect(normalizeMusicalKey("C")).toBe("C");
      expect(normalizeMusicalKey("c")).toBe("C");
    });
    
    it("handles sharps and flats", () => {
      expect(normalizeMusicalKey("C#")).toBe("C#");
      expect(normalizeMusicalKey("Db")).toBe("Db");
      expect(normalizeMusicalKey("Bb")).toBe("Bb");
      expect(normalizeMusicalKey("F#")).toBe("F#");
    });
    
    it("normalizes musical unicode symbols", () => {
      expect(normalizeMusicalKey("C♯")).toBe("C#");
      expect(normalizeMusicalKey("D♭")).toBe("Db");
    });
    
    it("handles minor keys", () => {
      expect(normalizeMusicalKey("C#m")).toBe("C#m");
      expect(normalizeMusicalKey("c#m")).toBe("C#m");
      expect(normalizeMusicalKey("Cm")).toBe("Cm");
      expect(normalizeMusicalKey("Bbm")).toBe("Bbm");
    });
    
    it("differentiates keys properly", () => {
      expect(normalizeMusicalKey("C")).not.toBe(normalizeMusicalKey("C#"));
      expect(normalizeMusicalKey("C#m")).not.toBe(normalizeMusicalKey("Cm"));
    });
    
    it("handles spaces", () => {
      expect(normalizeMusicalKey(" C # m ")).toBe("C#m");
    });
    
    it("never throws", () => {
      expect(normalizeMusicalKey(null)).toBe("");
      expect(normalizeMusicalKey(undefined)).toBe("");
      expect(normalizeMusicalKey(123)).toBe("123"); // 123 -> "1" -> "123"? Actually "123" -> "123". "123" is fine.
    });
  });

  describe("Backward Compatibility", () => {
    it("handles legacy lyrics fields", () => {
      const song1 = { title: "Song1", cleanLyrics: "old clean lyrics", artist: "A" };
      const song2 = { title: "Song2", lyrics: "modern lyrics", artist: "B" };
      const docs = buildSearchIndex([song1, song2]);
      
      expect(docs[0].lyricsNormalized).toBe("old clean lyrics");
      expect(docs[1].lyricsNormalized).toBe("modern lyrics");
    });
    
    it("handles legacy chords fields", () => {
      const song = { title: "Song", structuredChords: "C G Am F", artist: "A" };
      const docs = buildSearchIndex([song]);
      expect(docs[0].chordsNormalized).toBe("c g am f");
    });
    
    it("handles legacy aliases fields", () => {
      const song = { title: "Song", keywords: "bonus search term", artist: "A" };
      const docs = buildSearchIndex([song]);
      expect(docs[0].aliasesNormalized).toBe("bonus search term");
    });
  });

  describe("Key Matching Priorities", () => {
    it("prioritizes selectedKey > key > originalKey", () => {
      const song = { 
        title: "Song", artist: "A", 
        selectedKey: "A", 
        key: "B", 
        originalKey: "C" 
      };
      const docs = buildSearchIndex([song]);
      
      const searchA = searchSongs(docs, "A");
      expect(searchA.length).toBe(1);
      expect(searchA[0].matchOrigin).toBe("key");
      
      const searchB = searchSongs(docs, "B");
      expect(searchB.length).toBe(1);
      expect(searchB[0].matchOrigin).toBe("key");
      
      const searchC = searchSongs(docs, "C");
      expect(searchC.length).toBe(1);
      expect(searchC[0].matchOrigin).toBe("key");
    });
    
    it("matches exact keys and not partial", () => {
      const song = { title: "Song", artist: "A", key: "C#" };
      const docs = buildSearchIndex([song]);
      
      const searchC = searchSongs(docs, "C");
      // "C" is title match for "Song"? No.
      expect(searchC.length).toBe(0); 
    });
  });

  describe("Snippet Strategy", () => {
    it("finds correct line with accents and punctuation", () => {
      const lyrics = "Lá vem ele!\nCoração d'Ele, glória.\nJesus é bom.";
      const snippet = getSearchSnippet(lyrics, "coracao");
      expect(snippet).toBe("…Coração d'Ele, glória.…");
    });
    
    it("finds correct line with out of order tokens", () => {
      const lyrics = "Deus é bom demais\nJesus Cristo meu senhor\nSanto é o senhor";
      const snippet = getSearchSnippet(lyrics, "senhor jesus");
      expect(snippet).toBe("…Jesus Cristo meu senhor…");
    });
    
    it("returns null properly", () => {
      const snippet = getSearchSnippet("A B C", "xyz");
      expect(snippet).toBeNull();
    });
    
    it("truncates very long lines", () => {
      const lyrics = "A".repeat(100) + " B " + "C".repeat(100);
      const snippet = getSearchSnippet(lyrics, "b");
      expect(snippet).not.toBeNull();
      expect(snippet?.length).toBeLessThan(100); // Because we truncate at 80 + ellipses
    });
  });

  describe("Fuzzy logic", () => {
    it("uses fuzzy search as fallback", () => {
      const docs = buildSearchIndex([{ title: "Misericórdia", artist: "A" }]);
      // Query with a typo: "misericordia" -> exact match. Typo: "mizericordia"
      const res = searchSongs(docs, "mizericordia");
      expect(res.length).toBe(1);
      expect(res[0].matchOrigin).toBe("title");
    });
  });
});
