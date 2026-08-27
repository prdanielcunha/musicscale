import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    MachineDryRunError,
    runGlobalSongMetricsMachineDryRun,
} from '../../services/server/globalSongMetricsMachineDryRun.js';
import { buildGlobalSongSearchFields } from '../../utils/searchEngine.js';
import { normalizeBaseText } from '../../utils/songDiscovery/textNormalization.js';
import { deriveGlobalSongContentMetrics } from '../../utils/globalSongContentMetrics.js';

function createReadOnlyDb(fixtures: Array<{ id: string; data: Record<string, unknown> }>) {
    const docs = fixtures.map((fixture) => ({
        id: fixture.id,
        data: () => fixture.data,
    }));
    const limits: number[] = [];
    const cursors: string[] = [];
    let collectionCalls = 0;
    let readCalls = 0;

    const makeQuery = (cursorId?: string, requestedLimit = docs.length): any => ({
        orderBy(field: string) {
            expect(field).toBe('__name__');
            return makeQuery(cursorId, requestedLimit);
        },
        startAfter(lastDoc: { id: string }) {
            cursors.push(lastDoc.id);
            return makeQuery(lastDoc.id, requestedLimit);
        },
        limit(value: number) {
            limits.push(value);
            return makeQuery(cursorId, value);
        },
        async get() {
            readCalls++;
            const start = cursorId ? docs.findIndex((doc) => doc.id === cursorId) + 1 : 0;
            const page = docs.slice(start, start + requestedLimit);
            return { empty: page.length === 0, size: page.length, docs: page };
        },
    });

    return {
        db: {
            collection(name: string) {
                collectionCalls++;
                expect(name).toBe('globalSongs');
                return makeQuery();
            },
        },
        limits,
        cursors,
        get collectionCalls() { return collectionCalls; },
        get readCalls() { return readCalls; },
    };
}

describe('P4.7 machine-auth global song metrics dry-run', () => {
    it('aborts on project mismatch before accessing Firestore', async () => {
        const fake = createReadOnlyDb([]);

        await expect(runGlobalSongMetricsMachineDryRun(fake.db, {
            actualProjectId: 'another-project',
        })).rejects.toMatchObject({ code: 'MACHINE_PROJECT_MISMATCH' });

        expect(fake.collectionCalls).toBe(0);
    });

    it('only reads, while reporting converged, divergent, and canonical delta counters', async () => {
        const convergedSource = {
            title: 'Amazing Grace',
            artist: 'John Newton',
            chords: 'C G',
            lyrics: 'Amazing grace',
        };
        const converged = {
            ...convergedSource,
            normalizedTitle: normalizeBaseText(convergedSource.title),
            normalizedArtists: [normalizeBaseText(convergedSource.artist)],
            ...buildGlobalSongSearchFields(convergedSource),
            ...deriveGlobalSongContentMetrics(convergedSource),
        };
        const fake = createReadOnlyDb([
            { id: 'converged', data: converged },
            { id: 'divergent', data: { chords: '', lyrics: 'Lyrics only', hasChords: true } },
        ]);

        const result = await runGlobalSongMetricsMachineDryRun(fake.db, {
            actualProjectId: 'millionsnest',
            now: () => 100,
        });
        expect(result).toMatchObject({
            total: 2,
            processed: 2,
            pages: 1,
            pageSize: 200,
            converged: 1,
            divergent: 1,
            estimatedReads: 2,
            estimatedWrites: 1,
            durationMs: 0,
            errors: [],
            truncated: false,
            lastCursor: 'divergent',
        });

        expect(result.deltas).toEqual({
            normalized: {
                documents: 1,
                missingFields: { normalizedTitle: 1 },
                mismatchedFields: {},
            },
            search: {
                documents: 1,
                missingFields: {
                    searchVersion: 1,
                    searchTokens: 1,
                    searchContentTokens: 1,
                    searchTitlePrefixes: 1,
                    searchArtistPrefixes: 1,
                    searchTitleGrams: 1,
                    searchArtistGrams: 1,
                    searchKeyTokens: 1,
                },
                mismatchedFields: {},
            },
            contentMetrics: {
                documents: 1,
                missingFields: { hasLyrics: 1, isComplete: 1 },
                mismatchedFields: { hasChords: 1 },
            },
        });

        const source = readFileSync('services/server/globalSongMetricsMachineDryRun.ts', 'utf8');
        expect(source).not.toMatch(/\.(?:batch|commit|set|update|delete|create|transaction|bulkWriter)\s*\(/);
    });

    it('uses bounded pages, advances its cursor, and keeps counters across pages', async () => {
        const fake = createReadOnlyDb(Array.from({ length: 3 }, (_, index) => ({
            id: `song-${index + 1}`,
            data: { chords: '', lyrics: `Lyrics ${index + 1}` },
        })));

        await expect(runGlobalSongMetricsMachineDryRun(fake.db, {
            actualProjectId: 'millionsnest',
            pageSize: 2,
            maxPages: 2,
            now: () => 100,
        })).resolves.toMatchObject({
            total: 3,
            processed: 3,
            pages: 2,
            pageSize: 2,
            converged: 0,
            divergent: 3,
            estimatedReads: 3,
            estimatedWrites: 3,
            durationMs: 0,
            errors: [],
            truncated: false,
            lastCursor: 'song-3',
        });

        expect(fake.limits).toEqual([2, 2]);
        expect(fake.cursors).toEqual(['song-2']);
        expect(fake.readCalls).toBe(2);
    });

    it('returns a safe credential failure without the provider error details', async () => {
        const credentialDetail = 'credential source should never reach logs';
        const db = {
            collection: () => ({
                orderBy: () => ({
                    limit: () => ({
                        get: async () => { throw new Error(credentialDetail); },
                    }),
                }),
            }),
        };

        await expect(runGlobalSongMetricsMachineDryRun(db as any, {
            actualProjectId: 'millionsnest',
        })).rejects.toEqual(new MachineDryRunError('MACHINE_READ_UNAVAILABLE'));
    });
});
