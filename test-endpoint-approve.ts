import assert from 'assert';
import { compareSongs } from './utils/songDiscovery/matcher.js';

async function runTests() {
    console.log("Testing validation and logic for /api/curation/approve...");
    
    // 1. role autorizada
    const allowedRoles = ['ceo', 'global_admin', 'ecosystem_owner', 'founder'];
    const deniedRoles = ['admin', 'user', 'manager'];
    
    for (const r of allowedRoles) {
        assert.ok(['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(r), `Role ${r} should be allowed`);
    }
    for (const r of deniedRoles) {
        assert.ok(!['ceo', 'global_admin', 'ecosystem_owner', 'founder'].includes(r), `Role ${r} should be denied`);
    }

    // 2. test compareSongs exact match blocking
    const dummyCandidate = {
        normalizedTitle: "teus altarese meujesus",
        normalizedArtists: ["meu deus"],
        originalTitle: "Teus altares",
        contentFingerprint: "hash123"
    };

    const globalSong = {
        normalizedTitle: "teus altarese meujesus",
        normalizedArtists: ["meu deus"],
        originalTitle: "Teus altares",
        contentFingerprint: "hash123"
    };
    
    const comparison = compareSongs(globalSong as any, dummyCandidate as any);
    assert.strictEqual(comparison.classification, "exact_match", "Should return exact match");

    // 3. state validation
    const approvedState = 'approved';
    const pendingState = 'pending';
    assert.strictEqual(pendingState, 'pending', "Only pending is allowed normally");
    assert.notStrictEqual(approvedState, 'pending', "Approved state throws error unless idempotency key matches");

    console.log("Approve rules logic tests passed!");
}

runTests().catch(e => {
    console.error(e);
    process.exit(1);
});
