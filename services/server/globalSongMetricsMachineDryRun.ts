import { analyzeGlobalSongBackfillDocument, type GlobalSongCanonicalDelta } from './globalSongBackfillAnalysis.js';

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
    now?: () => number;
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

interface DeltaCounters {
    documents: number;
    missingFields: Record<string, number>;
    mismatchedFields: Record<string, number>;
}

function createDeltaCounters(): DeltaCounters {
    return { documents: 0, missingFields: {}, mismatchedFields: {} };
}

function incrementFields(target: Record<string, number>, fields: string[]): void {
    for (const field of fields) target[field] = (target[field] || 0) + 1;
}

function accumulateDelta(target: DeltaCounters, delta: GlobalSongCanonicalDelta): void {
    if (Object.keys(delta.updates).length === 0) return;
    target.documents++;
    incrementFields(target.missingFields, delta.missingFields);
    incrementFields(target.mismatchedFields, delta.mismatchedFields);
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

    const now = options.now || Date.now;
    const startedAt = now();
    const pageSize = normalizeBoundedInteger(options.pageSize, 200, 200);
    const maxPages = normalizeBoundedInteger(options.maxPages, 1000, 1000);
    let query = db.collection('globalSongs').orderBy('__name__').limit(pageSize);
    let processed = 0;
    let converged = 0;
    let divergent = 0;
    let pages = 0;
    let lastCursor: string | undefined;
    const deltas = {
        normalized: createDeltaCounters(),
        search: createDeltaCounters(),
        contentMetrics: createDeltaCounters(),
    };

    const result = (truncated: boolean) => ({
        total: processed,
        processed,
        pages,
        pageSize,
        converged,
        divergent,
        deltas,
        estimatedWrites: divergent,
        estimatedReads: processed,
        durationMs: Math.max(0, now() - startedAt),
        errors: [] as string[],
        truncated,
        ...(lastCursor ? { lastCursor } : {}),
    });

    try {
        for (let page = 0; page < maxPages; page++) {
            const snapshot = await query.get();
            pages++;

            if (snapshot.empty) {
                return result(false);
            }

            for (const doc of snapshot.docs) {
                processed++;
                const analysis = analyzeGlobalSongBackfillDocument(doc.data());
                if (analysis.requiresUpdate) divergent++;
                else converged++;
                accumulateDelta(deltas.normalized, analysis.normalized);
                accumulateDelta(deltas.search, analysis.search);
                accumulateDelta(deltas.contentMetrics, analysis.contentMetrics);
            }

            const lastDoc = snapshot.docs[snapshot.docs.length - 1];
            lastCursor = lastDoc.id;
            if (snapshot.size < pageSize) {
                return result(false);
            }

            if (page + 1 === maxPages) {
                return result(true);
            }

            query = db.collection('globalSongs').orderBy('__name__').startAfter(lastDoc).limit(pageSize);
        }
    } catch (error) {
        if (error instanceof MachineDryRunError) throw error;
        throw new MachineDryRunError('MACHINE_READ_UNAVAILABLE');
    }

    throw new MachineDryRunError('MACHINE_READ_UNAVAILABLE');
}
