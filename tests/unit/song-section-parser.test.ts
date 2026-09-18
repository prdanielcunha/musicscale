import { describe, expect, it } from "vitest";
import {
  buildSongSectionNavigatorItems,
  isRecognizedSongSection,
  parseChordsAndLyrics,
  parseLyricsAndSections,
} from "../../components/songs/ChordsRenderer";

describe("worship song section parser", () => {
  it("splits an inline Intro heading while preserving the original chord column", () => {
    const parsed = parseChordsAndLyrics("[Intro] C Am F7M Am F7M\n[Primeira Parte]\nC\nFoi por amor");

    expect(parsed.slice(0, 4)).toEqual([
      { type: "section", content: "[Intro]" },
      { type: "chord", content: "        C Am F7M Am F7M" },
      { type: "section", content: "[Primeira Parte]" },
      { type: "chord", content: "C" },
    ]);
  });

  it("recognizes common Portuguese, English and Spanish-style worship structure labels", () => {
    [
      "Intro",
      "Introdução",
      "Introducción",
      "Início",
      "Abertura",
      "Parte Inicial",
      "Primeira Parte",
      "Primeira Estrofe",
      "1ª Parte",
      "1º Verso",
      "V1",
      "V2",
      "Primera Parte",
      "2ª Parte",
      "Parte 3",
      "Verso 1",
      "Pré-Refrão",
      "Pre-Refrão",
      "Pré-Coro",
      "Pre-Chorus",
      "Refrão",
      "Coro",
      "Chorus",
      "Ponte",
      "Puente",
      "Bridge",
      "Instrumental",
      "Interlúdio",
      "Solo",
      "Tab - Solo Intro",
      "Ministração",
      "Espontâneo",
      "Final",
      "Fim",
      "Outro",
      "Ending",
      "Coda",
    ].forEach((label) => {
      expect(isRecognizedSongSection(label), label).toBe(true);
    });
  });

  it("preserves legacy undelimited section + chord lines", () => {
    const parsed = parseChordsAndLyrics("Intro C G Am F\nPrimeira Parte C\nExiste um nome");

    expect(parsed.slice(0, 5)).toEqual([
      { type: "section", content: "[Intro]" },
      { type: "chord", content: "C G Am F" },
      { type: "section", content: "[Primeira Parte]" },
      { type: "chord", content: "C" },
      { type: "lyric", content: "Existe um nome" },
    ]);
  });

  it("accepts safe custom bracketed section names for personalized Performance navigation", () => {
    const parsed = parseChordsAndLyrics(
      "[Verso]\nC\nGraça sem fim\n[Lead Guitar]\nAm F C G\n[Keys Atmosphere] Dm G",
    );
    const items = buildSongSectionNavigatorItems(parsed);

    expect(items.map((item) => item.label)).toEqual([
      "Verso",
      "Lead Guitar",
      "Keys Atmosphere",
    ]);
    expect(
      parsed.some(
        (line) => line.type === "chord" && line.content.trim() === "Dm G",
      ),
    ).toBe(true);
  });

  it("does not mistake ChordPro chords, key metadata, or numeric markers for custom sections", () => {
    const parsed = parseChordsAndLyrics(
      "[C]Graça que me alcançou\n[Am]Hoje eu vivo\n[Key G]\n[Capo 2]\n[2]\nC G Am F",
    );
    const sectionLabels = buildSongSectionNavigatorItems(parsed).map(
      (item) => item.label,
    );

    expect(sectionLabels).toEqual([]);
    expect(
      parsed.some(
        (line) => line.type === "section" && line.content.includes("Key"),
      ),
    ).toBe(false);
    expect(
      parsed.some(
        (line) => line.type === "section" && line.content.includes("Capo"),
      ),
    ).toBe(false);
  });

  it("keeps technical solo headings navigable but does not turn arbitrary bracket metadata into a section", () => {
    const parsed = parseChordsAndLyrics(
      "[Tab - Solo Intro]\n(sem capotraste)\n[Capotraste 2]\nC G Am F",
    );

    expect(parsed[0]).toEqual({ type: "section", content: "[Tab - Solo Intro]" });
    expect(parsed.some((line) => line.type === "section" && line.content.includes("Capotraste"))).toBe(false);
  });

  it("numbers repeated sections so a conductor can choose the exact occurrence", () => {
    const parsed = parseChordsAndLyrics(
      "[Intro]\nC\n[Refrão]\nF\n[Refrão]\nG\n[Ponte]\nAm\n[Final]\nC",
    );
    const items = buildSongSectionNavigatorItems(parsed);

    expect(items.map((item) => item.displayLabel)).toEqual([
      "Intro",
      "Refrão 1",
      "Refrão 2",
      "Ponte",
      "Final",
    ]);
    expect(items[1].index).not.toBe(items[2].index);
  });

  it("uses the same section recognition in lyrics", () => {
    const parsed = parseLyricsAndSections(
      "[Introdução]\nOh oh\n[Primeira Parte]\nExiste um nome\n[Pré-Refrão]\nE esse nome\n[Final]\nAmém",
    );
    const labels = buildSongSectionNavigatorItems(parsed).map((item) => item.label);

    expect(labels).toEqual(["Introdução", "Primeira Parte", "Pré-Refrão", "Final"]);
  });
});
