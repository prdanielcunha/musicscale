import { getCandidateOrganizationIds, isValidCanonicalResponse } from './services/ecosystem/startupFastPath';
import * as fs from 'fs';
import * as path from 'path';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function runTests() {
    console.log("Running MS-PERF-4B-FIX-1 tests...");

    // 1. ordem e deduplicação dos candidatos;
    const candidates = getCandidateOrganizationIds('local_org', 'active_org', 'local_org', null);
    assert(candidates.length === 2, "Should remove duplicates and empty values");
    assert(candidates[0] === 'local_org', "Should preserve precedence (local first)");
    assert(candidates[1] === 'active_org', "Should preserve precedence (active second)");

    // 2. ausência total de candidatos;
    const emptyCandidates = getCandidateOrganizationIds('', null, undefined, '  ');
    assert(emptyCandidates.length === 0, "Should ignore empty candidates");

    // 3. resposta canônica exata válida;
    const validRes = {
        success: true,
        uid: 'user123',
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(validRes, 'user123', 'org123') === true, "Valid response should be accepted");

    // 4. resposta válida usando effectiveContext;
    const validResWithCtx = {
        success: true,
        effectiveContext: {
            userId: 'user123',
            organizationId: 'org123'
        }
    };
    assert(isValidCanonicalResponse(validResWithCtx, 'user123', 'org123') === true, "Valid response with effectiveContext should be accepted");

    // 5. success false rejeitado;
    const invalidSuccess = {
        success: false,
        uid: 'user123',
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(invalidSuccess, 'user123', 'org123') === false, "Success false should be rejected");

    // 6. success true sem UID rejeitado;
    const noUidRes = {
        success: true,
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(noUidRes, 'user123', 'org123') === false, "Success true without UID rejected");

    // 7. success true sem organizationId rejeitado;
    const noOrgRes = {
        success: true,
        uid: 'user123'
    };
    assert(isValidCanonicalResponse(noOrgRes, 'user123', 'org123') === false, "Success true without OrgID rejected");

    // 8. UID divergente rejeitado;
    const diffUidRes = {
        success: true,
        uid: 'otherUser',
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(diffUidRes, 'user123', 'org123') === false, "Different UID should be rejected");

    // 9. organização divergente rejeitada;
    const diffOrgRes = {
        success: true,
        uid: 'user123',
        organizationId: 'otherOrg'
    };
    assert(isValidCanonicalResponse(diffOrgRes, 'user123', 'org123') === false, "Different OrgID should be rejected");

    // 10. UID conflitante entre raiz e effectiveContext rejeitado;
    const conflictUidRes = {
        success: true,
        uid: 'user123',
        effectiveContext: {
            userId: 'otherUser',
            organizationId: 'org123'
        }
    };
    assert(isValidCanonicalResponse(conflictUidRes, 'user123', 'org123') === false, "Conflicting UID should be rejected");

    // 11. organização conflitante entre raiz e effectiveContext rejeitada;
    const conflictOrgRes = {
        success: true,
        uid: 'user123',
        organizationId: 'org123',
        effectiveContext: {
            userId: 'user123',
            organizationId: 'otherOrg'
        }
    };
    assert(isValidCanonicalResponse(conflictOrgRes, 'user123', 'org123') === false, "Conflicting OrgID should be rejected");

    // 12. UID e organização vazios rejeitados;
    const emptyFieldsRes = {
        success: true,
        uid: '',
        organizationId: ''
    };
    assert(isValidCanonicalResponse(emptyFieldsRes, 'user123', 'org123') === false, "Empty fields should be rejected");

    // 13. payload null ou malformado rejeitado.
    assert(isValidCanonicalResponse(null, 'user123', 'org123') === false, "Null payload rejected");
    assert(isValidCanonicalResponse({}, 'user123', 'org123') === false, "Malformed payload rejected");


    // Executable checks on EcosystemContext.tsx
    const contextFile = fs.readFileSync(path.join(process.cwd(), 'contexts/EcosystemContext.tsx'), 'utf-8');
    
    // - não existe buildEffectiveAccessContext aplicado a parsed/cache;
    assert(!contextFile.includes('buildEffectiveAccessContext(user.uid, parsed.currentOrganizationId'), "Should not apply buildEffectiveAccessContext to parsed cache");
    
    // - não existe buildEffectiveAccessContext aplicado ao offlineDefault;
    assert(!contextFile.includes('buildEffectiveAccessContext(user.uid, offlineDefault.currentOrganizationId'), "Should not apply buildEffectiveAccessContext to offlineDefault");
    
    // - o fallback offline não usa papel owner;
    assert(contextFile.includes("roleInCurrentOrganization: 'none'") || !contextFile.includes("roleInCurrentOrganization: 'owner'"), "Offline fallback should not use owner role");
    assert(contextFile.includes("ecosystemRole: 'none'") || !contextFile.includes("ecosystemRole: isCeoFallback ? 'ceo' : 'user'"), "Offline fallback should not use ceo/user role");
    
    // - existe timeout de 5.000 ms no early fetch;
    assert(contextFile.includes('setTimeout(() => earlyAbortController?.abort(), 5000)'), "Early fetch must have 5000ms timeout");
    
    // - não existe currentGeneration = Symbol() sem uso;
    assert(!contextFile.includes('const currentGeneration = Symbol()'), "Should not use unused Symbol generation");
    
    // - não existe getIdToken(true).
    assert(!contextFile.includes('getIdToken(true)'), "Should not use getIdToken(true)");

    // test presence of real generation
    assert(contextFile.includes('let activeGeneration = 0;'), "Must have real activeGeneration counter");
    assert(contextFile.includes('const currentGeneration = ++activeGeneration;'), "Must increment generation");

    console.log("All MS-PERF-4B-FIX-1 tests passed.");
}

runTests();

