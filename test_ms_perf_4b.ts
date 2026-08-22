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
    // FIX-2 TEST CASES
    // 1. uid vazio na raiz + UID válido no effectiveContext deve ser rejeitado;
    const emptyUidWithCtx = {
        success: true,
        uid: '',
        organizationId: 'org123',
        effectiveContext: { userId: 'user123' }
    };
    assert(isValidCanonicalResponse(emptyUidWithCtx, 'user123', 'org123') === false, "Empty UID in root with valid ctx should be rejected");
    // 2. organizationId vazio na raiz + organização válida no effectiveContext deve ser rejeitado;
    const emptyOrgWithCtx = {
        success: true,
        uid: 'user123',
        organizationId: '',
        effectiveContext: { organizationId: 'org123' }
    };
    assert(isValidCanonicalResponse(emptyOrgWithCtx, 'user123', 'org123') === false, "Empty OrgID in root with valid ctx should be rejected");
    // 3. UID contendo somente espaços deve ser rejeitado;
    const spacesUid = { success: true, uid: '   ', organizationId: 'org123' };
    assert(isValidCanonicalResponse(spacesUid, '   ', 'org123') === false, "Spaces UID should be rejected");
    // 4. organização contendo somente espaços deve ser rejeitada;
    const spacesOrg = { success: true, uid: 'user123', organizationId: '   ' };
    assert(isValidCanonicalResponse(spacesOrg, 'user123', '   ') === false, "Spaces OrgID should be rejected");
    // 5. UID null deve ser rejeitado;
    const nullUid = { success: true, uid: null, organizationId: 'org123' };
    assert(isValidCanonicalResponse(nullUid, 'user123', 'org123') === false, "Null UID should be rejected");
    // 6. organizationId null deve ser rejeitado;
    const nullOrg = { success: true, uid: 'user123', organizationId: null };
    assert(isValidCanonicalResponse(nullOrg, 'user123', 'org123') === false, "Null OrgID should be rejected");
    // 7. UID numérico deve ser rejeitado;
    const numUid = { success: true, uid: 123, organizationId: 'org123' };
    assert(isValidCanonicalResponse(numUid, '123', 'org123') === false, "Numeric UID should be rejected");
    // 8. organizationId numérico deve ser rejeitado;
    const numOrg = { success: true, uid: 'user123', organizationId: 123 };
    assert(isValidCanonicalResponse(numOrg, 'user123', '123') === false, "Numeric OrgID should be rejected");
    // 9. resposta totalmente válida deve continuar aceita;
    const validFullRes = {
        success: true,
        uid: 'user123',
        organizationId: 'org123',
        effectiveContext: {
            userId: 'user123',
            organizationId: 'org123'
        }
    };
    assert(isValidCanonicalResponse(validFullRes, 'user123', 'org123') === true, "Fully valid response should be accepted");
    // 10. cache sanitizado deve usar exclusivamente o contrato explícito do helper dedicado;
    const sanitizedHelperMatch = contextFile.match(
        /const getSanitizedContextCache\s*=\s*\([^)]*\)\s*=>\s*\(\{([\s\S]*?)\n\}\);/
    );
    assert(sanitizedHelperMatch !== null, "Dedicated getSanitizedContextCache helper must exist");
    const sanitizedHelperBody = sanitizedHelperMatch![1];
    const sanitizedFields = Array.from(
        sanitizedHelperBody.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*:/gm),
        match => match[1]
    );
    const approvedSanitizedFields = [
        'uid',
        'displayName',
        'ecosystemRole',
        'currentOrganizationId',
        'currentOrganizationName',
        'roleInCurrentOrganization',
        'plan',
        'subscriptionStatus',
        'organizationsAvailable'
    ];
    assert(
        JSON.stringify(sanitizedFields) === JSON.stringify(approvedSanitizedFields),
        "Sanitized cache helper must contain only the approved cache fields"
    );
    for (const forbiddenField of [
        'token', 'serverContext', 'effectiveContext', 'permissions',
        'entitlements', 'capabilities', 'canonicalContext', 'rawCanonicalResponse'
    ]) {
        assert(
            !new RegExp(`\\b${forbiddenField}\\b`).test(sanitizedHelperBody),
            `Sanitized cache helper cannot include ${forbiddenField}`
        );
    }
    assert(
        /const cachePayload\s*=\s*getSanitizedContextCache\s*\(\{[\s\S]*?\}\);[\s\S]*?localStorage\.setItem\('musicscale_cached_context_' \+ user\.uid, JSON\.stringify\(cachePayload\)\)/.test(contextFile),
        "Bootstrap cache persistence must use getSanitizedContextCache"
    );
    assert(
        /`musicscale_cached_context_\$\{expectedUid\}`,[\s\S]*?JSON\.stringify\(getSanitizedContextCache\(nextContext\)\)/.test(contextFile),
        "Canonical organization switch cache persistence must use getSanitizedContextCache"
    );
    // 11. restauração offline deve negar contexto e permissões de runtime;
    assert(
        /\.\.\.parsed,[\s\S]{0,300}?serverContext:\s*null,[\s\S]{0,200}?permissions:\s*DENIED_PERMISSIONS/.test(contextFile),
        "Cache restore must explicitly clear serverContext and deny permissions"
    );
    // 12. localStorage.setItem deve estar protegido pela geração ativa;
    assert(contextFile.includes("if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid && orgId && orgId !== 'offline_default') {") && contextFile.includes("localStorage.setItem('musicscale_cached_context_' + user.uid"), "localStorage.setItem must be protected by active generation and conditions");
    // 13. incremento da geração deve ocorrer antes de if (user);
    assert(!!contextFile.match(/const currentGeneration = \+\+activeGeneration;\s*if\s*\(user\)/), "Generation must be incremented before if (user)");
    // 14. earlyCanonicalPromise deve limpar timeout em todos os caminhos;
    assert(contextFile.includes('.finally(() => { clearTimeout(earlyTimeoutId); })'), "earlyCanonicalPromise must clean timeout in all paths");
    // 15. não existe getIdToken(true);
    assert(!contextFile.includes('getIdToken(true)'), "getIdToken(true) must not exist");
    // 16. permissões do cache e offline continuam totalmente negadas.
    assert(contextFile.includes('permissions: DENIED_PERMISSIONS'), "Cache and offline permissions must remain totally denied");
    console.log("All MS-PERF-4B-FIX-1 and FIX-2 tests passed.");
}
runTests();
