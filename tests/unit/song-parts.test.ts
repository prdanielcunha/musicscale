import { describe, expect, it } from "vitest";
import { buildSongParts, hasSongParts } from "../../components/songs/songParts";

describe("intelligent song parts", () => {
  it("derives solo and riff focus from the canonical chart without duplicating the song", () => {
    const song = {
      chords: [
        "[Intro]",
        "G D Em C",
        "[Primeira Parte]",
        "G",
        "Deus é fiel",
        "[Solo Guitarra]",
        "G D Em C",
        "[Ponte]",
        "Em C G D",
        "[Riff Baixo]",
        "Em D C",
        "[Final]",
        "G",
      ].join("\n"),
      tabs: [],
      metadata: {},
    };

    const parts = buildSongParts(song);

    expect(parts.map((part) => part.label)).toEqual([
      "Solo Guitarra",
      "Riff Baixo",
    ]);
    expect(parts[0]).toMatchObject({
      kind: "solo",
      instrument: "guitar",
      format: "chords",
      source: "chart",
      contextBefore: "Primeira Parte",
      contextAfter: "Ponte",
    });
    expect(parts[0].content).toBe("G D Em C");
    expect(parts[1]).toMatchObject({
      kind: "riff",
      instrument: "bass",
      contextBefore: "Ponte",
      contextAfter: "Final",
    });
    expect(hasSongParts(song)).toBe(true);
  });

  it("lets AI enrich an existing section but ignores invented section annotations", () => {
    const song = {
      chords: [
        "[Verso]",
        "C",
        "Tu és fiel",
        "[Ponte]",
        "Am F C G",
        "[Refrão]",
        "F G C",
      ].join("\n"),
      tabs: [],
      metadata: {
        sectionAnnotations: [
          {
            section: "Ponte",
            type: "instrumental",
            instrument: "keys",
            confidence: "high",
          },
          {
            section: "Solo Inventado",
            type: "solo",
            instrument: "guitar",
            confidence: "high",
          },
        ],
      },
    };

    const parts = buildSongParts(song);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      label: "Ponte",
      kind: "instrumental",
      instrument: "keys",
      confidence: "high",
    });
    expect(parts.some((part) => part.label === "Solo Inventado")).toBe(false);
  });

  it("merges matching tablature into the chart part while preserving original fingering", () => {
    const song = {
      chords: ["[Solo Guitarra]", "Am F C G", "[Ponte]", "F G Am"].join("\n"),
      tabs: [
        {
          section: "Solo Guitarra",
          content: "e|--5--7--8--|\nB|------------|",
        },
      ],
      metadata: {},
    };

    const parts = buildSongParts(song);

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      label: "Solo Guitarra",
      format: "mixed",
      source: "mixed",
      preservesFingering: true,
    });
    expect(parts[0].content).toContain("Am F C G");
    expect(parts[0].content).toContain("e|--5--7--8--|");
  });

  it("keeps legacy tab-only content available as a technical part", () => {
    const parts = buildSongParts({
      chords: "[Verso]\nC\nGraça sem fim",
      tabs: [
        {
          section: "Tab - Solo Intro",
          content: "e|--0--2--3--|",
        },
      ],
      metadata: {},
    });

    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      kind: "solo",
      format: "tab",
      source: "tab",
      preservesFingering: true,
    });
  });
});
