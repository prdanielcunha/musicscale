export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export function toEpochMillis(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (isNaN(value)) return null;
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return isNaN(time) ? null : time;
  }
  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      return value.toMillis();
    }
    if (typeof value.toDate === 'function') {
      return value.toDate().getTime();
    }
    const seconds = value.seconds ?? value._seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (typeof seconds === 'number') {
      return seconds * 1000 + Math.floor(nanoseconds / 1000000);
    }
  }
  return null;
}

export function normalizeKey(key: string): string {
  if (!key) return '';
  return key.replace(/♯/g, '#').replace(/♭/g, 'b');
}

export type ChordContentSourceResolution =
  | {
      key: string;
      source: 'chordContentKey';
      canAutoConfirm: true;
    }
  | {
      key: string;
      source: 'shapeKey';
      canAutoConfirm: false;
    }
  | null;

export function resolveChordContentSourceKey(metadata?: {
  chordContentKey?: string;
  shapeKey?: string;
  normalizedToConcertKey?: boolean;
  [key: string]: any;
} | null): ChordContentSourceResolution {
  if (!metadata) return null;
  if (metadata.chordContentKey && isValidKey(metadata.chordContentKey)) {
    return {
      key: normalizeKey(metadata.chordContentKey),
      source: 'chordContentKey',
      canAutoConfirm: true,
    };
  }
  if (metadata.shapeKey && isValidKey(metadata.shapeKey) && metadata.normalizedToConcertKey !== true) {
    return {
      key: normalizeKey(metadata.shapeKey),
      source: 'shapeKey',
      canAutoConfirm: false,
    };
  }
  return null;
}

export interface BuildChordKeyCorrectionMetadataParams {
  previousContentKey: string;
  correctedContentKey: string;
  sourceConfirmation: {
    type: 'metadata' | 'detected' | 'manual' | 'override';
    metadataKey?: string;
    detectedKey?: string;
    detectionConfidence?: 'high' | 'medium' | 'low';
    selectedKey?: string;
    acknowledgedConflict?: boolean;
  };
  topCandidate?: { key: string; confidence: 'high' | 'medium' | 'low' } | null;
  correctedBy?: string;
  correctedAt?: string;
}

export function buildChordKeyCorrectionMetadata(params: BuildChordKeyCorrectionMetadataParams) {
  const { previousContentKey, correctedContentKey, sourceConfirmation, topCandidate, correctedBy, correctedAt } = params;
  const { signedSemitones, normalizedSemitones } = getSignedSemitones(previousContentKey, correctedContentKey);

  const sourceConfirmationType = sourceConfirmation.type;
  const method = sourceConfirmation.type;
  let detectedKey: string | undefined = undefined;
  let detectionConfidence: 'high' | 'medium' | 'low' | undefined = undefined;
  let conflictAcknowledged = false;

  switch (sourceConfirmation.type) {
    case 'metadata': {
      if (topCandidate && topCandidate.key) {
        detectedKey = topCandidate.key;
        detectionConfidence = topCandidate.confidence;
      }
      conflictAcknowledged = false;
      break;
    }
    case 'detected': {
      detectedKey = sourceConfirmation.detectedKey || topCandidate?.key;
      detectionConfidence = sourceConfirmation.detectionConfidence || topCandidate?.confidence;
      conflictAcknowledged = false;
      break;
    }
    case 'manual': {
      if (topCandidate && (topCandidate.confidence === 'high' || topCandidate.confidence === 'medium')) {
        detectedKey = topCandidate.key;
        detectionConfidence = topCandidate.confidence;
      }
      conflictAcknowledged = false;
      break;
    }
    case 'override': {
      detectedKey = sourceConfirmation.detectedKey || topCandidate?.key;
      detectionConfidence = sourceConfirmation.detectionConfidence || topCandidate?.confidence;
      conflictAcknowledged = true;
      break;
    }
  }

  const correctionObj: Record<string, any> = {
    version: 1,
    previousContentKey,
    correctedContentKey,
    signedSemitones,
    normalizedSemitones,
    semitones: normalizedSemitones,
    method,
    sourceConfirmationType,
    conflictAcknowledged,
    correctedAt: correctedAt || new Date().toISOString(),
    correctedBy: correctedBy || 'unknown',
  };

  if (detectedKey) {
    correctionObj.detectedKey = detectedKey;
  }
  if (detectionConfidence) {
    correctionObj.detectionConfidence = detectionConfidence;
  }

  return correctionObj;
}

export function isValidKey(key: string): boolean {
  if (!key) return false;
  const clean = normalizeKey(key).replace(/m$/, '');
  return NOTES.includes(clean) || FLAT_NOTES.includes(clean);
}

export function areKeysEnharmonicallyEquivalent(keyA: string, keyB: string): boolean {
  if (!keyA || !keyB) return false;
  const normA = normalizeKey(keyA).trim();
  const normB = normalizeKey(keyB).trim();
  if (normA === normB) return true;

  const isMinorA = normA.endsWith('m');
  const isMinorB = normB.endsWith('m');
  if (isMinorA !== isMinorB) return false;

  const rootA = normA.replace(/m$/, '');
  const rootB = normB.replace(/m$/, '');

  const getRootIndex = (root: string): number => {
    let idx = NOTES.indexOf(root);
    if (idx === -1) idx = FLAT_NOTES.indexOf(root);
    return idx;
  };

  const idxA = getRootIndex(rootA);
  const idxB = getRootIndex(rootB);

  if (idxA === -1 || idxB === -1) return false;
  return idxA === idxB;
}

export function transposeChordWithPreference(chord: string, semitones: number, useFlats: boolean, targetKey?: string): string {
  if (semitones === 0) return chord;
  semitones = ((semitones % 12) + 12) % 12;

  const chordRegex = /^([A-G][#b]?)(.*?)(\/([A-G][#b]?))?$/;
  const match = chord.match(chordRegex);

  if (!match) return chord;

  const root = match[1];
  const extensions = match[2] || '';
  const bass = match[4];

  const transposeNote = (note: string): string => {
    let index = NOTES.indexOf(note);
    if (index === -1) {
      index = FLAT_NOTES.indexOf(note);
    }
    if (index === -1) return note; 
    let transposedIndex = (index + semitones) % 12;

    if (targetKey) {
      const normTarget = normalizeKey(targetKey);
      if (normTarget.startsWith('F#') || normTarget.startsWith('D#')) {
        if (transposedIndex === 5) return 'E#';
        if (transposedIndex === 0) return 'B#';
      } else if (normTarget.startsWith('C#')) {
        if (transposedIndex === 0) return 'B#';
        if (transposedIndex === 5) return 'E#';
      }
    }

    return useFlats ? FLAT_NOTES[transposedIndex] : NOTES[transposedIndex]; 
  };

  let result = transposeNote(root) + extensions;
  if (bass) {
    result += '/' + transposeNote(bass);
  }
  return result;
}

export function transposeChordLinePreserveSpacingWithPreference(line: string, semitones: number, useFlats: boolean, targetKey?: string): string {
  if (semitones === 0) return line;
  
  // Split keeping whitespaces
  const parts = line.split(/(\s+|[|]+)/);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.trim() !== '' && !p.match(/^[|]+$/)) {
      let prefix = '';
      let suffix = '';
      let core = p;
      
      if (core.startsWith('(') && core.endsWith(')') && !core.substring(1, core.length - 1).includes('(')) { 
        prefix = '('; 
        suffix = ')'; 
        core = core.substring(1, core.length - 1); 
      } else if (core.startsWith('[') && core.endsWith(']')) {
        prefix = '['; 
        suffix = ']'; 
        core = core.substring(1, core.length - 1); 
      } else if (core.startsWith('|') && core.endsWith('|')) {
        prefix = '|'; 
        suffix = '|'; 
        core = core.substring(1, core.length - 1); 
      }

      if (isChordToken(core)) {
        parts[i] = prefix + transposeChordWithPreference(core, semitones, useFlats, targetKey) + suffix;
      }
    }
  }
  return parts.join('');
}

export function transposeChordDocument(
  chords: string,
  sourceKey: string,
  targetKey: string,
  options?: {
    accidentalPreference?: 'sharp' | 'flat' | 'auto';
  }
): {
  chords: string;
  semitones: number;
  changedChordCount: number;
} {
  const normSource = normalizeKey(sourceKey);
  const normTarget = normalizeKey(targetKey);

  if (!chords || chords.trim() === '') {
    throw new Error('Conteúdo vazio');
  }

  if (!isValidKey(normSource) || !isValidKey(normTarget)) {
    throw new Error('Tom inválido');
  }

  const cleanSource = normSource.replace(/m$/, '');
  const cleanTarget = normTarget.replace(/m$/, '');

  const sourceIndex = NOTES.indexOf(cleanSource) !== -1 ? NOTES.indexOf(cleanSource) : FLAT_NOTES.indexOf(cleanSource);
  const targetIndex = NOTES.indexOf(cleanTarget) !== -1 ? NOTES.indexOf(cleanTarget) : FLAT_NOTES.indexOf(cleanTarget);

  if (sourceIndex === -1 || targetIndex === -1) {
    throw new Error('Tom inválido');
  }

  const semitones = (targetIndex - sourceIndex + 12) % 12;

  if (semitones === 0) {
    return {
      chords,
      semitones: 0,
      changedChordCount: 0,
    };
  }

  // Determine preference for flats vs sharps
  let useFlats = false;
  const pref = options?.accidentalPreference || 'auto';
  if (pref === 'flat') {
    useFlats = true;
  } else if (pref === 'sharp') {
    useFlats = false;
  } else {
    // auto
    const flatKeysList = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];
    useFlats = flatKeysList.includes(normTarget);
  }

  const lines = chords.split('\n');
  let changedChordCount = 0;

  const transposedLines = lines.map((line, idx) => {
    const cl = classifyLine(line, idx, lines);
    
    let lineHasChords = false;
    const parts = line.split(/(\s+|[|]+)/);
    for (const part of parts) {
      const core = part.trim().replace(/^[(|[\]]+|[(|[\]]+$/g, '');
      if (core && isChordToken(core)) {
        lineHasChords = true;
        break;
      }
    }

    if (lineHasChords && cl.type !== LineType.SITE_NOISE_LINE && cl.type !== LineType.CHORD_DICTIONARY_LINE) {
      for (const part of parts) {
        const core = part.trim().replace(/^[(|[\]]+|[(|[\]]+$/g, '');
        if (core && isChordToken(core)) {
          const transposed = transposeChordWithPreference(core, semitones, useFlats, normTarget);
          if (transposed !== core) {
            changedChordCount++;
          }
        }
      }
      return transposeChordLinePreserveSpacingWithPreference(line, semitones, useFlats, normTarget);
    }

    return line;
  });

  return {
    chords: transposedLines.join('\n'),
    semitones,
    changedChordCount,
  };
}

export enum LineType {
  TITLE_CANDIDATE = 'TITLE_CANDIDATE',
  ARTIST_CANDIDATE = 'ARTIST_CANDIDATE',
  METADATA_KEY = 'METADATA_KEY',
  METADATA_CAPO = 'METADATA_CAPO',
  METADATA_SHAPE_KEY = 'METADATA_SHAPE_KEY',
  METADATA_BPM = 'METADATA_BPM',
  SECTION_HEADER = 'SECTION_HEADER',
  CHORD_LINE = 'CHORD_LINE',
  LYRIC_LINE = 'LYRIC_LINE',
  CHORD_AND_LYRIC_LINE = 'CHORD_AND_LYRIC_LINE',
  TAB_LINE = 'TAB_LINE',
  CHORD_DICTIONARY_LINE = 'CHORD_DICTIONARY_LINE',
  CHORD_SHAPE_LINE = 'CHORD_SHAPE_LINE',
  SITE_NOISE_LINE = 'SITE_NOISE_LINE',
  EMPTY_LINE = 'EMPTY_LINE',
  UNKNOWN = 'UNKNOWN',
}

interface ClassifiedLine {
  originalText: string;
  type: LineType;
  tokens?: string[];
  cleanText?: string;
  needsTranspose?: boolean;
  transposed?: boolean;
}

export function isChordToken(token: string): boolean {
  let core = token.trim();
  core = core.replace(/\*+$/, '');
  
  if (core.startsWith('(') && core.endsWith(')') && !core.substring(1, core.length - 1).includes('(')) {
       core = core.substring(1, core.length - 1);
  } else if (core.startsWith('[') && core.endsWith(']')) {
       core = core.substring(1, core.length - 1);
  } else if (core.startsWith('|') && core.endsWith('|')) {
       core = core.replace(/^\|+/, '').replace(/\|+$/, '');
  }

  // Expanded to support pt-BR chords like C7M, F#m7(11), Eadd9, etc.
  const regex = /^[A-G][#b]?(m|M|maj|min|dim|aug|sus|add)?\d*(m|M|maj|min|dim|aug|sus|add)?(\([^)]+\))?(\/[A-G][#b]?)?$/i;
  return regex.test(core) && !/^[A-G][A-Z]+$/.test(core); // prevent matching ALL uppercase words if any?
}

export function isChordOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  const words = trimmed.split(/[\s|]+/);
  const nonMeasureWords = words.filter(w => w.length > 0 && !w.match(/^[|]+$/));
  if (nonMeasureWords.length === 0) return false;
  
  const allChords = nonMeasureWords.every(w => isChordToken(w));
  return allChords;
}

export function isTechnicalLabel(line: string): boolean {
    let lower = line.trim().toLowerCase();
    lower = lower.replace(/^\[/, '').replace(/\]$/, '').trim();
    
    const pattern = /^(parte\s+\d+(\s+de\s+\d+)?|part\s+\d+(\s+of\s+\d+)?|tab\s*\d*|tab\s+-\s+.*|solo(\s+\w+)?\s*\d*|instrumental|interl[uú]dio|interlude|intro\s+instrumental|riff\s*\d*|dedilhado|punteo|rasgueo|base\s*\d*|ponte\s+instrumental|intro)$/i;
    
    return pattern.test(lower);
}

export function removeChordOnlyLinesFromLyrics(lyricsText: string): string {
    const lines = lyricsText.split('\n');
    const cleanLines = lines.filter(line => !isChordOnlyLine(line));
    return cleanLines.join('\n').trim();
}

export function removeOrphanInstrumentalLabelsFromLyrics(lyricsText: string): string {
    const lines = lyricsText.split('\n');
    const result = [];
    for (const line of lines) {
        if (/^\[.*?\]$/.test(line.trim())) {
            result.push(line);
        } else if (isTechnicalLabel(line)) {
            continue;
        } else {
            result.push(line);
        }
    }
    return result.join('\n').trim();
}

export function removeEmptyOrInstrumentalSectionsFromLyrics(lyricsText: string): string {
    const blocks: { header: string | null, lines: string[] }[] = [];
    let currentBlock: { header: string | null, lines: string[] } = { header: null, lines: [] };
    
    const lines = lyricsText.split('\n');
    for (const line of lines) {
        if (/^\[.*?\]$/.test(line.trim())) {
            if (currentBlock.header || currentBlock.lines.length > 0) {
                blocks.push(currentBlock);
            }
            currentBlock = { header: line.trim(), lines: [] };
        } else {
            currentBlock.lines.push(line);
        }
    }
    blocks.push(currentBlock);

    const validBlocks = blocks.filter(block => {
        const hasSingableLine = block.lines.some(l => {
            const t = l.trim();
            if (t.length === 0) return false;
            if (isTechnicalLabel(t)) return false;
            return true;
        });

        return hasSingableLine;
    });

    return validBlocks.map(b => {
        const textLines = b.lines.filter(l => !isTechnicalLabel(l));
        
        while (textLines.length > 0 && textLines[0].trim() === '') textLines.shift();
        while (textLines.length > 0 && textLines[textLines.length - 1].trim() === '') textLines.pop();
        
        const text = textLines.join('\n');
        
        if (b.header) return text ? `${b.header}\n\n${text}` : '';
        return text;
    }).filter(Boolean).join('\n\n').trim();
}

export function validateNoChordLinesInLyrics(lyricsText: string): void {
    const lines = lyricsText.split('\n');
    for (const line of lines) {
        if (isChordOnlyLine(line)) {
            throw new Error(`Letra inválida: Contém linha de acordes ('${line.trim()}')`);
        }
    }
}

export function validateLyricsHasOnlySingableSections(lyricsText: string): void {
    const blocks: { header: string | null, lines: string[] }[] = [];
    let currentBlock: { header: string | null, lines: string[] } = { header: null, lines: [] };
    
    const lines = lyricsText.split('\n');
    for (const line of lines) {
        if (/^\[.*?\]$/.test(line.trim())) {
            if (currentBlock.header || currentBlock.lines.length > 0) {
                blocks.push(currentBlock);
            }
            currentBlock = { header: line.trim(), lines: [] };
        } else {
            currentBlock.lines.push(line);
        }
    }
    blocks.push(currentBlock);

    for (const block of blocks) {
        if (!block.header && block.lines.length === 0) continue;
        
        const hasSingableLine = block.lines.some(l => {
            const t = l.trim();
            if (t.length === 0) return false;
            if (isTechnicalLabel(t)) return false;
            return true;
        });
        
        if (!hasSingableLine) {
           throw new Error(`Letra inválida: Contém seção vazia ou apenas com labels técnicos: ${block.header || '(sem título)'}`);
        }
    }
    
    const orphanCheck = lyricsText.split('\n').find(l => !/^\[.*?\]$/.test(l.trim()) && isTechnicalLabel(l));
    if (orphanCheck) {
        throw new Error(`Letra inválida: Contém label técnico órfão ('${orphanCheck.trim()}')`);
    }
}

export function validateNoChordListAtStartOfChords(chordsText: string): void {
    const lines = chordsText.split('\n');
    let consecutiveChordLines = 0;
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (/^\[.*?\]$/.test(trimmed)) {
            break; // Found section header, we are good
        }
        
        if (isChordOnlyLine(line)) {
            consecutiveChordLines++;
        } else {
            break; // Found lyric or other text, stop checking
        }
    }
    
    if (consecutiveChordLines >= 3) {
        throw new Error("Cifra inválida: Lista de acordes soltos detectada no início.");
    }
    
    const lowerText = chordsText.toLowerCase();
    const badPatterns = [
        "cifra: principal",
        "remover anúncios",
        "apple music",
        "favoritar cifra",
        "formas de acorde",
        "forma dos acordes",
        "diagramas",
        "rolagem automática"
    ];
    
    for (const p of badPatterns) {
        if (lowerText.includes(p)) {
            throw new Error(`Cifra inválida: Contém ruído não permitido ('${p}')`);
        }
    }
}

export function cleanChordsText(chordsText: string): string {
    const lines = chordsText.split('\n');
    let consecutiveChordLines = 0;
    let listEndIndex = -1;
    
    // First, verify if it starts with a chord list
    for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!trimmed) continue;
        
        if (/^\[.*?\]$/.test(trimmed)) {
            break; 
        }
        
        if (isChordOnlyLine(lines[i])) {
            consecutiveChordLines++;
            listEndIndex = i; // keep track of where the last chord in the list is
        } else {
            break; // stopped being a chord
        }
    }
    
    if (consecutiveChordLines >= 3 && listEndIndex !== -1) {
        // Remove lines up to listEndIndex
        return lines.slice(listEndIndex + 1).join('\n').trim();
    }
    return chordsText.trim();
}


export function transposeChord(chord: string, semitones: number): string {
    if (semitones === 0) return chord;
    semitones = ((semitones % 12) + 12) % 12;

    const chordRegex = /^([A-G][#b]?)(.*?)(\/([A-G][#b]?))?$/;
    const match = chord.match(chordRegex);

    if (!match) return chord;

    const root = match[1];
    const extensions = match[2] || '';
    const bass = match[4];

    const transposeNote = (note: string): string => {
        let index = NOTES.indexOf(note);
        if (index === -1) {
            index = FLAT_NOTES.indexOf(note);
        }
        if (index === -1) return note; 
        let transposedIndex = (index + semitones) % 12;
        return NOTES[transposedIndex]; 
    };

    let result = transposeNote(root) + extensions;
    if (bass) {
        result += '/' + transposeNote(bass);
    }
    return result;
}

export function transposeChordLinePreserveSpacing(line: string, semitones: number): string {
    if (semitones === 0) return line;
    
    // Split keeping whitespaces
    const parts = line.split(/(\s+|[|]+)/);
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.trim() !== '' && !p.match(/^[|]+$/)) {
            let prefix = '';
            let suffix = '';
            let core = p;
            
            if (core.startsWith('(') && core.endsWith(')') && !core.substring(1, core.length - 1).includes('(')) { 
                prefix = '('; 
                suffix = ')'; 
                core = core.substring(1, core.length - 1); 
            } else if (core.startsWith('[') && core.endsWith(']')) {
                prefix = '['; 
                suffix = ']'; 
                core = core.substring(1, core.length - 1); 
            } else if (core.startsWith('|') && core.endsWith('|')) {
                prefix = '|'; 
                suffix = '|'; 
                core = core.substring(1, core.length - 1); 
            }

            if (isChordToken(core)) {
                parts[i] = prefix + transposeChord(core, semitones) + suffix;
            }
        }
    }
    return parts.join('');
}

export function isSiteNoiseLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  const noisePatterns = [
      'cifra: principal', '(violão e guitarra)', 'rolagem automática', 
      'favoritar cifra', 'remover anúncios', 'favoritar', 'cifra principal',
      'ver cifra', 'imprimir', 'compartilhar', 'simplificar', 'alterar tom',
      'tom original', 'apple music', 'spotify', 'deezer',
      'adicionar à playlist', 'reportar erro', 'corrigir cifra', 'cifra enviada por',
      'revisões', 'remove ads', 'add to favorites', 'listen on', 'view official tab',
      'quitar anuncios', 'agregar a favoritos', 'desplazamiento automático',
      'cambiar tono', 'escuchar en', 'corregir acordes', 'enviado por',
      'colaboração', 'contributions', 'strumming', 'difficulty', 'simplificada'
  ];

  if (noisePatterns.some(pattern => lower.includes(pattern))) return true;

  if (lower === 'principal' || lower === 'mais') return true;

  // Exact matches
  if (/^tom:\s*[a-g]/i.test(lower)) return true;
  if (/^key:\s*[a-g]/i.test(lower)) return true;
  if (/^\{?key:\s*[a-g]/i.test(lower)) return true; // {key: G}
  if (/^tono:\s*[a-g]/i.test(lower)) return true;
  if (/^capotraste/i.test(lower)) return true; 
  if (/^cejilla/i.test(lower)) return true; 
  if (/^capo:/i.test(lower)) return true;
  
  // Clean shapes 
  if (/^shape\s*:/i.test(lower)) return true;

  return false;
}

export function isChordDictionaryLine(line: string, nextLines: string[]): boolean {
   const trimmed = line.trim();
   // Like X02200, 244322, etc
   if (/^[xX0-9\s\-]{4,12}$/.test(trimmed) && !trimmed.match(/^\d+$/)) {
       return true;
   }
   
   // Sequences of numbers like 34, 12, 1234, 6ª34, 8ª34, 022100
   if (/^(\d[ªº]?)+$/.test(trimmed.replace(/\s+/g, '')) && trimmed.length < 10) return true;
   
   // Like "2ª", "3ª" alone, if we know we are in a dictionary area we might drop it.
   // Or strings like "1 2 3"
   if (/^(\d[ªº]|casa\s*\d+|\d+\s*casa)$/i.test(trimmed) && trimmed.length < 15) return true;
   if (/^[1-5\s\-]{3,8}$/.test(trimmed)) return true;
   
   // E.g. A#m7* or C* often starts a chord diagram block
   if (isChordToken(trimmed) && trimmed.endsWith('*')) return true;

   const lower = trimmed.toLowerCase();
   if (lower.includes('com forma de') || lower.includes('forma dos acordes') || lower.includes('forma do acorde') || lower.includes('chord shape')) {
       return true; 
   }

   return false;
}

export function getChordRoot(chordToken: string): string {
    const match = chordToken.match(/^([A-G][#b]?)/);
    return match ? match[1] : '';
}

export function detectChordSegmentKeyContext(chordLines: string[], shapeKey: string | null, concertKey: string | null): 'SHAPE' | 'CONCERT' | 'UNKNOWN' {
   if (!shapeKey || !concertKey || shapeKey === concertKey) return 'UNKNOWN';

   let shapeScore = 0;
   let concertScore = 0;

   const cleanShapeKey = shapeKey.replace(/m$/, '');
   const cleanConcertKey = concertKey.replace(/m$/, '');

   const getIndex = (root: string) => {
       const idx = NOTES.indexOf(root);
       return idx !== -1 ? idx : FLAT_NOTES.indexOf(root);
   };

   const shapeIdx = getIndex(cleanShapeKey);
   const concertIdx = getIndex(cleanConcertKey);

   if (shapeIdx === -1 || concertIdx === -1) return 'UNKNOWN';

   for (const line of chordLines) {
       const words = line.split(/[\s|()]+/);
       for (const w of words) {
           if (isChordToken(w)) {
               const coreRoot = getChordRoot(w);
               const coreIdx = getIndex(coreRoot);
               if (coreIdx === -1) continue;

               const isMinor = w.includes('m') && !w.includes('maj') && !w.includes('m7b5'); 

               // Concert checks
               if (coreIdx === concertIdx && !isMinor) concertScore += 2;
               if (w.startsWith(cleanConcertKey + '/')) concertScore += 2;
               if (coreIdx === (concertIdx + 9) % 12 && isMinor) concertScore += 1.5;
               if (coreIdx === (concertIdx + 4) % 12 && isMinor) concertScore += 1.5;
               if (coreIdx === (concertIdx + 5) % 12 && !isMinor) concertScore += 1.0;
               if (coreIdx === (concertIdx + 7) % 12 && !isMinor) concertScore += 1.0;

               // Shape checks
               if (coreIdx === shapeIdx && !isMinor) shapeScore += 2;
               if (w.startsWith(cleanShapeKey + '/')) shapeScore += 2;
               if (coreIdx === (shapeIdx + 9) % 12 && isMinor) shapeScore += 1.5;
               if (coreIdx === (shapeIdx + 4) % 12 && isMinor) shapeScore += 1.5;
               if (coreIdx === (shapeIdx + 5) % 12 && !isMinor) shapeScore += 1.0;
               if (coreIdx === (shapeIdx + 7) % 12 && !isMinor) shapeScore += 1.0;
           }
       }
   }

   if (shapeScore > concertScore + 1.5) return 'SHAPE';
   if (concertScore > shapeScore + 1.5) return 'CONCERT';
   return 'UNKNOWN';
}

export function extractGlobalMetadata(rawText: string) {
    let declaredKey: string | null = null;
    let shapeKey: string | null = null;
    let capo: number = 0;
    let bpm: number | null = null;
    let rhythm: string | null = null;

    // Detect Key & Shape
    const keyMatch = rawText.match(/(?:Tom|Key|Tono|Tonalidad)\s*:\s*([A-G][#b]?m?)/i);
    const shapeMatch = rawText.match(/(?:forma(?:\s+dos?|\s+do)?\s+acordes?.*?tom\s+de|shape\s+of|chord\s+shape|acordes\s+en|forma\s+de)\s*([A-G][#b]?m?)/i);
    
    if (keyMatch) declaredKey = keyMatch[1];
    if (shapeMatch) shapeKey = shapeMatch[1];

    // Some sites write "Tom: F# (forma dos acordes no tom de E)" inline.
    const inlineShapeMatch = rawText.match(/Tom:\s*([A-G][#b]?)\s*\(forma.*?([A-G][#b]?)\)/i);
    if (inlineShapeMatch) {
       declaredKey = inlineShapeMatch[1];
       shapeKey = inlineShapeMatch[2];
    }

    // Detect Capo
    const capoMatch = rawText.match(/(?:Capotraste|Capo|Cejilla)[^0-9]*?(\d+)/i);
    if (capoMatch) capo = parseInt(capoMatch[1], 10);

    // Detect BPM manually
    const bpmMatch = rawText.match(/BPM:\s*(\d+)/i) || rawText.match(/(\d+)\s*BPM/i);
    if (bpmMatch) bpm = parseInt(bpmMatch[1], 10);

    const rhythmMatch = rawText.match(/Ritmo:\s*([a-zA-ZÀ-ÿ\s]+)/i);
    if (rhythmMatch) rhythm = rhythmMatch[1].trim();

    // Calculate transposition needed for normalizing to concert key
    let transpositionSemitones = 0;
    if (shapeKey && declaredKey) {
        const shapeIndex = NOTES.indexOf(shapeKey.replace('m','')) !== -1 ? NOTES.indexOf(shapeKey.replace('m','')) : FLAT_NOTES.indexOf(shapeKey.replace('m',''));
        const declaredIndex = NOTES.indexOf(declaredKey.replace('m','')) !== -1 ? NOTES.indexOf(declaredKey.replace('m','')) : FLAT_NOTES.indexOf(declaredKey.replace('m',''));
        
        if (shapeIndex !== -1 && declaredIndex !== -1) {
            transpositionSemitones = (declaredIndex - shapeIndex + 12) % 12;
        }
    } else if (capo > 0 && declaredKey) {
        transpositionSemitones = capo % 12;
        if (!shapeKey) {
             const dIdx = NOTES.indexOf(declaredKey.replace(/m$/, '')) !== -1 ? NOTES.indexOf(declaredKey.replace(/m$/, '')) : FLAT_NOTES.indexOf(declaredKey.replace(/m$/, ''));
             if (dIdx !== -1) {
                 const inferredShapeIdx = (dIdx - transpositionSemitones + 12) % 12;
                 shapeKey = NOTES[inferredShapeIdx] + (declaredKey.endsWith('m') ? 'm' : '');
             }
        }
    } else if (capo > 0) {
        transpositionSemitones = capo;
    }


    return { declaredKey, shapeKey, capo, bpm, rhythm, transpositionSemitones };
}

export function classifyLine(line: string, index: number, allLines: string[]): ClassifiedLine {
    const originalText = line;
    const trimmed = line.trim();

    if (!trimmed) {
        return { originalText, type: LineType.EMPTY_LINE };
    }

    if (isSiteNoiseLine(line)) {
        return { originalText, type: LineType.SITE_NOISE_LINE };
    }

    // Pass slice of next lines to check context
    if (isChordDictionaryLine(line, allLines.slice(index + 1, index + 5))) {
        return { originalText, type: LineType.CHORD_DICTIONARY_LINE };
    }

    if (/^\[.*?\]$/.test(trimmed)) {
        return { originalText, type: LineType.SECTION_HEADER, cleanText: trimmed };
    }
    
    // Tab lines
    if (/^[eEBGDA]\|-/.test(trimmed) || /^[a-gA-G][#b]?\|-/.test(trimmed)) {
       return { originalText, type: LineType.TAB_LINE };
    }
    // Also matches typical tab ascii art
    const tabCharsCount = (trimmed.match(/[-|]/g) || []).length;
    if (tabCharsCount > 10 && !trimmed.match(/[A-Z][a-z]/)) {
       return { originalText, type: LineType.TAB_LINE };
    }

    const words = trimmed.split(/[\s|]+/);
    const nonMeasureWords = words.filter(w => w.length > 0 && !w.match(/^[|]+$/));
    
    // Count chords
    let chordCount = 0;
    for (const w of nonMeasureWords) {
        if (isChordToken(w)) chordCount++;
    }

    if (nonMeasureWords.length > 0 && chordCount === nonMeasureWords.length) {
        return { originalText, type: LineType.CHORD_LINE, needsTranspose: true };
    }

    // Mixed line: has chords but also other things.
    // Let's see if ratio is very high
    const ratio = chordCount / nonMeasureWords.length;
    if (ratio >= 0.6 && chordCount > 0) {
        return { originalText, type: LineType.CHORD_LINE, needsTranspose: true };
    }
    
    // Sometimes 0.5 ratio is chord, like "Em C" -> both chords (ratio=1.0)
    // "Em mim" -> Em (chord), mim (word) -> ratio=0.5
    // Let's protect simple lyrics like "Fé em Deus": Fé(word) em(chord) Deus(word). Ratio = 0.33. (Safe)
    if (ratio === 0.5 && chordCount > 0) {
       // if any word is lowercase starting, it's very likely lyrics, unless it's a bass note.
       const hasNonChordWords = nonMeasureWords.some(w => !isChordToken(w) && w.match(/[a-zÀ-ÿ]/));
       if (!hasNonChordWords) {
          return { originalText, type: LineType.CHORD_LINE, needsTranspose: true };
       }
    }

    // If it's ChordPro format like [G]Amazing [C]grace, it's mixed
    if (/\[[A-G][#b]?[^\]]*\]/.test(line)) {
        return { originalText, type: LineType.CHORD_AND_LYRIC_LINE, needsTranspose: true };
    }

    // It's probably lyrics (or unknown text).
    return { originalText, type: LineType.LYRIC_LINE };
}

export function generateLyricsOnly(classifiedLines: ClassifiedLine[]): string {
    const lyricsLines: string[] = [];
    let previousWasEmpty = true;

    for (const cLine of classifiedLines) {
        if (cLine.type === LineType.EMPTY_LINE) {
            if (!previousWasEmpty) {
                lyricsLines.push('');
                previousWasEmpty = true;
            }
            continue;
        }

        if (cLine.type === LineType.SECTION_HEADER) {
            if (!previousWasEmpty && lyricsLines.length > 0) lyricsLines.push('');
            lyricsLines.push(cLine.originalText.trim());
            previousWasEmpty = false;
            continue;
        }

        if (cLine.type === LineType.LYRIC_LINE) {
            lyricsLines.push(cLine.originalText.trim());
            previousWasEmpty = false;
            continue;
        }
        
        if (cLine.type === LineType.CHORD_AND_LYRIC_LINE) {
            // Strip ChordPro brackets
            lyricsLines.push(cLine.originalText.replace(/\[[A-G][#b]?[^\]]*\]/g, '').trim());
            previousWasEmpty = false;
        }
    }

    while (lyricsLines.length > 0 && lyricsLines[lyricsLines.length - 1] === '') {
        lyricsLines.pop();
    }
    return lyricsLines.join('\n');
}

export function extractTabs(classifiedLines: ClassifiedLine[]): { tabs: { section: string, content: string }[], cleanCls: ClassifiedLine[] } {
    let isTab = false;
    let cleanCls: ClassifiedLine[] = [];
    let tabs: { section: string, content: string }[] = [];
    let currentTabContent: string[] = [];
    let currentSection = "Intro";

    for (let i = 0; i < classifiedLines.length; i++) {
        const cl = classifiedLines[i];

        if (cl.type === LineType.SECTION_HEADER) {
            const m = cl.originalText.match(/^\[Tab\s*[:-]?\s*(.*?)\]$/i) || cl.originalText.match(/^\[?(Intro|Coro|Refrão|Ponte|Verso|Final)[^\]]*\]?/i);
            if (m && m[1]) currentSection = m[1];
            
            if (cl.originalText.toLowerCase().includes('[tab')) {
                // skip keeping it in cleanCls
                continue;
            } else {
                cleanCls.push(cl);
            }
            continue;
        }

        if (cl.type === LineType.TAB_LINE) {
            isTab = true;
            currentTabContent.push(cl.originalText);
        } else if (isTab) {
            if (cl.type === LineType.EMPTY_LINE) {
                tabs.push({ section: currentSection, content: currentTabContent.join('\n') });
                currentTabContent = [];
                isTab = false;
            } else if (cl.originalText.match(/^[a-zA-Z]\|-/) || cl.originalText.trim() === '') {
                 currentTabContent.push(cl.originalText);
            } else {
                 tabs.push({ section: currentSection, content: currentTabContent.join('\n') });
                 currentTabContent = [];
                 isTab = false;
                 cleanCls.push(cl);
            }
        } else {
            cleanCls.push(cl);
        }
    }

    if (isTab && currentTabContent.length > 0) {
        tabs.push({ section: currentSection, content: currentTabContent.join('\n') });
    }

    return { tabs, cleanCls };
}

export function stripTablatureArtifacts(input: string): string {
    const lines = input.split('\n');
    const result: string[] = [];
    
    let inTabBlock = false;

    // Pattern to detect string tab lines
    const stringTabPattern = /^\s*(?:(?:[eEADGBeBGD])\s*\||##\s*\|)[-0-9hbp/\~\s|().]*$/;
    // Let's also catch simple separator lines
    const separatorPattern = /^\s*##?\s*\|[-]+\|?\s*$/;
    
    // Pattern to detect standard section headers that should break the tab block
    const standardSectionPattern = /^\[?(Intro|Primeira Parte|Segunda Parte|Pré-Refrão|Refrão|Ponte|Final|Ministração|Verso|Interlúdio)[^\]]*\]?$/i;

    // Pattern to detect exact match tab blocks
    const tabSectionPattern = /^\[?(Tab\s*[:-]?\s*.*|Tab|Tab Intro|Tab - Solo)\]?$/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        // 1. Check if we are entering a Tab block
        if (tabSectionPattern.test(trimmed)) {
            inTabBlock = true;
            continue; // Skip the tab header
        }
        
        // 2. Check if we hit a standard section, which definitely closes a tab block
        if (inTabBlock && standardSectionPattern.test(trimmed)) {
            inTabBlock = false;
        }

        // 3. If in a tab block, skip standard tab artifact lines
        if (inTabBlock) {
            continue; 
        }

        // 4. Also handle loose tab artifacts outside of explicit [Tab - Intro] headers,
        // because sometimes they are left partially processed.
        if (trimmed.includes('|---') || stringTabPattern.test(trimmed) || separatorPattern.test(trimmed)) {
            continue;
        }

        if (/^Parte\s+\d+\s+de\s+\d+$/i.test(trimmed)) {
            // Only remove if it's adjacent to a tablature.
            // Let's check next lines for tablature signs.
            let hasTabAdjacent = false;
            for (let j = 1; j <= 5 && i + j < lines.length; j++) {
               const adjacentTrimmed = lines[i+j].trim();
               if (adjacentTrimmed.includes('|---') || stringTabPattern.test(adjacentTrimmed)) {
                   hasTabAdjacent = true;
                   break;
               }
               // Stop looking ahead if we hit a real music section or something that isn't chords/empty
               if (standardSectionPattern.test(adjacentTrimmed)) break;
            }
            if (hasTabAdjacent) {
                // Also skip any helper chords immediately following "Parte 1 de X"
                if (i + 1 < lines.length && isChordOnlyLine(lines[i+1])) {
                   lines[i+1] = ''; // blank it out so it gets skipped
                }
                continue;
            }
        }
        
        result.push(line);
    }
    
    // Clean up multiple empty lines
    return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}


export function preProcessSongText(rawText: string) {
    const metadata = extractGlobalMetadata(rawText);
    
    const rawLines = rawText.split('\n');
    const firstClassification = rawLines.map((line, i) => classifyLine(line, i, rawLines));

    // Refinement 1: Drop purely NOISE, METADATA, or DICTIONARY
    let filteredLines = firstClassification.filter(cl => 
        cl.type !== LineType.SITE_NOISE_LINE && 
        cl.type !== LineType.CHORD_DICTIONARY_LINE &&
        !cl.originalText.toLowerCase().includes('tom:') && // Remove leftover inline metadata
        !cl.originalText.toLowerCase().includes('capotraste')
    );

    // Find title and artist at the top
    let title: string | null = null;
    let artist: string | null = null;

    if (filteredLines.length >= 2) {
       for(let i=0; i < 3; i++) {
          if (!filteredLines[i]) break;
          // Title candidate logic
          if (filteredLines[i].type === LineType.LYRIC_LINE && filteredLines[i].originalText.trim().length > 0) {
              let text = filteredLines[i].originalText.trim();
              if (text.startsWith('{title:') || text.startsWith('{t:')) {
                  title = text.replace(/^{t(?:itle)?:\s*/i, '').replace(/}$/, '');
                  filteredLines[i].type = LineType.TITLE_CANDIDATE;
                  continue;
              }
              if (text.startsWith('{artist:}') || text.startsWith('{st:')) {
                  artist = text.replace(/^{s(?:t|ubtitle|artist)?:\s*/i, '').replace(/}$/, '');
                  filteredLines[i].type = LineType.ARTIST_CANDIDATE;
                  break;
              }
              
              if (!title) { title = text; filteredLines[i].type = LineType.TITLE_CANDIDATE; }
              else if (!artist) { artist = text; filteredLines[i].type = LineType.ARTIST_CANDIDATE; break;}
          }
       }
    }

    // Filter out title/artist candidates from chordsText
    filteredLines = filteredLines.filter(cl => cl.type !== LineType.TITLE_CANDIDATE && cl.type !== LineType.ARTIST_CANDIDATE);

    // Extract Tabs
    const tabResult = extractTabs(filteredLines);
    filteredLines = tabResult.cleanCls;

    // Break lines into segments to determine context before transposing
    let segments: { startIndex: number, endIndex: number, context: 'SHAPE' | 'CONCERT' | 'UNKNOWN' }[] = [];
    let currentStartIndex = 0;
    
    for (let i = 0; i < filteredLines.length; i++) {
        if (filteredLines[i].type === LineType.SECTION_HEADER && i > currentStartIndex) {
            segments.push({ startIndex: currentStartIndex, endIndex: i, context: 'UNKNOWN' });
            currentStartIndex = i;
        }
    }
    segments.push({ startIndex: currentStartIndex, endIndex: filteredLines.length, context: 'UNKNOWN' });

    let lastContext: 'SHAPE' | 'CONCERT' | 'UNKNOWN' = 'UNKNOWN';

    for (const seg of segments) {
        const chordLinesInSeg = filteredLines.slice(seg.startIndex, seg.endIndex)
             .filter(cl => cl.type === LineType.CHORD_LINE || cl.type === LineType.CHORD_AND_LYRIC_LINE)
             .map(cl => cl.originalText);
             
        let context = detectChordSegmentKeyContext(chordLinesInSeg, metadata.shapeKey, metadata.declaredKey);
        
        if (context === 'UNKNOWN' && chordLinesInSeg.length > 0) {
            context = lastContext;
        }
        
        if (context !== 'UNKNOWN') {
            lastContext = context;
        }
        seg.context = context;
    }

    // Transpose
    let hasTransposed = false;
    if (metadata.transpositionSemitones > 0) {
        for (const seg of segments) {
            for (let i = seg.startIndex; i < seg.endIndex; i++) {
                let cl = filteredLines[i];
                if (cl.needsTranspose && !cl.transposed) {
                    if (seg.context === 'SHAPE' || (!metadata.shapeKey && metadata.capo > 0)) {
                       if (cl.type === LineType.CHORD_LINE) {
                           cl.originalText = transposeChordLinePreserveSpacing(cl.originalText, metadata.transpositionSemitones);
                           cl.transposed = true;
                           hasTransposed = true;
                       }
                    } else if (seg.context === 'CONCERT') {
                       cl.transposed = true; // Mark as transposed to prevent any future transpositions
                    }
                }
            }
        }
    }

    // Strip remaining noise from the top before compiling chordsText
    let firstMusicalIndex = -1;
    for (let i = 0; i < filteredLines.length; i++) {
        if ([LineType.LYRIC_LINE, LineType.CHORD_LINE, LineType.SECTION_HEADER, LineType.CHORD_AND_LYRIC_LINE].includes(filteredLines[i].type)) {
            firstMusicalIndex = i;
            break;
        }
    }
    if (firstMusicalIndex > 0) {
        filteredLines = filteredLines.slice(firstMusicalIndex);
    }

    // Compress blank lines
    let finalChordsLines = [];
    let previousWasEmpty = true;
    for (let cl of filteredLines) {
        if (cl.type === LineType.EMPTY_LINE) {
            if (!previousWasEmpty) finalChordsLines.push(cl.originalText);
            previousWasEmpty = true;
        } else {
            finalChordsLines.push(cl.originalText);
            previousWasEmpty = false;
        }
    }

    // Pop trailing blanks
    while(finalChordsLines.length > 0 && finalChordsLines[finalChordsLines.length - 1].trim() === '') {
        finalChordsLines.pop();
    }
    // Remove leading blanks
    while(finalChordsLines.length > 0 && finalChordsLines[0].trim() === '') {
        finalChordsLines.shift();
    }

    const chordsText = stripTablatureArtifacts(finalChordsLines.join('\n'));
    const lyricsText = stripTablatureArtifacts(generateLyricsOnly(filteredLines));

    const sectionsSet = new Set<string>();
    const sectionMatches = [...(chordsText.matchAll(/(?:^|\n)\s*\[(.*?)\]/g))];
    for (const match of sectionMatches) {
        if (match[1]) sectionsSet.add(match[1].trim());
    }

    return {
        title,
        artist,
        bpm: metadata.bpm,
        rhythm: metadata.rhythm,
        chordsText,
        lyricsText,
        sections: Array.from(sectionsSet),
        tabs: tabResult.tabs,
        metadata: {
            declaredKey: metadata.declaredKey,
            shapeKey: metadata.shapeKey,
            capo: metadata.capo,
            transpositionSemitones: metadata.transpositionSemitones,
            normalizedToConcertKey: hasTransposed
        }
    }
}

export interface ChordKeyCandidate {
  key: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  evidence: {
    tonicHits: number;
    dominantHits: number;
    diatonicHits: number;
    totalChordTokens: number;
  };
}

export interface ChordDocumentAnalysisResult {
  candidates: ChordKeyCandidate[];
}

export function getSignedSemitones(sourceKey: string, targetKey: string): { signedSemitones: number; normalizedSemitones: number } {
  const normSource = normalizeKey(sourceKey);
  const normTarget = normalizeKey(targetKey);

  const cleanSource = normSource.replace(/m$/, '');
  const cleanTarget = normTarget.replace(/m$/, '');

  const sourceIndex = NOTES.indexOf(cleanSource) !== -1 ? NOTES.indexOf(cleanSource) : FLAT_NOTES.indexOf(cleanSource);
  const targetIndex = NOTES.indexOf(cleanTarget) !== -1 ? NOTES.indexOf(cleanTarget) : FLAT_NOTES.indexOf(cleanTarget);

  if (sourceIndex === -1 || targetIndex === -1) {
    return { signedSemitones: 0, normalizedSemitones: 0 };
  }

  const normalizedSemitones = (targetIndex - sourceIndex + 12) % 12;
  let signedSemitones = normalizedSemitones;
  if (normalizedSemitones > 6) {
    signedSemitones = normalizedSemitones - 12;
  }

  return { signedSemitones, normalizedSemitones };
}

export function analyzeChordDocumentKeyCandidates(chords: string): ChordDocumentAnalysisResult {
  if (!chords || !chords.trim()) {
    return { candidates: [] };
  }

  const lines = chords.split('\n');
  const chordTokens: { root: string; quality: 'Major' | 'Minor'; isSlash: boolean; raw: string }[] = [];
  let firstTokenRoot: string | null = null;
  let lastTokenRoot: string | null = null;

  for (const line of lines) {
    const parts = line.split(/(\s+|[|]+)/);
    for (const part of parts) {
      const core = part.trim().replace(/^[(|[\]]+|[(|[\]]+$/g, '');
      if (core && isChordToken(core)) {
        const chordRegex = /^([A-G][#b]?)(.*?)(\/([A-G][#b]?))?$/;
        const match = core.match(chordRegex);
        if (match) {
          const rootNote = normalizeKey(match[1]);
          const ext = match[2] || '';
          const isMinor = /^m(?!aj)/.test(ext) || ext.startsWith('min');
          const tokenObj = {
            root: rootNote,
            quality: (isMinor ? 'Minor' : 'Major') as 'Major' | 'Minor',
            isSlash: !!match[4],
            raw: core
          };
          chordTokens.push(tokenObj);
          if (!firstTokenRoot) firstTokenRoot = rootNote;
          lastTokenRoot = rootNote;
        }
      }
    }
  }

  if (chordTokens.length === 0) {
    return { candidates: [] };
  }

  const testMajorKeys = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];
  const testMinorKeys = testMajorKeys.map(k => `${k}m`);
  const allTestKeys = [...testMajorKeys, ...testMinorKeys];

  const getNoteIndex = (note: string) => {
    const clean = normalizeKey(note).replace(/m$/, '');
    let idx = NOTES.indexOf(clean);
    if (idx === -1) idx = FLAT_NOTES.indexOf(clean);
    return idx;
  };

  const rawCandidates: {
    key: string;
    score: number;
    evidence: { tonicHits: number; dominantHits: number; diatonicHits: number; totalChordTokens: number };
  }[] = [];

  for (const keyCandidate of allTestKeys) {
    const isMinorKey = keyCandidate.endsWith('m');
    const rootNote = keyCandidate.replace(/m$/, '');
    const rootIdx = getNoteIndex(rootNote);
    if (rootIdx === -1) continue;

    let tonicHits = 0;
    let dominantHits = 0;
    let diatonicHits = 0;

    for (const token of chordTokens) {
      const tokenIdx = getNoteIndex(token.root);
      if (tokenIdx === -1) continue;

      const semitoneOffset = (tokenIdx - rootIdx + 12) % 12;

      if (!isMinorKey) {
        if (semitoneOffset === 0 && token.quality === 'Major') {
          tonicHits++;
          diatonicHits++;
        } else if (semitoneOffset === 7 && token.quality === 'Major') {
          dominantHits++;
          diatonicHits++;
        } else if (
          (semitoneOffset === 2 && token.quality === 'Minor') ||
          (semitoneOffset === 4 && token.quality === 'Minor') ||
          (semitoneOffset === 5 && token.quality === 'Major') ||
          (semitoneOffset === 9 && token.quality === 'Minor') ||
          (semitoneOffset === 11)
        ) {
          diatonicHits++;
        } else if (semitoneOffset === 2 && token.quality === 'Major') {
          diatonicHits += 0.5;
        }
      } else {
        if (semitoneOffset === 0 && token.quality === 'Minor') {
          tonicHits++;
          diatonicHits++;
        } else if (semitoneOffset === 7) {
          dominantHits++;
          diatonicHits++;
        } else if (
          (semitoneOffset === 2) ||
          (semitoneOffset === 3 && token.quality === 'Major') ||
          (semitoneOffset === 5 && token.quality === 'Minor') ||
          (semitoneOffset === 8 && token.quality === 'Major') ||
          (semitoneOffset === 10 && token.quality === 'Major')
        ) {
          diatonicHits++;
        }
      }
    }

    let score = tonicHits * 3.5 + dominantHits * 2.5 + Math.max(0, diatonicHits - tonicHits - dominantHits) * 1.0;

    if (firstTokenRoot && getNoteIndex(firstTokenRoot) === rootIdx) {
      score += 1.5;
    }
    if (lastTokenRoot && getNoteIndex(lastTokenRoot) === rootIdx) {
      score += 1.0;
    }

    rawCandidates.push({
      key: keyCandidate,
      score,
      evidence: {
        tonicHits,
        dominantHits,
        diatonicHits,
        totalChordTokens: chordTokens.length
      }
    });
  }

  rawCandidates.sort((a, b) => b.score - a.score);

  const canonicalCandidates: typeof rawCandidates = [];
  const seenIndices = new Set<string>();

  for (const cand of rawCandidates) {
    const isMinor = cand.key.endsWith('m');
    const rootIdx = getNoteIndex(cand.key);
    const keyId = `${rootIdx}_${isMinor ? 'm' : 'M'}`;
    if (!seenIndices.has(keyId)) {
      seenIndices.add(keyId);
      canonicalCandidates.push(cand);
    }
  }

  const topScore = canonicalCandidates[0]?.score || 0;
  const secondScore = canonicalCandidates[1]?.score || 0;

  const resultCandidates: ChordKeyCandidate[] = canonicalCandidates.map((cand, idx) => {
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (idx === 0) {
      if (cand.score >= 3.5 && (canonicalCandidates.length === 1 || cand.score >= secondScore * 1.3 || cand.score - secondScore >= 2.0)) {
        confidence = 'high';
      } else if (cand.score >= 2.0) {
        confidence = 'medium';
      } else {
        confidence = 'low';
      }
    } else {
      confidence = 'low';
    }

    return {
      key: cand.key,
      score: cand.score,
      confidence,
      evidence: cand.evidence
    };
  });

  return { candidates: resultCandidates };
}

export function validateTransposedPreview(
  originalChords: string,
  transposedChords: string,
  sourceKey: string,
  targetKey: string
): { valid: boolean; error?: string } {
  if (!originalChords || !transposedChords) {
    return { valid: false, error: 'Conteúdo do preview está vazio' };
  }

  const { normalizedSemitones } = getSignedSemitones(sourceKey, targetKey);
  if (normalizedSemitones === 0) {
    return { valid: true };
  }

  const origLyrics = removeChordOnlyLinesFromLyrics(originalChords);
  const transLyrics = removeChordOnlyLinesFromLyrics(transposedChords);
  if (origLyrics !== transLyrics) {
    return { valid: false, error: 'A letra foi alterada após a transposição' };
  }

  const getChordTokens = (text: string): string[] => {
    const tokens: string[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const parts = line.split(/(\s+|[|]+)/);
      for (const part of parts) {
        const core = part.trim().replace(/^[(|[\]]+|[(|[\]]+$/g, '');
        if (core && isChordToken(core)) {
          tokens.push(core);
        }
      }
    }
    return tokens;
  };

  const origTokens = getChordTokens(originalChords);
  const transTokens = getChordTokens(transposedChords);

  if (origTokens.length !== transTokens.length) {
    return { valid: false, error: `Quantidade de acordes diverge: ${origTokens.length} na origem vs ${transTokens.length} no resultado` };
  }

  const normTarget = normalizeKey(targetKey);
  const flatKeysList = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm'];
  const useFlats = flatKeysList.includes(normTarget);

  for (let i = 0; i < origTokens.length; i++) {
    const expected = transposeChordWithPreference(origTokens[i], normalizedSemitones, useFlats, normTarget);
    if (transTokens[i] !== expected) {
      return {
        valid: false,
        error: `Acorde inconsistente: ${origTokens[i]} deveria virar ${expected}, mas foi transformado em ${transTokens[i]}`
      };
    }
  }

  return { valid: true };
}

export type ChordContentKeyConsistencyStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'INDETERMINATE'
  | 'NO_CHORDS';

export interface ChordContentKeyConsistencyResult {
  status: ChordContentKeyConsistencyStatus;
  expectedKey: string;
  detectedKey?: string;
  confidence?: 'high' | 'medium' | 'low';
  topScore?: number;
  expectedScore?: number;
  scoreGap?: number;
  totalChordTokens: number;
}

export function validateChordContentKeyConsistency(
  chords: string,
  expectedKey: string
): ChordContentKeyConsistencyResult {
  if (!isValidKey(expectedKey)) {
    return {
      status: 'INDETERMINATE',
      expectedKey,
      totalChordTokens: 0
    };
  }

  const analysis = analyzeChordDocumentKeyCandidates(chords);
  if (!analysis.candidates || analysis.candidates.length === 0) {
    return {
      status: 'NO_CHORDS',
      expectedKey,
      totalChordTokens: 0
    };
  }

  const normExpectedKey = normalizeKey(expectedKey);
  const expectedCandidate: ChordKeyCandidate | undefined = analysis.candidates.find((candidate) =>
    areKeysEnharmonicallyEquivalent(
      normalizeKey(candidate.key),
      normExpectedKey
    )
  );

  const topCandidate = analysis.candidates[0];
  const scoreGap = topCandidate.score - (expectedCandidate ? expectedCandidate.score : 0);

  if (expectedCandidate) {
    const expectedDiatonicRatio = expectedCandidate.evidence.totalChordTokens > 0 
      ? expectedCandidate.evidence.diatonicHits / expectedCandidate.evidence.totalChordTokens 
      : 0;
    
    if (topCandidate.evidence.totalChordTokens >= 3 &&
        expectedCandidate.evidence.tonicHits >= 1 &&
        expectedDiatonicRatio >= 0.75 &&
        scoreGap <= 1.5) {
      return {
        status: 'MATCH',
        expectedKey,
        detectedKey: expectedCandidate.key,
        confidence: topCandidate.confidence,
        topScore: topCandidate.score,
        expectedScore: expectedCandidate.score,
        scoreGap,
        totalChordTokens: topCandidate.evidence.totalChordTokens
      };
    }
  }

  const expectedDiatonicRatio2 = expectedCandidate && expectedCandidate.evidence.totalChordTokens > 0 
    ? expectedCandidate.evidence.diatonicHits / expectedCandidate.evidence.totalChordTokens 
    : 0;

  if (topCandidate.evidence.totalChordTokens >= 4 &&
      (topCandidate.confidence === 'high' || topCandidate.confidence === 'medium') &&
      scoreGap >= 3 &&
      (!expectedCandidate || expectedCandidate.evidence.tonicHits === 0) &&
      expectedDiatonicRatio2 <= 0.25) {
    return {
      status: 'MISMATCH',
      expectedKey,
      detectedKey: topCandidate.key,
      confidence: topCandidate.confidence,
      topScore: topCandidate.score,
      expectedScore: expectedCandidate ? expectedCandidate.score : 0,
      scoreGap,
      totalChordTokens: topCandidate.evidence.totalChordTokens
    };
  }

  return {
    status: 'INDETERMINATE',
    expectedKey,
    detectedKey: topCandidate.key,
    confidence: topCandidate.confidence,
    topScore: topCandidate.score,
    expectedScore: expectedCandidate ? expectedCandidate.score : 0,
    scoreGap,
    totalChordTokens: topCandidate.evidence.totalChordTokens
  };
}
