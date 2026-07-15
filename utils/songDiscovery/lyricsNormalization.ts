import { MAX_NORMALIZED_LYRICS_LENGTH } from './constants.js';
import { normalizeBaseText } from './textNormalization.js';
// Import from the single source of truth for chord classification
import { classifyLine, LineType } from '../chordEngine.js';

export function normalizeLyrics(rawLyrics: string | undefined): string | null {
    if (!rawLyrics) return null;

    const lines = rawLyrics.split('\n');
    const classifiedLines = lines.map((line, index) => classifyLine(line, index, lines));
    
    const lyricsLines = classifiedLines.filter(c => c.type === LineType.LYRIC_LINE || c.type === LineType.CHORD_AND_LYRIC_LINE);
    const lyricsText = lyricsLines.map(c => c.originalText.replace(/\[[A-G][#b]?[^\]]*\]/g, '')).join('\n');

    let normalized = normalizeBaseText(lyricsText);
    
    if (normalized.length > MAX_NORMALIZED_LYRICS_LENGTH) {
        normalized = normalized.substring(0, MAX_NORMALIZED_LYRICS_LENGTH);
    }

    return normalized.length > 0 ? normalized : null;
}

export function extractOpeningLyrics(rawLyrics: string | undefined): string | null {
    if (!rawLyrics) return null;

    const lines = rawLyrics.split('\n');
    const classifiedLines = lines.map((line, index) => classifyLine(line, index, lines));
    
    let lyricsCount = 0;
    const openingTexts: string[] = [];
    
    for (const c of classifiedLines) {
        if (c.type === LineType.LYRIC_LINE || c.type === LineType.CHORD_AND_LYRIC_LINE) {
            openingTexts.push(c.originalText.replace(/\[[A-G][#b]?[^\]]*\]/g, ''));
            lyricsCount++;
            if (lyricsCount >= 4) break;
        }
    }

    const normalized = normalizeBaseText(openingTexts.join('\n'));

    return normalized.length > 0 ? normalized : null;
}

export function extractChorusLyrics(rawLyrics: string | undefined): string | null {
    if (!rawLyrics) return null;

    const lines = rawLyrics.split('\n');
    const classifiedLines = lines.map((line, index) => classifyLine(line, index, lines));

    let inChorus = false;
    const chorusTexts: string[] = [];
    
    for (const c of classifiedLines) {
        if (c.type === LineType.SECTION_HEADER) {
            const headerLower = c.originalText.toLowerCase();
            const isChorusHeader = headerLower.includes('refrão') || 
                                   headerLower.includes('refrao') || 
                                   headerLower.includes('chorus') || 
                                   headerLower.includes('coro');
            
            if (isChorusHeader) {
                inChorus = true;
                continue;
            } else if (inChorus) {
                break;
            }
        }

        if (c.type === LineType.EMPTY_LINE) {
            if (inChorus && chorusTexts.length > 0) {
                break;
            }
            continue;
        }

        if (inChorus && (c.type === LineType.LYRIC_LINE || c.type === LineType.CHORD_AND_LYRIC_LINE)) {
            chorusTexts.push(c.originalText.replace(/\[[A-G][#b]?[^\]]*\]/g, ''));
        }
    }

    const normalized = normalizeBaseText(chorusTexts.join('\n'));
    return normalized.length > 0 ? normalized : null;
}
