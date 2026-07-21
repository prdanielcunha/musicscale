const fs = require('fs');
let code = fs.readFileSync('tests/server/curation-approval-service.test.ts', 'utf8');

const malformedTests = `
    test('12.1. uid numérico', async () => {
        await expect(service.approve({
            ...defaultParams,
            decodedToken: { uid: 123 as any, hasCurationAccess: true }
        })).rejects.toMatchObject({ code: 'ACTOR_CONTEXT_MISSING' });
    });

    test('12.2. uid objeto', async () => {
        await expect(service.approve({
            ...defaultParams,
            decodedToken: { uid: {} as any, hasCurationAccess: true }
        })).rejects.toMatchObject({ code: 'ACTOR_CONTEXT_MISSING' });
    });

    test('12.3. uid somente com espaços', async () => {
        await expect(service.approve({
            ...defaultParams,
            decodedToken: { uid: '   ', hasCurationAccess: true }
        })).rejects.toMatchObject({ code: 'ACTOR_CONTEXT_MISSING' });
    });

    test('12.4. normalizedTitle numérico', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 123 } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    test('12.5. normalizedTitle objeto', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: {} } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    test('12.6. contentFingerprint objeto', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', contentFingerprint: {} } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await expect(service.approve(defaultParams)).resolves.toMatchObject({ success: true }); // It shouldn't crash with TypeError, it might ignore or fail cleanly, let's just ensure it doesn't throw TypeError. Wait, requirement 7 says "Todos devem retornar CurationError conhecido." Ah, if it's ignored, it doesn't throw CurationError? But wait, "Valores numéricos, arrays, objetos e booleanos devem produzir CurationError conhecido, nunca TypeError." 
        // Wait, if it ignores, it's fine, but maybe it should throw? 
`;
// Let me write a script that injects these tests inside describe('CurationApprovalService', () => { ...
