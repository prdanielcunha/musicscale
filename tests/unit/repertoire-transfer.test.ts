import { describe, expect, it } from "vitest";
import {
  normalizeSongIdentity,
  parseRepertoireCsv,
  serializeRepertoireCsv,
} from "../../utils/repertoireTransfer";

describe("repertoire transfer", () => {
  it("parses Portuguese and common migration headers without losing multiline musical content", () => {
    const csv = [
      '"Título";"Artista";"Tom";"BPM";"Letra";"Cifra";"Partes Técnicas"',
      '"Santo";"Banda";"D";"72";"Linha 1\nLinha 2";"[Intro]\nD G";"[{""section"":""Solo"",""content"":""e|--5--""}]"',
    ].join("\r\n");

    const result = parseRepertoireCsv(csv);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      title: "Santo",
      artist: "Banda",
      key: "D",
      bpm: 72,
      lyrics: "Linha 1\nLinha 2",
      chords: "[Intro]\nD G",
    });
    expect(result.rows[0].tabs[0]).toEqual({
      section: "Solo",
      content: "e|--5--",
    });
  });

  it("normalizes identity for safe duplicate detection", () => {
    expect(normalizeSongIdentity("  Graça ", "João")).toBe(
      normalizeSongIdentity("graca", "joao"),
    );
    expect(normalizeSongIdentity("Canção", undefined)).toBe(
      normalizeSongIdentity("cancao", ""),
    );
  });

  it("exports the extended repertoire fields including technical parts", () => {
    const csv = serializeRepertoireCsv([
      {
        id: "song-1",
        organizationId: "org-1",
        title: "Song",
        artist: "Artist",
        key: "G",
        bpm: 68,
        status: "active",
        tagIds: [],
        lyrics: "Lyrics",
        chords: "G C",
        chordsUrl: "",
        videoUrl: "",
        tabs: [{ section: "Solo", content: "e|--3--" }],
        metadata: {
          importExtraColumns: {
            "Link Áudio": "https://audio.example",
          },
        },
      } as any,
    ]);

    expect(csv).toContain('"Partes Técnicas"');
    expect(csv).toContain('"Link Áudio"');
    expect(csv).toContain('"https://audio.example"');
    expect(csv).toContain('e|--3--');
    expect(csv).toContain('"68"');
  });
});
