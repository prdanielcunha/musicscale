export interface SongSectionMatch {
  label: string;
  remainder: string;
}

const SECTION_LABEL_PATTERNS = [
  "Intro",
  "Introdu[cç][aã]o",
  "Abertura",
  "In[ií]cio",
  "Parte Inicial",
  "(?:Primeira|Segunda|Terceira|Quarta) Parte",
  "[1-4](?:ª|º|a)? Parte",
  "Parte [1-9][0-9]*",
  "Verso(?: [1-9][0-9]*)?",
  "Verse(?: [1-9][0-9]*)?",
  "Estrofe(?: [1-9][0-9]*)?",
  "Pr[eé][ -]?Refr[aã]o",
  "Pr[eé][ -]?Coro",
  "Pre-Chorus",
  "Coro(?: [1-9][0-9]*)?",
  "Refr[aã]o(?: [1-9][0-9]*)?",
  "Chorus(?: [1-9][0-9]*)?",
  "Ponte(?: [1-9][0-9]*)?",
  "Bridge(?: [1-9][0-9]*)?",
  "Interl[uú]dio",
  "Interlude",
  "Instrumental",
  "Solo(?: [1-9][0-9]*)?",
  "Ministra[cç][aã]o",
  "Espont[aâ]neo",
  "Spontaneous",
  "Vamp",
  "Final",
  "Fim",
  "Outro",
  "Ending",
];

const SECTION_LABEL_REGEX = new RegExp(
  `^(?:${SECTION_LABEL_PATTERNS.join("|")})$`,
  "i",
);

const cleanSectionLabel = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.:\-]+$/g, "")
    .trim();

export const isSongSectionLabel = (value: string): boolean =>
  SECTION_LABEL_REGEX.test(cleanSectionLabel(value));

/**
 * Recognizes musical sections without treating arbitrary bracketed notes as
 * navigation markers. Inline content is split only when the section is
 * explicitly bracketed (e.g. "[Intro] C Am") or separated by ":"/"-".
 */
export const splitSongSectionLine = (line: string): SongSectionMatch | null => {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;

  const bracketed = trimmed.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (bracketed) {
    const label = cleanSectionLabel(bracketed[1]);
    if (!isSongSectionLabel(label)) return null;
    return { label, remainder: bracketed[2].trim() };
  }

  if (isSongSectionLabel(trimmed)) {
    return { label: cleanSectionLabel(trimmed), remainder: "" };
  }

  const explicitInline = trimmed.match(/^(.+?)\s*[:\-]\s+(.+)$/);
  if (explicitInline) {
    const label = cleanSectionLabel(explicitInline[1]);
    if (isSongSectionLabel(label)) {
      return { label, remainder: explicitInline[2].trim() };
    }
  }

  return null;
};

export const formatSectionDisplayLabel = (value: string) =>
  cleanSectionLabel(value);
