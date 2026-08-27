import { deriveGlobalSongContentMetrics } from '../../utils/globalSongContentMetrics.js';
import { buildGlobalSongSearchFields, type GlobalSongSearchFields } from '../../utils/searchEngine.js';
import { normalizeBaseText } from '../../utils/songDiscovery/textNormalization.js';

export interface GlobalSongCanonicalDelta {
    updates: Record<string, unknown>;
    missingFields: string[];
    mismatchedFields: string[];
}

export interface GlobalSongBackfillAnalysis {
    normalized: GlobalSongCanonicalDelta;
    search: GlobalSongCanonicalDelta;
    contentMetrics: GlobalSongCanonicalDelta;
    updates: Record<string, unknown>;
    requiresUpdate: boolean;
}

function arraysEqual(left: unknown, right: string[]): boolean {
    return Array.isArray(left)
        && left.length === right.length
        && left.every((value, index) => value === right[index]);
}

function collectFieldDelta(
    data: Record<string, unknown>,
    expected: Record<string, unknown>,
    equal: (actual: unknown, canonical: unknown) => boolean = Object.is,
): GlobalSongCanonicalDelta {
    const updates: Record<string, unknown> = {};
    const missingFields: string[] = [];
    const mismatchedFields: string[] = [];

    for (const [field, canonical] of Object.entries(expected)) {
        if (equal(data[field], canonical)) continue;

        updates[field] = canonical;
        if (!(field in data)) missingFields.push(field);
        else mismatchedFields.push(field);
    }

    return { updates, missingFields, mismatchedFields };
}

function collectNormalizedDelta(data: Record<string, unknown>): GlobalSongCanonicalDelta {
    const expected: Record<string, unknown> = {};
    const normalizedTitle = normalizeBaseText(String(data.title || ''));

    // Preserve the established backfill behavior: a missing or blank title
    // normalization is repaired, including for an empty source title.
    if (!data.normalizedTitle || data.normalizedTitle !== normalizedTitle) {
        expected.normalizedTitle = normalizedTitle;
    }

    if (data.artist) {
        const normalizedArtist = normalizeBaseText(String(data.artist));
        const currentPrimaryArtist = Array.isArray(data.normalizedArtists)
            ? data.normalizedArtists[0]
            : null;
        if (currentPrimaryArtist !== normalizedArtist) {
            expected.normalizedArtists = [normalizedArtist];
        }
    }

    return collectFieldDelta(data, expected, (actual, canonical) => {
        if (Array.isArray(canonical)) return arraysEqual(actual, canonical as string[]);
        return Object.is(actual, canonical);
    });
}

function collectSearchDelta(data: Record<string, unknown>): GlobalSongCanonicalDelta {
    const canonical = buildGlobalSongSearchFields(data) as GlobalSongSearchFields;
    return collectFieldDelta(data, canonical as unknown as Record<string, unknown>, (actual, expected) => {
        if (Array.isArray(expected)) return arraysEqual(actual, expected as string[]);
        return Object.is(actual, expected);
    });
}

function collectContentMetricsDelta(data: Record<string, unknown>): GlobalSongCanonicalDelta {
    const canonical = deriveGlobalSongContentMetrics({
        chords: data.chords,
        lyrics: data.lyrics,
    });
    return collectFieldDelta(data, canonical as unknown as Record<string, unknown>);
}

/**
 * Pure canonical analysis shared by the human backfill and the machine
 * dry-run. It deliberately contains no Firestore references or mutations.
 */
export function analyzeGlobalSongBackfillDocument(data: Record<string, unknown>): GlobalSongBackfillAnalysis {
    const normalized = collectNormalizedDelta(data);
    const search = collectSearchDelta(data);
    const contentMetrics = collectContentMetricsDelta(data);
    const updates = {
        ...normalized.updates,
        ...search.updates,
        ...contentMetrics.updates,
    };

    return {
        normalized,
        search,
        contentMetrics,
        updates,
        requiresUpdate: Object.keys(updates).length > 0,
    };
}
