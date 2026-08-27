import { deriveGlobalSongContentMetrics } from '../../utils/globalSongContentMetrics.js';

export const EXPECTED_MACHINE_FIREBASE_PROJECT_ID = 'millionsnest';

export type MachineDryRunErrorCode =
    | 'MACHINE_PROJECT_MISMATCH'
    | 'MACHINE_READ_UNAVAILABLE';

/** A deliberately non-diagnostic error that is safe for operational logs. */
export class MachineDryRunError extends Error {
    constructor(public readonly code: MachineDryRunErrorCode) {
        super(code);
        this.name = 'MachineDryRunError';
    }
}

export interface GlobalSongMetricsMachineDryRunOptions {
    actualProjectId: string | undefined;
    expectedProjectId?: string;
    pageSize?: number;
    maxPages?: number;
}

interface QuerySnapshotLike {
    empty: boolean;
    size: number;
    docs: Array<{
        id: string;
        data(): Record<string, unknown>;
    }>;
}

interface QueryLike {
    orderBy(field: string): QueryLike;
    startAfter(lastDoc: unknown): QueryLike;
    limit(value: number): QueryLike;
    get(): Promise<QuerySnapshotLike>;
}

interface ReadOnlyFirestoreLike {
    collection(name: string): QueryLike;
}

function normalizeBoundedInteger(value: number | undefined, fallback: number, maximum: number): number {
    if (value === undefined) return fallback;
    if (!Number.isInteger(value) || value < 1 || value > maximum) {
        throw new MachineDryRunError('MACHINE_READ_UNAVAILABLE');
    }
    return value;
}

function metricsMatch(data: Record<string, unknown>): boolean {
    const canonical = deriveGlobalSongContentMetrics({
        chords: data.chords,
        lyrics: data.lyrics,
    });

    return data.hasChords === canonical.hasChords
        && data.hasLyrics === canonical.hasLyrics
        && data.isComplete === canonical.isComplete;
}

/**
 * Stops before any Firestore access unless the configured Admin project is the
 * versioned MillionsNest project. It only derives counters from document data.
 */
export function assertExpectedMachineProject(
    expectedProjectId: string,
    actualProjectId: string | undefined,
): void {
    if (!actualProjectId || actualProjectId !== expectedProjectId) {
        throw new MachineDryRunError('MACHINE_PROJECT_MISMATCH');
    }
}

/**
 * Internal machine-only inspection. This module intentionally has no mutation
 * APIs and is not registered by the HTTP server.
 */
export async function runGlobalSongMetricsMachineDryRun(
    db: ReadOnlyFirestoreLike,
    options: GlobalSongMetricsMachineDryRunOptions,
) {
    const expectedProjectId = options.expectedProjectId || EXPECTED_MACHINE_FIREBASE_PROJECT_ID;
    assertExpectedMachineProject(expectedProjectId, options.actualProjectId);

    const pageSize = normalizeBoundedInteger(options.pageSize, 200, 200);
    const maxPages = normalizeBoundedInteger(options.maxPages, 1000, 1000);
    let query = db.collection('globalSongs').orderBy('__name__').limit(pageSize);
    let processed = 0;
    let metricsConverged = 0;
    let metricsDivergent = 0;
    let pagesRead = 0;
    let lastCursor: string | undefined;

    try {
        for (let page = 0; page < maxPages; page++) {
            const snapshot = await query.get();
            pagesRead++;

            if (snapshot.empty) {
                return {
                    processed,
                    metricsConverged,
                    metricsDivergent,
                    pagesRead,
                    truncated: false,
                };
            }

            for (const doc of snapshot.docs) {
                processed++;
                if (metricsMatch(doc.data())) {
                    metricsConverged++;
                } else {
                    metricsDivergent++;
                }
            }

            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            lastCursor = lastDoc.id;
            if (snapshot.size < pageSize) {
                return {
                    processed,
                    metricsConverged,
                    metricsDivergent,
                    pagesRead,
                    truncated: false,
                    lastCursor,
                };
            }

            if (page + 1 === maxPages) {
                return {
                    processed,
                    metricsConverged,
                    metricsDivergent,
                    pagesRead,
                    truncated: true,
                    lastCursor,
                };
            }

            query = db.collection('globalSongs').orderBy('__name__').startAfter(lastDoc).limit(pageSize);
        }
    } catch (error) {
        if (error instanceof MachineDryRunError) throw error;
        throw new MachineDryRunError('MACHINE_READ_UNAVAILABLE');
    }

    throw new MachineDryRunError('MACHINE_READ_UNAVAILABLE');
}
