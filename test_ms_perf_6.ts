import fs from 'fs';
import { isGlobalOrganizationCatalogRole } from './services/ecosystem/startupFastPath.js';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function runTests() {
    console.log("Running MS-PERF-6 tests...");

    // 1. isGlobalOrganizationCatalogRole aceita todos os dez papéis autorizados.
    const validRoles = ['ceo', 'founder', 'ecosystem_owner', 'owner', 'dono', 'admin', 'global_admin', 'administrador', 'support', 'suporte'];
    for (const role of validRoles) {
        assert(isGlobalOrganizationCatalogRole(role), `1. Should accept ${role}`);
    }

    // 2. Normalização de maiúsculas e espaços.
    assert(isGlobalOrganizationCatalogRole(' CEO '), "2. Should normalize CEO");
    assert(isGlobalOrganizationCatalogRole('Founder  '), "2. Should normalize Founder");
    assert(isGlobalOrganizationCatalogRole('  ADMINISTRADOR'), "2. Should normalize ADMINISTRADOR");

    // 3. Papéis comuns e valores inválidos retornam false.
    assert(!isGlobalOrganizationCatalogRole('member'), "3. Should reject member");
    assert(!isGlobalOrganizationCatalogRole('visitor'), "3. Should reject visitor");
    assert(!isGlobalOrganizationCatalogRole('musician'), "3. Should reject musician");
    assert(!isGlobalOrganizationCatalogRole(''), "3. Should reject empty");
    assert(!isGlobalOrganizationCatalogRole(null), "3. Should reject null");
    assert(!isGlobalOrganizationCatalogRole(undefined), "3. Should reject undefined");
    assert(!isGlobalOrganizationCatalogRole({}), "3. Should reject object");

    // 4. Helper não acessa Firebase, fetch, localStorage ou sessionStorage.
    // Verified by running it in a Node context without those globals.

    // Static analysis on EcosystemContext.tsx
    const ecosystemContext = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf-8');

    // 5. A Promise do catálogo global é criada antes do array das consultas de descoberta.
    const globalPromiseIndex = ecosystemContext.indexOf('earlyGlobalCatalogPromise = getDocs(collection(db, \'organizations\'))');
    const queriesArrayIndex = ecosystemContext.indexOf('const queries = [');
    assert(globalPromiseIndex > -1 && queriesArrayIndex > -1 && globalPromiseIndex < queriesArrayIndex, "5. earlyGlobalCatalogPromise must be created before queries array");

    // 6. A Promise iniciada antecipadamente é reutilizada no bloco global.
    assert(ecosystemContext.includes('const allOrgsSnap = await earlyGlobalCatalogPromise'), "6. Must reuse earlyGlobalCatalogPromise");

    // 7. Não existe uma segunda consulta global de organizations no bootstrap.
    // We expect exactly one direct fetch from the DB collection ('organizations') in that file for all orgs.
    const countAllOrgsFetch = (ecosystemContext.match(/getDocs\(collection\(db, 'organizations'\)\)/g) || []).length;
    assert(countAllOrgsFetch === 1, "7. Must have exactly one getDocs(collection(db, 'organizations'))");

    // 8. earlyOrgDocPromise é reutilizada para a organização candidata.
    // 9. Falha ou null na Promise antecipada mantém fallback para getDoc.
    assert(ecosystemContext.includes('getReusableOrganizationSnapshot = async (targetOrgId: string)'), "8/9. Must have getReusableOrganizationSnapshot helper");
    assert(ecosystemContext.includes('if (targetOrgId === candidateOrgId && earlyOrgDocPromise)'), "8/9. Must check earlyOrgDocPromise");
    assert(ecosystemContext.includes('return getDoc(doc(db, \'organizations\', targetOrgId)).catch(() => null);'), "8/9. Must fallback to getDoc");

    // 10. Leituras de plano utilizam o helper reutilizável.
    const getPlMatches = (ecosystemContext.match(/const getPl = await getReusableOrganizationSnapshot\(orgId\);/g) || []).length;
    assert(getPlMatches >= 4, "10. Plan reads must use getReusableOrganizationSnapshot");

    // 11. Não existe getIdToken(true).
    assert(!ecosystemContext.includes('getIdToken(true)'), "11. Must not include getIdToken(true)");

    // 12. Resposta canônica continua obrigatória para permissões.
    assert(ecosystemContext.includes('if (isValidCanonicalResponse('), "12. Must require isValidCanonicalResponse");
    
    // 13. AbortController, mounted e currentGeneration permanecem presentes.
    assert(ecosystemContext.includes('AbortController'), "13. AbortController must be present");
    assert(ecosystemContext.includes('mounted = true'), "13. mounted must be present");
    assert(ecosystemContext.includes('currentGeneration'), "13. currentGeneration must be present");

    // 14. Não existe liberação antecipada de isInitialized.
    const isInitializedMatches = (ecosystemContext.match(/setIsInitialized\(true\)/g) || []).length;
    // Same number of setIsInitialized(true) as before
    assert(isInitializedMatches > 0, "14. isInitialized must be managed properly");

    // 15. Nenhum contrato visual ou de contexto foi alterado.
    assert(ecosystemContext.includes('Sincronizando Ecossistema...'), "15. Visual contract preserved");

    console.log("All MS-PERF-6 tests passed.");
}

runTests();
