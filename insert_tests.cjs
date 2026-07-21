const fs = require('fs');
let code = fs.readFileSync('tests/server/curation-approval-service.test.ts', 'utf8');

const tests = `
    it('12.1. uid numérico', async () => {
        await expect(service.approve({
            ...defaultParams,
            decodedToken: { uid: 123 as any, hasCurationAccess: true }
        })).rejects.toMatchObject({ code: 'ACTOR_CONTEXT_MISSING' });
    });

    it('12.2. uid objeto', async () => {
        await expect(service.approve({
            ...defaultParams,
            decodedToken: { uid: {} as any, hasCurationAccess: true }
        })).rejects.toMatchObject({ code: 'ACTOR_CONTEXT_MISSING' });
    });

    it('12.3. uid somente com espaços', async () => {
        await expect(service.approve({
            ...defaultParams,
            decodedToken: { uid: '   ', hasCurationAccess: true }
        })).rejects.toMatchObject({ code: 'ACTOR_CONTEXT_MISSING' });
    });

    it('12.4. normalizedTitle numérico', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 123 } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.5. normalizedTitle objeto', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: {} } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.6. contentFingerprint objeto', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', contentFingerprint: {} } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.7. lyricsFingerprint array', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', lyricsFingerprint: [] } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.8. snapshot.title numérico', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 123 } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'OCCURRENCE_SNAPSHOT_INVALID' });
    });

    it('12.9. source.organizationId numérico', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' }, source: { organizationId: 123 } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'OCCURRENCE_SNAPSHOT_INVALID' });
    });

    it('12.10. source.songId objeto', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' }, source: { organizationId: 'org1', songId: {} } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'OCCURRENCE_SNAPSHOT_INVALID' });
    });

    it('12.11. externalReferences array', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', externalReferences: [] } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.12. normalizedArtists não array', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', normalizedArtists: 'artist' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });
`;

const insertIndex = code.lastIndexOf("});");
code = code.slice(0, insertIndex) + tests + code.slice(insertIndex);
fs.writeFileSync('tests/server/curation-approval-service.test.ts', code);
