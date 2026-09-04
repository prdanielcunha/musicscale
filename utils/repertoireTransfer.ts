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
  extra: Record<string, string>;
}

type RepertoireKnownField = Exclude<keyof RepertoireTransferRow, "extra">;

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

const HEADER_ALIASES: Record<RepertoireKnownField, string[]> = {
  title: ["titulo", "title", "musica", "music", "cancion", "song", "nome", "nomedamusica"],
  artist: ["artista", "artist", "cantor", "banda", "autor", "ministerio", "interprete"],
  key: ["tom", "key", "tono", "ton", "tomoriginal", "originalkey"],
  bpm: ["bpm", "tempo"],
  lyrics: ["letra", "lyrics", "letras"],
  chords: ["cifra", "chords", "acordes", "chordchart"],
  chordsUrl: ["linkdacifra", "urlcifra", "chordsurl", "cifraurl", "linkcifra", "cifralink"],
  videoUrl: ["video", "videourl", "youtube", "linkvideo", "referencia", "reference", "linkdovideo", "linkyoutube"],
  language: ["idioma", "language", "lenguaje"],
  version: ["versao", "version", "arranjo", "arrangement"],
  rhythm: ["ritmo", "rhythm", "estilo"],
  tabs: ["partestecnicas", "tabs", "tablatura", "tablaturas", "solos", "riffs"],
};

function resolveHeader(header: string): RepertoireKnownField | null {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) return field as RepertoireKnownField;
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

const cellToString = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

export function parseRepertoireMatrix(matrix: unknown[][]): {
  rows: RepertoireTransferRow[];
  unknownHeaders: string[];
} {
  if (matrix.length < 2) return { rows: [], unknownHeaders: [] };

  const headers = matrix[0].map((cell) => cellToString(cell).trim());
  const resolved = headers.map(resolveHeader);
  const unknownIndexes = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header, index }) => !!header && !resolved[index]);
  const unknownHeaders = unknownIndexes.map(({ header }) => header);

  const rows = matrix
    .slice(1)
    .map((cells) => {
      const data: Partial<Record<RepertoireKnownField, string>> = {};
      resolved.forEach((field, index) => {
        if (field) data[field] = cellToString(cells[index] ?? "");
      });

      const extra: Record<string, string> = {};
      for (const { header, index } of unknownIndexes) {
        const value = cellToString(cells[index] ?? "").trim();
        if (value) extra[header] = value;
      }

      const bpmRaw = String(data.bpm || "").replace(",", ".").trim();
      const bpmNumber = bpmRaw ? Number(bpmRaw) : null;

      return {
        title: String(data.title || "").trim(),
        artist: String(data.artist || "").trim(),
        key: String(data.key || "").trim(),
        bpm:
          bpmNumber && Number.isFinite(bpmNumber)
            ? Math.round(bpmNumber)
            : null,
        lyrics: String(data.lyrics || "").replace(/\\n/g, "\n").trim(),
        chords: String(data.chords || "").replace(/\\n/g, "\n").trim(),
        chordsUrl: String(data.chordsUrl || "").trim(),
        videoUrl: String(data.videoUrl || "").trim(),
        language: String(data.language || "unknown").trim() || "unknown",
        version: String(data.version || "Original").trim() || "Original",
        rhythm: String(data.rhythm || "").trim(),
        tabs: parseTabs(String(data.tabs || "")),
        extra,
      };
    })
    .filter((row) => row.title);

  return { rows, unknownHeaders };
}

export function parseRepertoireCsv(text: string): {
  rows: RepertoireTransferRow[];
  unknownHeaders: string[];
} {
  return parseRepertoireMatrix(parseCsv(text));
}

const quoteCsv = (value: unknown) => {
  const stringValue = String(value ?? "");
  return `"${stringValue.replace(/"/g, '""')}"`;
};

export function serializeRepertoireCsv(songs: Song[]): string {
  const baseHeaders = [
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

  const extraHeaders = Array.from(
    new Set(
      songs.flatMap((song) => {
        const extra = song.metadata?.importExtraColumns;
        if (!extra || typeof extra !== "object" || Array.isArray(extra)) {
          return [];
        }
        return Object.keys(extra);
      }),
    ),
  )
    .filter((header) => !!header.trim() && !baseHeaders.includes(header))
    .sort((a, b) => a.localeCompare(b));

  const headers = [...baseHeaders, ...extraHeaders];
  const rows = songs.map((song) => {
    const extra =
      song.metadata?.importExtraColumns &&
      typeof song.metadata.importExtraColumns === "object" &&
      !Array.isArray(song.metadata.importExtraColumns)
        ? song.metadata.importExtraColumns
        : {};

    return [
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
      ...extraHeaders.map((header) => extra[header] ?? ""),
    ];
  });

  return (
    "\uFEFF" +
    [headers, ...rows]
      .map((row) => row.map(quoteCsv).join(";"))
      .join("\r\n")
  );
}

export function normalizeSongIdentity(title?: string | null, artist?: string | null) {
  const normalize = (value?: string | null) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  return `${normalize(title)}|${normalize(artist)}`;
}
