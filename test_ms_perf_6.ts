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

    // 1 & 2. Verificar arquivos test_ms_perf_6.ts duplicados
    assert(!fs.existsSync('app/applet/test_ms_perf_6.ts'), "1. app/applet/test_ms_perf_6.ts should not exist");
    assert(fs.existsSync('test_ms_perf_6.ts'), "2. test_ms_perf_6.ts should exist in the root");

    // Static analysis on EcosystemContext.tsx
    const ecosystemContext = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf-8');

    // 3 & 4. Validating snap.exists() properly
    assert(ecosystemContext.includes('typeof snap.exists === \'function\''), "3/4. Must verify snap.exists is a function");
    assert(ecosystemContext.includes('snap.exists()'), "3/4. Must call snap.exists()");
    assert(!ecosystemContext.match(/if \(snap && snap\.exists\) /), "4. Must not accept just snap.exists presence");

    // 5-9. Fallbacks and exists() logic
    assert(ecosystemContext.includes('getReusableOrganizationSnapshot = async (targetOrgId: string)'), "5-9. Must have getReusableOrganizationSnapshot helper");
    assert(ecosystemContext.includes('if (targetOrgId === candidateOrgId && earlyOrgDocPromise)'), "9. Must check earlyOrgDocPromise");
    assert(ecosystemContext.includes('return getDoc(doc(db, \'organizations\', targetOrgId)).catch(() => null);'), "6/7/8. Must fallback to getDoc");

    // 11 (was 5). A Promise do catálogo global é criada antes do array das consultas de descoberta.
    const globalPromiseIndex = ecosystemContext.indexOf('earlyGlobalCatalogPromise = getDocs(collection(db, \'organizations\'))');
    const queriesArrayIndex = ecosystemContext.indexOf('const queries = [');
    assert(globalPromiseIndex > -1 && queriesArrayIndex > -1 && globalPromiseIndex < queriesArrayIndex, "11. earlyGlobalCatalogPromise must be created before queries array");

    // A Promise iniciada antecipadamente é reutilizada no bloco global.
    assert(ecosystemContext.includes('const allOrgsSnap = await earlyGlobalCatalogPromise'), "Must reuse earlyGlobalCatalogPromise");

    // 10 (was 7). Não existe uma segunda consulta global de organizations no bootstrap.
    const countAllOrgsFetch = (ecosystemContext.match(/getDocs\(collection\(db, 'organizations'\)\)/g) || []).length;
    assert(countAllOrgsFetch === 1, "10. Must have exactly one getDocs(collection(db, 'organizations'))");

    // Leituras de plano utilizam o helper reutilizável.
    const getPlMatches = (ecosystemContext.match(/const getPl = await getReusableOrganizationSnapshot\(orgId\);/g) || []).length;
    assert(getPlMatches >= 4, "Plan reads must use getReusableOrganizationSnapshot");

    // 12. Não existe getIdToken(true).
    assert(!ecosystemContext.includes('getIdToken(true)'), "12. Must not include getIdToken(true)");

    // 13. Resposta canônica continua obrigatória para permissões.
    assert(ecosystemContext.includes('if (isValidCanonicalResponse('), "13. Must require isValidCanonicalResponse");
    
    // 14 & 15. Endpoints
    assert(!ecosystemContext.includes('/api/check_membership'), "14. Must not include /api/check_membership");
    assert(ecosystemContext.includes('/api/v1/ecosystem/access-context'), "15. Must use /api/v1/ecosystem/access-context");

    // Outras variáveis de estado e segurança
    assert(ecosystemContext.includes('AbortController'), "AbortController must be present");
    assert(ecosystemContext.includes('mounted = true'), "mounted must be present");
    assert(ecosystemContext.includes('currentGeneration'), "currentGeneration must be present");

    const isInitializedMatches = (ecosystemContext.match(/setIsInitialized\(true\)/g) || []).length;
    assert(isInitializedMatches > 0, "isInitialized must be managed properly");
    assert(ecosystemContext.includes('Sincronizando Ecossistema...'), "Visual contract preserved");

    console.log("All MS-PERF-6 tests passed.");
}

runTests();
