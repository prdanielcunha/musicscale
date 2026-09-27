import fs from "node:fs";
import { describe, expect, it } from "vitest";

const chordsPage = fs.readFileSync("pages/ChordsPage.tsx", "utf8");
const lyricsPage = fs.readFileSync("pages/LyricsPage.tsx", "utf8");
const musicBuilder = fs.readFileSync("components/scales/MusicBuilder.tsx", "utf8");
const modernScaleForm = fs.readFileSync("components/scales/ModernScaleForm.tsx", "utf8");

describe("intelligent search surface contract", () => {
  it("uses the shared search engine in Chords", () => {
    expect(chordsPage).toContain('buildSearchIndex');
    expect(chordsPage).toContain('searchSongs(songSearchIndex, deferredSearchTerm)');
  });

  it("keeps Chords typing responsive with a deferred filter value", () => {
    expect(chordsPage).toContain('useDeferredValue(searchTerm)');
  });

  it("uses the shared search engine in Lyrics", () => {
    expect(lyricsPage).toContain('buildSearchIndex');
    expect(lyricsPage).toContain('searchSongs(songSearchIndex, deferredSearchTerm)');
  });

  it("keeps Lyrics typing responsive with a deferred filter value", () => {
    expect(lyricsPage).toContain('useDeferredValue(searchTerm)');
  });

  it("uses the shared search engine in MusicBuilder", () => {
    expect(musicBuilder).toContain('buildSearchIndex');
    expect(musicBuilder).toContain('searchSongs(songSearchIndex, deferredSongSearch)');
  });

  it("keeps the scale repertoire typing responsive", () => {
    expect(musicBuilder).toContain('useDeferredValue(songSearch)');
  });

  it("builds each local index only when the songs collection changes", () => {
    expect(chordsPage).toContain('useMemo(() => buildSearchIndex(songs), [songs])');
    expect(lyricsPage).toContain('useMemo(() => buildSearchIndex(songs), [songs])');
    expect(musicBuilder).toContain('useMemo(() => buildSearchIndex(songs), [songs])');
  });

  it("preserves Chords filters after intelligent search", () => {
    expect(chordsPage).toContain('keyFilter === "all" || song.key === keyFilter');
    expect(chordsPage).toContain('tagFilterIds.some');
  });

  it("preserves Lyrics filters after intelligent search", () => {
    expect(lyricsPage).toContain('keyFilter === "all" || song.key === keyFilter');
    expect(lyricsPage).toContain('tagFilterIds.some');
  });

  it("covers both creation and editing because ModernScaleForm owns MusicBuilder", () => {
    expect(modernScaleForm).toContain('<MusicBuilder');
    expect(modernScaleForm).toContain('scaleToEdit');
    expect(musicBuilder).toContain('formData.songIds');
  });
});
