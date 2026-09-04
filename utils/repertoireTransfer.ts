import type { Song } from "../types";

export interface RepertoireTransferRow {
  title: string;
  artist: string;
  key: string;
  bpm: number | null;
  lyrics: string;
  chords: string;
  chordsUrl: string;
  videoUrl: string;
  language: string;
  version: string;
  rhythm: string;
  tabs: { section: string; content: string }[];
}

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const HEADER_ALIASES: Record<keyof Omit<RepertoireTransferRow, "tabs"> | "tabs", string[]> = {
  title: ["titulo", "title", "musica", "music", "cancion", "song", "nome", "nomedamusica"],
  artist: ["artista", "artist", "cantor", "banda", "autor", "ministerio", "interprete"],
  key: ["tom", "key", "tono", "ton"],
  bpm: ["bpm", "tempo"],
  lyrics: ["letra", "lyrics", "letras"],
  chords: ["cifra", "chords", "acordes", "chordchart"],
  chordsUrl: ["linkdacifra", "urlcifra", "chordsurl", "cifraurl", "linkcifra"],
  videoUrl: ["video", "videourl", "youtube", "linkvideo", "referencia", "reference"],
  language: ["idioma", "language", "lenguaje"],
  version: ["versao", "version", "arranjo", "arrangement"],
  rhythm: ["ritmo", "rhythm", "estilo"],
  tabs: ["partestecnicas", "tabs", "tablatura", "tablaturas", "solos", "riffs"],
};

function resolveHeader(header: string): keyof RepertoireTransferRow | null {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) return field as keyof RepertoireTransferRow;
  }
  return null;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === "," || char === ";")) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
  }

  return rows;
}

const parseTabs = (value: string): { section: string; content: string }[] => {
  if (!value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        section: String(item?.section || "Parte"),
        content: String(item?.content || ""),
      }))
      .filter((item) => item.content.trim());
  } catch {
    return [{ section: "Parte técnica", content: value.trim() }];
  }
};

export function parseRepertoireCsv(text: string): {
  rows: RepertoireTransferRow[];
  unknownHeaders: string[];
} {
  const matrix = parseCsv(text);
  if (matrix.length < 2) return { rows: [], unknownHeaders: [] };

  const headers = matrix[0];
  const resolved = headers.map(resolveHeader);
  const unknownHeaders = headers.filter((header, index) => !resolved[index] && header.trim());

  const rows = matrix.slice(1).map((cells) => {
    const data: Partial<Record<keyof RepertoireTransferRow, string>> = {};
    resolved.forEach((field, index) => {
      if (field) data[field] = cells[index] || "";
    });

    const bpmRaw = String(data.bpm || "").replace(",", ".").trim();
    const bpmNumber = bpmRaw ? Number(bpmRaw) : null;

    return {
      title: String(data.title || "").trim(),
      artist: String(data.artist || "").trim(),
      key: String(data.key || "").trim(),
      bpm: bpmNumber && Number.isFinite(bpmNumber) ? Math.round(bpmNumber) : null,
      lyrics: String(data.lyrics || "").replace(/\\n/g, "\n").trim(),
      chords: String(data.chords || "").replace(/\\n/g, "\n").trim(),
      chordsUrl: String(data.chordsUrl || "").trim(),
      videoUrl: String(data.videoUrl || "").trim(),
      language: String(data.language || "unknown").trim() || "unknown",
      version: String(data.version || "Original").trim() || "Original",
      rhythm: String(data.rhythm || "").trim(),
      tabs: parseTabs(String(data.tabs || "")),
    };
  }).filter((row) => row.title);

  return { rows, unknownHeaders };
}

const quoteCsv = (value: unknown) => {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
};

export function serializeRepertoireCsv(songs: Song[]): string {
  const headers = [
    "Título",
    "Artista",
    "Tom",
    "BPM",
    "Letra",
    "Cifra",
    "Link da Cifra",
    "Vídeo",
    "Idioma",
    "Versão",
    "Ritmo",
    "Partes Técnicas",
  ];

  const rows = songs.map((song) => [
    song.title,
    song.artist,
    song.key,
    song.bpm ?? "",
    song.lyrics || "",
    song.chords || "",
    song.chordsUrl || "",
    song.videoUrl || "",
    song.language || "unknown",
    song.version || "",
    song.rhythm || "",
    JSON.stringify(song.tabs || []),
  ]);

  return "\uFEFF" + [headers, ...rows].map((row) => row.map(quoteCsv).join(";")).join("\r\n");
}

export function normalizeSongIdentity(title: string, artist: string) {
  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  return `${normalize(title)}|${normalize(artist)}`;
}
