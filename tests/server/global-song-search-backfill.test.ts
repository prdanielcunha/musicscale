import { describe, expect, it } from 'vitest';
import { backfillGlobalSongs } from '../../services/server/globalSongsBackfill.js';
import { buildGlobalSongSearchFields } from '../../utils/searchEngine.js';
import { normalizeBaseText } from '../../utils/songDiscovery/textNormalization.js';

function createDb(fixtures: Array<{ id: string; data: Record<string, any> }>) {
    const docs = fixtures.map((fixture) => ({
        id: fixture.id,
        ref: { id: fixture.id },
        data: () => fixture.data,
    }));
    const updates: Array<{ id: string; data: Record<string, any> }> = [];
    const limits: number[] = [];
    const cursors: string[] = [];
    let getCount = 0;
    let commitCount = 0;

    const makeQuery = (cursorId?: string, requestedLimit = docs.length) => ({
        orderBy(field: string) {
            expect(field).toBe('__name__');
            return makeQuery(cursorId, requestedLimit);
        },
        startAfter(lastDoc: any) {
            cursors.push(lastDoc.id);
            return makeQuery(lastDoc.id, requestedLimit);
        },
        limit(value: number) {
            limits.push(value);
            return makeQuery(cursorId, value);
        },
        async get() {
            getCount++;
            const startIndex = cursorId
                ? Math.max(0, docs.findIndex((doc) => doc.id === cursorId) + 1)
                : 0;
            const page = docs.slice(startIndex, startIndex + requestedLimit);
            return {
                empty: page.length === 0,
                size: page.length,
                docs: page,
            };
        },
    });

    const db: any = {
        collection(name: string) {
            expect(name).toBe('globalSongs');
            return makeQuery();
        },
        batch() {
            const pending: Array<{ id: string; data: Record<string, any> }> = [];
            return {
                update(ref: any, data: Record<string, any>) {
                    pending.push({ id: ref.id, data });
                },
                async commit() {
                    commitCount++;
                    updates.push(...pending);
                },
            };
        },
    };

    return {
        db,
        updates,
        limits,
        cursors,
        get getCount() { return getCount; },
        get commitCount() { return commitCount; },
    };
}

describe('P4 globalSongs search v3 backfill', () => {
    it('adds canonical v3 search fields and preserves content beyond the legacy 150-token cap', async () => {
        const uniqueTokens = Array.from({ length: 151 }, (_, index) => `palavra${index}`);
        const lyrics = [...uniqueTokens, 'muralhas'].join(' ');
        const fake = createDb([{
            id: 'song-a',
            data: {
                title: 'Águas de Março',
                artist: 'JOÃO',
                lyrics,
                chords: 'C G\nPorque Ele vive',
                key: 'E',
            },
        }]);

        const result = await backfillGlobalSongs(fake.db);

        expect(result).toEqual({
            processed: 1,
            updated: 1,
            normalizedUpdated: 1,
            searchUpdated: 1,
        });
        expect(fake.updates).toHaveLength(1);
        expect(fake.updates[0].data.searchVersion).toBe(3);
        expect(fake.updates[0].data.searchContentTokens).toContain('muralhas');
        expect(fake.updates[0].data.searchContentTokens).toContain('porque');
        expect(fake.updates[0].data.searchContentTokens).not.toContain('c');
        expect(fake.updates[0].data.searchTokens).toHaveLength(150);
        expect(fake.updates[0].data.searchTokens).not.toContain('muralhas');
        expect(fake.updates[0].data.normalizedTitle).toBe(normalizeBaseText('Águas de Março'));
        expect(fake.limits[0]).toBe(200);
    });

    it('does not write an already converged canonical document', async () => {
        const song = {
            title: 'Amazing Grace',
            artist: 'Artist',
            lyrics: 'Amazing grace how sweet the sound',
            normalizedTitle: normalizeBaseText('Amazing Grace'),
            normalizedArtists: [normalizeBaseText('Artist')],
        };
        const canonical = buildGlobalSongSearchFields(song);
        const fake = createDb([{ id: 'song-b', data: { ...song, ...canonical } }]);

        const result = await backfillGlobalSongs(fake.db);

        expect(result).toEqual({
            processed: 1,
            updated: 0,
            normalizedUpdated: 0,
            searchUpdated: 0,
        });
        expect(fake.updates).toHaveLength(0);
        expect(fake.commitCount).toBe(0);
    });

    it('paginates through the collection in bounded pages of 200', async () => {
        const fixtures = Array.from({ length: 201 }, (_, index) => ({
            id: `song-${String(index).padStart(3, '0')}`,
            data: { title: `Song ${index}`, artist: 'Artist', lyrics: `word${index}` },
        }));
        const fake = createDb(fixtures);

        const result = await backfillGlobalSongs(fake.db);

        expect(result.processed).toBe(201);
        expect(result.updated).toBe(201);
        expect(fake.getCount).toBe(2);
        expect(fake.cursors).toEqual(['song-199']);
        expect(fake.limits.filter((value) => value === 200).length).toBeGreaterThanOrEqual(2);
        expect(fake.commitCount).toBe(2);
    });
});
