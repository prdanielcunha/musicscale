import React from 'react';
import { motion } from 'motion/react';

export const getNotesArray = () => [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

export const parseKey = (key: string): string => {
  const noteMap: { [key: string]: string } = {
    Cb: "B", C: "C", "C#": "C#", Db: "C#", D: "D", "D#": "D#", Eb: "D#",
    E: "E", Fb: "E", F: "F", "F#": "F#", Gb: "F#", G: "G", "G#": "G#",
    Ab: "G#", A: "A", "A#": "A#", Bb: "A#", B: "B", "B#": "C",
  };
  const cleanKey = key
    .replace(/m$/, "")
    .replace(/sus.*/, "")
    .replace(/add.*/, "");
  return noteMap[cleanKey] || cleanKey;
};

export const getKeyDifference = (originalKey: string, targetKey: string): number => {
  const notes = getNotesArray();
  const origIndex = notes.indexOf(parseKey(originalKey));
  const targetIndex = notes.indexOf(parseKey(targetKey));
  if (origIndex === -1 || targetIndex === -1) return 0;

  let diff = targetIndex - origIndex;
  if (diff > 6) diff -= 12;
  if (diff < -5) diff += 12;
  return diff;
};

export const transposeChord = (line: string, amount: number): string => {
  if (!amount || amount === 0) return line;

  const noteMap: { [key: string]: string } = {
    Cb: "B", C: "C", "C#": "C#", Db: "C#", D: "D", "D#": "D#", Eb: "D#",
    E: "E", Fb: "E", "E#": "F", F: "F", "F#": "F#", Gb: "F#", G: "G",
    "G#": "G#", Ab: "G#", A: "A", "A#": "A#", Bb: "A#", B: "B",
  };
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  const chordRegex =
    /(?<![a-zA-ZÁÉÍÓÚÃÕÇáéíóúãõç])([A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M|º|°|\d|7M|M7)*(?:\([^)]*\))?(?:\/[A-G][#b]?)?)(?![a-zA-ZÁÉÍÓÚÃÕÇáéíóúãõç])/g;

  return line.replace(chordRegex, (chord) => {
    return chord.replace(/[A-G][#b]?/g, (note: string) => {
      const normalizedNote = noteMap[note] || note;
      let index = notes.indexOf(normalizedNote);
      if (index === -1) return note;
      const newIndex = (((index + amount) % 12) + 12) % 12;
      return notes[newIndex];
    });
  });
};

export const foldSectionLabel = (value: string): string =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const cleanSectionLabel = (value: string): string =>
  String(value || "")
    .trim()
    .replace(/^\[|\]$/g, "")
    .replace(/\s*[:.]\s*$/g, "")
    .trim();

export const isRecognizedSongSection = (value: string): boolean => {
  const folded = foldSectionLabel(cleanSectionLabel(value))
    .replace(/^tab(?:latura)?\s*[-:]\s*/, "")
    .replace(/\s*\((?:\d+\s*x|x\s*\d+)\)\s*$/, "")
    .replace(/\s+(?:x\s*)?\d+\s*x\s*$/, "")
    .trim();

  if (!folded) return false;

  const patterns = [
    /^(?:intro|introducao|introduccion|introduction)(?:\s+\d+)?$/,
    /^(?:inicio|abertura|opening|start|comienzo|apertura)$/,
    /^(?:parte|part)\s+(?:inicial|initial)$/,
    /^(?:primeira|segunda|terceira|quarta|quinta|primera|segunda|tercera|cuarta|quinta)\s+(?:parte|estrofe|estrofa)$/,
    /^(?:1|1a|1ª|1o|1º|2|2a|2ª|2o|2º|3|3a|3ª|3o|3º|4|4a|4ª|4o|4º|5|5a|5ª|5o|5º)\s+(?:parte|verso|verse|estrofe|estrofa)$/,
    /^parte\s+(?:\d+|[a-e])$/,
    /^part\s+(?:\d+|[a-e])$/,
    /^(?:v|v\.|verso|verse)\s*\d+$/,
    /^(?:(?:primeiro|segundo|terceiro|cuarto|quinto|primer|segundo|tercer|cuarto|quinto)\s+)?(?:verso|verse|estrofe|estrofa)(?:\s+\d+)?$/,
    /^(?:pre[- ]?refrao|pre[- ]?coro|pre[- ]?chorus|prechorus)(?:\s+\d+)?$/,
    /^(?:pos[- ]?refrao|post[- ]?chorus|postchorus)(?:\s+\d+)?$/,
    /^(?:refrao|coro|chorus)(?:\s+\d+)?$/,
    /^(?:ponte|puente|bridge)(?:\s+\d+)?$/,
    /^(?:instrumental|interludio|interlude|turnaround)(?:\s+\d+)?$/,
    /^(?:solo|riff)(?:\s+(?:intro|introducao|introduccion|guitarra|violao|baixo|teclado|instrumental))?(?:\s+\d+)?$/,
    /^(?:ministracao|ministracion|espontaneo|spontaneous|vamp|tag|break)(?:\s+\d+)?$/,
    /^(?:final|fim|encerramento|cierre|outro|ending|coda)(?:\s+\d+)?$/,
  ];

  return patterns.some((pattern) => pattern.test(folded));
};

interface SectionPrefixMatch {
  label: string;
  remainder: string;
}

export const splitSongSectionPrefix = (line: string): SectionPrefixMatch | null => {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;

  const bracketed = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (bracketed && isRecognizedSongSection(bracketed[1])) {
    return {
      label: cleanSectionLabel(bracketed[1]),
      remainder: bracketed[2].trim(),
    };
  }

  const wholeLabel = trimmed.replace(/\s*[:.]\s*$/, "");
  if (isRecognizedSongSection(wholeLabel)) {
    return {
      label: cleanSectionLabel(wholeLabel),
      remainder: "",
    };
  }

  const colonSeparated = trimmed.match(/^(.{1,48}?)\s*[:]\s*(.+)$/);
  if (
    colonSeparated &&
    isRecognizedSongSection(colonSeparated[1]) &&
    colonSeparated[2].trim()
  ) {
    return {
      label: cleanSectionLabel(colonSeparated[1]),
      remainder: colonSeparated[2].trim(),
    };
  }

  // Preserve legacy chord sources such as "Intro C G Am" while still
  // refusing normal lyric sentences. We only split an undelimited prefix
  // when the remainder is independently a chord line.
  const parts = trimmed.split(/\s+/);
  const maxPrefixWords = Math.min(parts.length - 1, 5);
  for (let prefixSize = maxPrefixWords; prefixSize >= 1; prefixSize -= 1) {
    const prefix = parts.slice(0, prefixSize).join(" ");
    const remainder = parts.slice(prefixSize).join(" ");
    if (
      remainder &&
      isRecognizedSongSection(prefix) &&
      isChordLine(remainder)
    ) {
      return {
        label: cleanSectionLabel(prefix),
        remainder,
      };
    }
  }

  return null;
};

export const isChordLine = (line: string): boolean => {
  const trimmedLine = line.trim();
  if (trimmedLine === "") return false;

  const sectionPrefix = splitSongSectionPrefix(trimmedLine);
  const chordCandidate =
    sectionPrefix && sectionPrefix.remainder
      ? sectionPrefix.remainder
      : trimmedLine;

  const words = chordCandidate.split(/[\s|\[\]]+/);
  if (words.length === 0 || (words.length === 1 && words[0] === ""))
    return false;

  const chordWordRegex =
    /^([A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M|º|°|\d|7M|M7)*(?:\([^)]*\))?(?:\/[A-G][#b]?)?)$/;
  let chordCount = 0;
  let nonChordCount = 0;

  for (const word of words) {
    if (!word) continue;
    if (chordWordRegex.test(word)) {
      chordCount++;
    } else {
      if (!/^[0-9()\-x~.]+$/.test(word)) nonChordCount++;
    }
  }

  if (chordCount === 0) return false;
  if (nonChordCount > chordCount) return false;
  return true;
};

export type ParsedSongLine = {
  type: "section" | "chord" | "lyric";
  content: string;
};

export const parseChordsAndLyrics = (text: string): ParsedSongLine[] => {
  if (!text || typeof text !== "string") return [];

  const parsed: ParsedSongLine[] = [];
  const sourceLines = text.replace(/\r/g, "").split("\n");

  sourceLines.forEach((line) => {
    const section = splitSongSectionPrefix(line);

    if (section) {
      parsed.push({
        type: "section",
        content: `[${section.label}]`,
      });

      if (section.remainder) {
        parsed.push({
          type: isChordLine(section.remainder) ? "chord" : "lyric",
          content: section.remainder,
        });
      }
      return;
    }

    parsed.push({
      type: isChordLine(line) ? "chord" : "lyric",
      content: line,
    });
  });

  return parsed;
};

export const parseLyricsAndSections = (text: string): ParsedSongLine[] => {
  if (!text || typeof text !== "string") return [];

  const parsed: ParsedSongLine[] = [];
  text
    .replace(/\r/g, "")
    .split("\n")
    .forEach((line) => {
      const section = splitSongSectionPrefix(line);
      if (section) {
        parsed.push({
          type: "section",
          content: `[${section.label}]`,
        });
        if (section.remainder) {
          parsed.push({ type: "lyric", content: section.remainder });
        }
      } else {
        parsed.push({ type: "lyric", content: line });
      }
    });

  return parsed;
};

export interface SongSectionNavigatorItem {
  index: number;
  label: string;
  displayLabel: string;
  occurrence: number;
  totalOccurrences: number;
}

export const buildSongSectionNavigatorItems = (
  parsedContent: ParsedSongLine[],
): SongSectionNavigatorItem[] => {
  const sections = parsedContent
    .map((line, index) =>
      line.type === "section"
        ? {
            index,
            label: cleanSectionLabel(line.content),
          }
        : null,
    )
    .filter(
      (section): section is { index: number; label: string } =>
        !!section && !!section.label,
    );

  const totals = new Map<string, number>();
  sections.forEach((section) => {
    const key = foldSectionLabel(section.label);
    totals.set(key, (totals.get(key) || 0) + 1);
  });

  const seen = new Map<string, number>();
  return sections.map((section) => {
    const key = foldSectionLabel(section.label);
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);
    const totalOccurrences = totals.get(key) || 1;

    return {
      ...section,
      occurrence,
      totalOccurrences,
      displayLabel:
        totalOccurrences > 1
          ? `${section.label} ${occurrence}`
          : section.label,
    };
  });
};

export const lightThemeColors = {
  lyrics: ["#0f172a", "#334155", "#1e3a8a", "#881337", "#166534", "#701a75"],
  chords: [
    "#2563EB", "#DC2626", "#16a34a", "#d97706", "#9333ea", "#be185d", "#0d9488", "#57534e",
  ],
};

export const darkThemeColors = {
  lyrics: ["#f8fafc", "#cbd5e1", "#93c5fd", "#fef08a", "#86efac", "#f5d0fe"],
  chords: [
    "#fbbf24", "#facc15", "#60a5fa", "#34d399", "#f472b6", "#a78bfa", "#22d3ee", "#fb923c",
  ],
};

interface ChordsRendererProps {
  parsedContent: ReturnType<typeof parseChordsAndLyrics>;
  transpose: number;
  isPowerSave?: boolean;
  activeChordsColor: string;
  activeLyricsColor: string;
  sectionRefs?: React.MutableRefObject<Map<number, HTMLDivElement | null>>;
  className?: string;
  style?: React.CSSProperties;
}

export const ChordsRenderer: React.FC<ChordsRendererProps> = ({
  parsedContent,
  transpose,
  isPowerSave = false,
  activeChordsColor,
  activeLyricsColor,
  sectionRefs,
  className,
  style
}) => {
  if (parsedContent.length === 0) {
    return (
      <div className="text-center text-slate-400 py-24 font-medium">
        Nenhuma cifra disponível.
      </div>
    );
  }

  return (
    <div className={`whitespace-pre-wrap ${className || ""}`} style={style}>
      {parsedContent.map((line, index) => {
        const isPrevChord = index > 0 && parsedContent[index - 1]?.type === "chord";
        const isNextLyric = index < parsedContent.length - 1 && parsedContent[index + 1]?.type === "lyric";

        if (line.type === "section") {
          return (
            <div
              key={index}
              ref={(el) => {
                if (sectionRefs) {
                  if (el) sectionRefs.current.set(index, el);
                  else sectionRefs.current.delete(index);
                }
              }}
              className="inline-flex items-center gap-2 px-3 py-1.5 mt-8 mb-4 text-[0.75em] font-black tracking-[0.1em] uppercase rounded-xl border border-black/10 dark:border-white/[0.08] bg-black/5 dark:bg-white/5 backdrop-blur-md shadow-sm"
              style={{ color: activeChordsColor }}
            >
              {line.content.replace(/^\[?|\]?:?$/g, "")}
            </div>
          );
        } else if (line.type === "chord") {
          return (
            <div
              key={index}
              className="font-bold tracking-wider"
              style={{
                color: activeChordsColor,
                marginBottom: isNextLyric ? "-0.1em" : "0",
                marginTop: isPrevChord ? "0" : "1em",
                textShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              <motion.div
                key={transpose}
                initial={{ opacity: 0.5, y: isPowerSave ? 0 : -2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: isPowerSave ? 0 : 0.2, ease: "easeOut" }}
              >
                {line.content || " "}
              </motion.div>
            </div>
          );
        } else {
          return (
            <div
              key={index}
              className="font-semibold"
              style={{
                color: activeLyricsColor,
                marginBottom: line.content.trim() === "" ? "1.2em" : "0",
                paddingBottom: isNextLyric ? "0" : "0",
              }}
            >
              {line.content || " "}
            </div>
          );
        }
      })}
    </div>
  );
};
