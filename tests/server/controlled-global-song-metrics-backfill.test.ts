import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    CONTROLLED_BACKFILL_DOCUMENT_CAP,
    ControlledBackfillError,
    runControlledGlobalSongMetricsBackfill,
} from '../../services/server/controlledGlobalSongMetricsBackfill.js';
import { buildGlobalSongSearchFields } from '../../utils/searchEngine.js';
import { deriveGlobalSongContentMetrics } from '../../utils/globalSongContentMetrics.js';

const validGuard = {
    authorizedSha: '38d1e7dab5cbcfdfad04c3905a658e2d6c903091',
    githubSha: '38d1e7dab5cbcfdfad04c3905a658e2d6c903091',
    githubRef: 'refs/heads/production',
    githubEnvironment: 'firebase-production',
    firebaseServiceAccount: undefined,
    firebaseServiceAccountBase64: undefined,
    firebasePrivateKey: undefined,
    firebaseClientEmail: undefined,
};

function createDb(documents: Array<Record<string, unknown>>) {
    const docs = documents.map((data, index) => ({
        id: `song-${index}`,
        ref: { id: `song-${index}` },
        data: () => data,
    }));
    const limits: number[] = [];
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    let collectionCalls = 0;
    let batchCalls = 0;
    let commitCalls = 0;

    const db: any = {
        collection(name: string) {
            collectionCalls++;
            expect(name).toBe('globalSongs');
            return {
                orderBy(field: string) {
                    expect(field).toBe('__name__');
                    return this;
                },
                limit(value: number) {
                    limits.push(value);
                    return this;
                },
                async get() {
                    return { size: Math.min(docs.length, limits[0]), docs: docs.slice(0, limits[0]) };
                },
            };
        },
        batch() {
            batchCalls++;
            const pending: Array<{ id: string; data: Record<string, unknown> }> = [];
            return {
                update(ref: { id: string }, data: Record<string, unknown>) {
                    pending.push({ id: ref.id, data });
                },
                async commit() {
                    commitCalls++;
                    updates.push(...pending);
                },
            };
        },
    };

    return {
        db,
        limits,
        updates,
        get collectionCalls() { return collectionCalls; },
        get batchCalls() { return batchCalls; },
        get commitCalls() { return commitCalls; },
    };
}

function controlledOptions(guard = validGuard) {
    return { actualProjectId: 'millionsnest', guard };
}

describe('P4.7 controlled bounded global-song metrics backfill', () => {
    it('defaults the production dispatcher to a no-write WIF authentication mode', () => {
        const dispatcher = readFileSync(
            resolve(process.cwd(), '.github/workflows/controlled-global-song-metrics-backfill.yml'),
            'utf8',
        );
        const executor = readFileSync(
            resolve(process.cwd(), '.github/workflows/controlled-global-song-metrics-backfill-executor.yml'),
            'utf8',
        );

        expect(dispatcher).toContain('default: auth_only');
        expect(dispatcher).toContain('execution_mode: ${{ inputs.execution_mode }}');
        expect(executor).toContain('gcloud auth application-default print-access-token >/dev/null');
        expect(executor).toContain("if: inputs.execution_mode == 'backfill'");
    });

    it('fails every execution guard before accessing Firestore', async () => {
        const fake = createDb([]);

        await expect(runControlledGlobalSongMetricsBackfill(fake.db, controlledOptions({
            ...validGuard,
            githubRef: 'refs/heads/main',
        }))).rejects.toEqual(new ControlledBackfillError('CONTROLLED_BACKFILL_EXECUTION_GUARD_FAILED'));

        expect(fake.collectionCalls).toBe(0);
        expect(fake.batchCalls).toBe(0);
    });

    it('rejects an unexpected document count before creating a write batch', async () => {
        const fake = createDb(Array.from({ length: CONTROLLED_BACKFILL_DOCUMENT_CAP + 1 }, () => ({ title: 'Song' })));

        await expect(runControlledGlobalSongMetricsBackfill(fake.db, controlledOptions()))
            .rejects.toEqual(new ControlledBackfillError('CONTROLLED_BACKFILL_DOCUMENT_BOUND_FAILED'));

        expect(fake.limits).toEqual([CONTROLLED_BACKFILL_DOCUMENT_CAP + 1]);
        expect(fake.batchCalls).toBe(0);
        expect(fake.commitCalls).toBe(0);
    });

    it('writes only canonical deltas after validating the exact 114-document bound', async () => {
        const convergedSource = { title: 'Converged', chords: '' };
        const converged = {
            ...convergedSource,
            normalizedTitle: 'converged',
            ...buildGlobalSongSearchFields(convergedSource),
            ...deriveGlobalSongContentMetrics(convergedSource),
        };
        const fake = createDb([
            { title: 'Needs normalization' },
            ...Array.from({ length: CONTROLLED_BACKFILL_DOCUMENT_CAP - 1 }, () => converged),
        ]);

        await expect(runControlledGlobalSongMetricsBackfill(fake.db, controlledOptions())).resolves.toMatchObject({
            expectedDocuments: 114,
            documentCap: 114,
            writeCap: 114,
            scanned: 114,
            updated: 1,
            writes: 1,
            idempotent: false,
            errors: [],
        });
        expect(fake.limits).toEqual([115]);
        expect(fake.batchCalls).toBe(1);
        expect(fake.commitCalls).toBe(1);
        expect(fake.updates).toHaveLength(1);
    });

    it('is idempotent when the reviewed 114-document snapshot is converged', async () => {
        const fake = createDb(Array.from({ length: CONTROLLED_BACKFILL_DOCUMENT_CAP }, () => ({
            title: '',
            normalizedTitle: '',
            searchVersion: 3,
            searchTokens: [],
            searchContentTokens: [],
            searchTitlePrefixes: [],
            searchArtistPrefixes: [],
            searchTitleGrams: [],
            searchArtistGrams: [],
            searchKeyTokens: [],
            hasChords: false,
            hasLyrics: false,
            isComplete: false,
        })));

        await expect(runControlledGlobalSongMetricsBackfill(fake.db, controlledOptions()))
            .resolves.toMatchObject({ updated: 0, writes: 0, idempotent: true });
        expect(fake.batchCalls).toBe(0);
        expect(fake.commitCalls).toBe(0);
    });
});
