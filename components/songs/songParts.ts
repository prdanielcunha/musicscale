import {
  classifyLine,
  LineType,
} from "../../utils/chordEngine";
import { splitSongSectionPrefix } from "./ChordsRenderer";

export type SongPartKind =
  | "solo"
  | "riff"
  | "instrumental"
  | "interlude"
  | "intro"
  | "outro"
  | "technical";

export type SongPartFormat = "chords" | "tab" | "mixed" | "text";

export type SongPartInstrument =
  | "guitar"
  | "acoustic_guitar"
  | "bass"
  | "keys"
  | "piano"
  | "synth"
  | "drums"
  | "sax"
  | "violin"
  | "strings"
  | "other"
  | "unknown";

export interface SongPartAnnotation {
  section: string;
  type?: SongPartKind | "vocal" | "unknown";
  instrument?: SongPartInstrument;
  confidence?: "high" | "medium" | "low";
}

export interface SongPart {
  id: string;
  label: string;
  displayLabel: string;
  kind: SongPartKind;
  instrument: SongPartInstrument;
  format: SongPartFormat;
  content: string;
  source: "chart" | "tab" | "mixed";
  preservesFingering: boolean;
  occurrence: number;
  totalOccurrences: number;
  sectionIndex: number | null;
  contextBefore: string | null;
  contextAfter: string | null;
  confidence: "high" | "medium" | "low" | null;
}

export interface SongPartsSource {
  chords?: string | null;
  tabs?: Array<{ section?: string | null; content?: string | null }> | null;
  metadata?: {
    sectionAnnotations?: unknown;
    [key: string]: unknown;
  } | null;
}

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\[\]]/g, "")
    .replace(/[_–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const TECHNICAL_TYPES = new Set<SongPartKind>([
  "solo",
  "riff",
  "instrumental",
  "interlude",
  "intro",
  "outro",
  "technical",
]);

const KNOWN_INSTRUMENTS = new Set<SongPartInstrument>([
  "guitar",
  "acoustic_guitar",
  "bass",
  "keys",
  "piano",
  "synth",
  "drums",
  "sax",
  "violin",
  "strings",
  "other",
  "unknown",
]);

const inferKindFromLabel = (label: string): SongPartKind | null => {
  const value = fold(label);

  if (/\bsolo\b/.test(value)) return "solo";
  if (/\briff\b/.test(value)) return "riff";
  if (/\b(interludio|interlude)\b/.test(value)) return "interlude";
  if (/\b(intro|introducao|introduccion|introduction)\b.*\binstrumental\b|\binstrumental\b.*\b(intro|introducao|introduccion|introduction)\b/.test(value)) {
    return "intro";
  }
  if (/\b(final|fim|outro|ending|coda)\b.*\binstrumental\b|\binstrumental\b.*\b(final|fim|outro|ending|coda)\b/.test(value)) {
    return "outro";
  }
  if (/\binstrumental\b/.test(value)) return "instrumental";
  if (/\b(tab|tablatura|tablature|dedilhado|punteo|rasgueo)\b/.test(value)) return "technical";
  if (/^base(?:\s+\d+)?$/.test(value)) return "technical";

  return null;
};

const inferInstrumentFromLabel = (label: string): SongPartInstrument => {
  const value = fold(label);

  if (/\b(violao|acoustic guitar|acoustic)\b/.test(value)) return "acoustic_guitar";
  if (/\b(guitarra|guitar|guit)\b/.test(value)) return "guitar";
  if (/\b(baixo|bass)\b/.test(value)) return "bass";
  if (/\b(teclado|keyboard|keys)\b/.test(value)) return "keys";
  if (/\bpiano\b/.test(value)) return "piano";
  if (/\b(synth|sintetizador|sintetizador)\b/.test(value)) return "synth";
  if (/\b(bateria|drums|drum)\b/.test(value)) return "drums";
  if (/\b(sax|saxofone|saxophone)\b/.test(value)) return "sax";
  if (/\b(violino|violin)\b/.test(value)) return "violin";
  if (/\b(strings|cordas)\b/.test(value)) return "strings";

  return "unknown";
};

const detectFormat = (content: string): SongPartFormat => {
  const lines = content.replace(/\r/g, "").split("\n");
  const classified = lines.map((line, index) => classifyLine(line, index, lines));

  const hasTab = classified.some((line) => line.type === LineType.TAB_LINE);
  const hasChord = classified.some(
    (line) =>
      line.type === LineType.CHORD_LINE ||
      line.type === LineType.CHORD_AND_LYRIC_LINE,
  );
  const hasText = classified.some(
    (line) =>
      line.type === LineType.LYRIC_LINE &&
      line.originalText.trim().length > 0,
  );

  if (hasTab && (hasChord || hasText)) return "mixed";
  if (hasTab) return "tab";
  if (hasChord && hasText) return "mixed";
  if (hasChord) return "chords";
  return "text";
};

const sanitizeAnnotations = (metadata: SongPartsSource["metadata"]): SongPartAnnotation[] => {
  const value = metadata?.sectionAnnotations;
  if (!Array.isArray(value)) return [];

  return value
    .map((item): SongPartAnnotation | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      if (typeof record.section !== "string" || !record.section.trim()) return null;

      const type =
        typeof record.type === "string" &&
        (TECHNICAL_TYPES.has(record.type as SongPartKind) ||
          record.type === "vocal" ||
          record.type === "unknown")
          ? (record.type as SongPartAnnotation["type"])
          : undefined;

      const instrument =
        typeof record.instrument === "string" &&
        KNOWN_INSTRUMENTS.has(record.instrument as SongPartInstrument)
          ? (record.instrument as SongPartInstrument)
          : undefined;

      const confidence =
        record.confidence === "high" ||
        record.confidence === "medium" ||
        record.confidence === "low"
          ? record.confidence
          : undefined;

      return {
        section: record.section.trim(),
        type,
        instrument,
        confidence,
      };
    })
    .filter((item): item is SongPartAnnotation => Boolean(item));
};

interface SectionBlock {
  label: string;
  content: string;
  sectionIndex: number;
  previousLabel: string | null;
  nextLabel: string | null;
}

const buildSectionBlocks = (chords: string): SectionBlock[] => {
  if (!chords.trim()) return [];

  const rawLines = chords.replace(/\r/g, "").split("\n");
  const pending: Array<{
    label: string;
    contentLines: string[];
    sectionIndex: number;
  }> = [];
  let current: (typeof pending)[number] | null = null;
  let sectionIndex = 0;

  const flush = () => {
    if (!current) return;
    while (current.contentLines.length > 0 && !current.contentLines[0].trim()) {
      current.contentLines.shift();
    }
    while (
      current.contentLines.length > 0 &&
      !current.contentLines[current.contentLines.length - 1].trim()
    ) {
      current.contentLines.pop();
    }
    pending.push(current);
    current = null;
  };

  rawLines.forEach((line) => {
    const section = splitSongSectionPrefix(line);
    if (section) {
      flush();
      current = {
        label: section.label,
        contentLines: section.remainder ? [section.remainder] : [],
        sectionIndex,
      };
      sectionIndex += 1;
      return;
    }

    if (current) current.contentLines.push(line);
  });

  flush();

  return pending.map((block, index) => ({
    label: block.label,
    content: block.contentLines.join("\n"),
    sectionIndex: block.sectionIndex,
    previousLabel: index > 0 ? pending[index - 1].label : null,
    nextLabel: index < pending.length - 1 ? pending[index + 1].label : null,
  }));
};

const shouldTreatAnnotationAsPart = (
  kind: SongPartKind,
  label: string,
  format: SongPartFormat,
): boolean => {
  if (kind === "intro" || kind === "outro") {
    const labelKind = inferKindFromLabel(label);
    return labelKind === kind || format === "chords" || format === "tab" || format === "mixed";
  }
  return true;
};

export const buildSongParts = (song: SongPartsSource | null | undefined): SongPart[] => {
  if (!song) return [];

  const annotations = sanitizeAnnotations(song.metadata);
  const annotationByLabel = new Map<string, SongPartAnnotation>();
  annotations.forEach((annotation) => {
    annotationByLabel.set(fold(annotation.section), annotation);
  });

  const blocks = buildSectionBlocks(song.chords || "");
  const candidates = blocks
    .map((block) => {
      const annotation = annotationByLabel.get(fold(block.label));
      const inferredKind = inferKindFromLabel(block.label);
      const annotatedKind =
        annotation?.type && TECHNICAL_TYPES.has(annotation.type as SongPartKind)
          ? (annotation.type as SongPartKind)
          : null;
      const kind = inferredKind || annotatedKind;
      if (!kind) return null;

      const format = detectFormat(block.content);
      if (!shouldTreatAnnotationAsPart(kind, block.label, format)) return null;

      return {
        ...block,
        kind,
        format,
        instrument:
          annotation?.instrument && annotation.instrument !== "unknown"
            ? annotation.instrument
            : inferInstrumentFromLabel(block.label),
        confidence: annotation?.confidence || null,
      };
    })
    .filter(
      (
        item,
      ): item is SectionBlock & {
        kind: SongPartKind;
        format: SongPartFormat;
        instrument: SongPartInstrument;
        confidence: "high" | "medium" | "low" | null;
      } => Boolean(item),
    );

  const totals = new Map<string, number>();
  candidates.forEach((part) => {
    const key = fold(part.label);
    totals.set(key, (totals.get(key) || 0) + 1);
  });

  const seen = new Map<string, number>();
  const parts: SongPart[] = candidates.map((part) => {
    const key = fold(part.label);
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    const totalOccurrences = totals.get(key) || 1;

    return {
      id: `chart:${part.sectionIndex}:${key}`,
      label: part.label,
      displayLabel:
        totalOccurrences > 1 ? `${part.label} ${occurrence}` : part.label,
      kind: part.kind,
      instrument: part.instrument,
      format: part.format,
      content: part.content,
      source: "chart",
      preservesFingering: part.format === "tab" || part.format === "mixed",
      occurrence,
      totalOccurrences,
      sectionIndex: part.sectionIndex,
      contextBefore: part.previousLabel,
      contextAfter: part.nextLabel,
      confidence: part.confidence,
    };
  });

  (song.tabs || []).forEach((legacyTab, index) => {
    const content = legacyTab?.content?.trimEnd() || "";
    if (!content.trim()) return;

    const label = legacyTab.section?.trim() || "Parte";
    const key = fold(label);
    const existing = parts.find((part) => fold(part.label) === key);

    if (existing) {
      if (!existing.content.includes(content)) {
        existing.content = existing.content.trim()
          ? `${existing.content.trimEnd()}\n\n${content}`
          : content;
      }
      existing.format = existing.format === "tab" ? "tab" : "mixed";
      existing.source = "mixed";
      existing.preservesFingering = true;
      if (existing.instrument === "unknown") {
        existing.instrument = inferInstrumentFromLabel(label);
      }
      return;
    }

    const annotation = annotationByLabel.get(key);
    const annotatedKind =
      annotation?.type && TECHNICAL_TYPES.has(annotation.type as SongPartKind)
        ? (annotation.type as SongPartKind)
        : null;

    parts.push({
      id: `tab:${index}:${key}`,
      label,
      displayLabel: label,
      kind: inferKindFromLabel(label) || annotatedKind || "technical",
      instrument:
        annotation?.instrument && annotation.instrument !== "unknown"
          ? annotation.instrument
          : inferInstrumentFromLabel(label),
      format: "tab",
      content,
      source: "tab",
      preservesFingering: true,
      occurrence: 1,
      totalOccurrences: 1,
      sectionIndex: null,
      contextBefore: null,
      contextAfter: null,
      confidence: annotation?.confidence || null,
    });
  });

  return parts;
};

export const hasSongParts = (song: SongPartsSource | null | undefined): boolean =>
  buildSongParts(song).length > 0;
