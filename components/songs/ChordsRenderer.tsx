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

export const isChordLine = (line: string): boolean => {
  const trimmedLine = line.trim();
  if (trimmedLine === "") return false;
  const noPrefixLine = trimmedLine.replace(
    /^\[?(Intro|Coro|Refrão|Ponte|Verso|Final|Interlúdio|Instrumental)\]?\s*[:.-]?\s*/i,
    ""
  );
  const words = noPrefixLine.split(/[\s|\[\]]+/);
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

export const parseChordsAndLyrics = (text: string) => {
  if (!text || typeof text !== 'string') return [];
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const sectionMatch = trimmed.match(
        /^\[?(Intro|Coro|Refrão|Ponte|Verso|Final|Outro|Interlúdio|Instrumental|Pré-Coro|Pre-Chorus|Solo|Ministração|Ministracao|Vamp)[^\]]*\]?[:.-]?$/i
      );

      if (sectionMatch && !isChordLine(line)) {
        return { type: "section", content: line };
      }
      return {
        type: isChordLine(line) ? "chord" : "lyric",
        content: line,
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
