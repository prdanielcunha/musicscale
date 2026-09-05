import { describe, expect, it } from "vitest";
import { parseChordsAndLyrics } from "../../components/songs/ChordsRenderer";
import { isSongSectionLabel, splitSongSectionLine } from "../../utils/songSections";

describe("song section recognition", () => {
  it("recognizes the missing Portuguese worship sections", () => {
    for (const label of [
      "Intro",
      "Introdução",
      "Início",
      "Parte Inicial",
      "Primeira Parte",
      "Segunda Parte",
      "Verso 2",
      "Pré-Refrão",
      "Refrão",
      "Ponte",
      "Instrumental",
      "Solo",
      "Ministração",
      "Final",
      "Fim",
      "Outro",
    ]) {
      expect(isSongSectionLabel(label), label).toBe(true);
    }
  });

  it("splits a bracketed section from chords on the same line", () => {
    expect(splitSongSectionLine("[Intro] C Am F7M Am F7M")).toEqual({
      label: "Intro",
      remainder: "C Am F7M Am F7M",
    });
  });

  it("splits an explicit inline section with colon", () => {
    expect(splitSongSectionLine("Final: D A Bm G")).toEqual({
      label: "Final",
      remainder: "D A Bm G",
    });
  });

  it("does not promote technical tab labels into shared live navigation", () => {
    expect(splitSongSectionLine("[Tab - Solo Intro]")).toBeNull();
  });

  it("parses the exact screenshot-shaped content into sections plus musical content", () => {
    const parsed = parseChordsAndLyrics(`[Intro] C Am F7M Am F7M

[Tab - Solo Intro]
(sem capotraste)

[Primeira Parte]
C
Foi por amor

[Pré-Refrão]
Am G

[Refrão]
F G Am

[Final]
C`);

    const sections = parsed
      .filter((line) => line.type === "section")
      .map((line) => line.content);

    expect(sections).toEqual([
      "[Intro]",
      "[Primeira Parte]",
      "[Pré-Refrão]",
      "[Refrão]",
      "[Final]",
    ]);

    expect(parsed).toContainEqual({
      type: "chord",
      content: "C Am F7M Am F7M",
    });
  });
});
