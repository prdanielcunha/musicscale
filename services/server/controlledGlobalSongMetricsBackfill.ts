import { analyzeGlobalSongBackfillDocument } from './globalSongBackfillAnalysis.js';

export const CONTROLLED_BACKFILL_PROJECT_ID = 'millionsnest';
export const CONTROLLED_BACKFILL_DOCUMENT_CAP = 114;
export const CONTROLLED_BACKFILL_WRITE_CAP = 114;
export const CONTROLLED_BACKFILL_REF = 'refs/heads/production';
export const CONTROLLED_BACKFILL_ENVIRONMENT = 'firebase-production';

export type ControlledBackfillErrorCode =
    | 'CONTROLLED_BACKFILL_PROJECT_MISMATCH'
    | 'CONTROLLED_BACKFILL_EXECUTION_GUARD_FAILED'
    | 'CONTROLLED_BACKFILL_CREDENTIAL_GUARD_FAILED'
    | 'CONTROLLED_BACKFILL_DOCUMENT_BOUND_FAILED'
    | 'CONTROLLED_BACKFILL_WRITE_BOUND_FAILED'
    | 'CONTROLLED_BACKFILL_UNAVAILABLE';

/** A deliberately non-diagnostic error that is safe for operational logs. */
export class ControlledBackfillError extends Error {
    constructor(public readonly code: ControlledBackfillErrorCode) {
        super(code);
        this.name = 'ControlledBackfillError';
    }
}

interface DocumentLike {
    id: string;
    ref: unknown;
    data(): Record<string, unknown>;
}

interface QuerySnapshotLike {
    size: number;
    docs: DocumentLike[];
}

interface QueryLike {
    orderBy(field: string): QueryLike;
    limit(value: number): QueryLike;
    get(): Promise<QuerySnapshotLike>;
}

interface WriteBatchLike {
    update(ref: unknown, data: Record<string, unknown>): void;
    commit(): Promise<unknown>;
}

interface ControlledBackfillFirestoreLike {
    collection(name: string): QueryLike;
    batch(): WriteBatchLike;
}

export interface ControlledBackfillExecutionGuard {
    authorizedSha: string | undefined;
    githubSha: string | undefined;
    githubRef: string | undefined;
    githubEnvironment: string | undefined;
    firebaseServiceAccount: string | undefined;
    firebaseServiceAccountBase64: string | undefined;
    firebasePrivateKey: string | undefined;
    firebaseClientEmail: string | undefined;
}

export interface ControlledGlobalSongMetricsBackfillOptions {
    actualProjectId: string | undefined;
    guard: ControlledBackfillExecutionGuard;
    expectedProjectId?: string;
}

function isCommitSha(value: string | undefined): value is string {
    return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);
}

/**
 * Validates every execution condition before Firestore is even queried. The
 * workflow also verifies checkout, but keeping this guard in code protects
 * against an accidental script invocation outside that workflow.
 */
export function assertControlledBackfillExecutionGuard(
    guard: ControlledBackfillExecutionGuard,
): void {
    if (!isCommitSha(guard.authorizedSha)
        || guard.authorizedSha !== guard.githubSha
        || guard.githubRef !== CONTROLLED_BACKFILL_REF
        || guard.githubEnvironment !== CONTROLLED_BACKFILL_ENVIRONMENT) {
        throw new ControlledBackfillError('CONTROLLED_BACKFILL_EXECUTION_GUARD_FAILED');
    }

    if (guard.firebaseServiceAccount
        || guard.firebaseServiceAccountBase64
        || guard.firebasePrivateKey
        || guard.firebaseClientEmail) {
        throw new ControlledBackfillError('CONTROLLED_BACKFILL_CREDENTIAL_GUARD_FAILED');
    }
}

/**
 * A one-shot P4.7 migration for the reviewed 114-document snapshot. It reads
 * a 115th document to prove the hard document limit before it creates a batch,
 * then prepares every update before committing at most one bounded batch.
 */
export async function runControlledGlobalSongMetricsBackfill(
    db: ControlledBackfillFirestoreLike,
    options: ControlledGlobalSongMetricsBackfillOptions,
) {
    const expectedProjectId = options.expectedProjectId || CONTROLLED_BACKFILL_PROJECT_ID;
    if (options.actualProjectId !== expectedProjectId) {
        throw new ControlledBackfillError('CONTROLLED_BACKFILL_PROJECT_MISMATCH');
    }
    assertControlledBackfillExecutionGuard(options.guard);

    try {
        // Reading one item beyond the cap makes a collection growth abort before
        // the first write, rather than silently processing a partial data set.
        const snapshot = await db.collection('globalSongs')
            .orderBy('__name__')
            .limit(CONTROLLED_BACKFILL_DOCUMENT_CAP + 1)
            .get();

        if (snapshot.size !== CONTROLLED_BACKFILL_DOCUMENT_CAP) {
            throw new ControlledBackfillError('CONTROLLED_BACKFILL_DOCUMENT_BOUND_FAILED');
        }

        const updates = snapshot.docs.flatMap((doc) => {
            const analysis = analyzeGlobalSongBackfillDocument(doc.data());
            return analysis.requiresUpdate ? [{ ref: doc.ref, updates: analysis.updates }] : [];
        });

        if (updates.length > CONTROLLED_BACKFILL_WRITE_CAP) {
            throw new ControlledBackfillError('CONTROLLED_BACKFILL_WRITE_BOUND_FAILED');
        }

        if (updates.length > 0) {
            // All bounds and all canonical deltas are verified before the batch
            // exists. A single commit makes the result observable and retry-safe.
            const batch = db.batch();
            for (const update of updates) batch.update(update.ref, update.updates);
            await batch.commit();
        }

        return {
            authorizedSha: options.guard.authorizedSha,
            expectedDocuments: CONTROLLED_BACKFILL_DOCUMENT_CAP,
            documentCap: CONTROLLED_BACKFILL_DOCUMENT_CAP,
            writeCap: CONTROLLED_BACKFILL_WRITE_CAP,
            scanned: snapshot.size,
            updated: updates.length,
            writes: updates.length,
            idempotent: updates.length === 0,
            errors: [] as string[],
        };
    } catch (error) {
        if (error instanceof ControlledBackfillError) throw error;
        throw new ControlledBackfillError('CONTROLLED_BACKFILL_UNAVAILABLE');
    }
}
