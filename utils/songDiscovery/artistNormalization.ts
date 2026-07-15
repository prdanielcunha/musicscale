import { normalizeBaseText } from './textNormalization.js';

export function normalizeArtist(artistString: string | undefined): string[] {
    if (!artistString) return [];

    let text = artistString.toLowerCase();

    // Replace known splitters with a standard pipe `|`
    // " x " (with spaces), " feat ", " ft. ", " & ", ",", ";", " + "
    text = text.replace(/\bfeat\.?\b/g, '|');
    text = text.replace(/\bft\.?\b/g, '|');
    text = text.replace(/\bfeaturing\b/g, '|');
    text = text.replace(/\bcom\b/g, '|'); // Be careful with "com", it's portuguese "with". But in names...
    
    // Non-word delimiters: &, +, ,, ;
    text = text.replace(/[&+,;]/g, '|');

    // " x " for collaboration
    text = text.replace(/\s+x\s+/g, '|');

    // split by pipe
    const rawArtists = text.split('|');

    const normalizedArtists = rawArtists
        .map(a => normalizeBaseText(a))
        .filter(a => a.length > 0);

    // deduplicate and sort
    const unique = Array.from(new Set(normalizedArtists));
    unique.sort((a, b) => a.localeCompare(b));

    return unique;
}
