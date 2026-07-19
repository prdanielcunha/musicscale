import fs from 'fs';
import { resolveMembershipRoleAndStatus } from './services/ecosystem/accessContextResolver.js';
function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}
function runTests() {
    console.log("Running MS-PERF-5-FIX-1 tests...");
    // Test cases for resolveMembershipRoleAndStatus (FIX-1)
    
    // 1. membership direta com role continua tendo precedência;
    let res = resolveMembershipRoleAndStatus('user1', {}, { role: 'admin', status: 'active' }, { role: 'viewer', status: 'active' }, { role: 'musician', status: 'active' });
    assert(res.role === 'admin' && res.status === 'active', "1. Direct membership with role must have precedence");
    // 2. membership direta com organizationRole continua tendo precedência;
    res = resolveMembershipRoleAndStatus('user1', {}, { organizationRole: 'admin', status: 'active' }, { role: 'viewer', status: 'active' }, null);
    assert(res.role === 'admin' && res.status === 'active', "2. Direct membership with organizationRole must have precedence");
    // 3. documento direto existente sem papel permite usar crossMemberData1;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, { role: 'viewer', status: 'active' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'active', "3. Direct document without role allows using crossMemberData1");
    // 4. documento direto sem papel e crossMemberData1 sem papel permitem usar crossMemberData2;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, { status: 'inactive' }, { role: 'musician', status: 'active' });
    assert(res.role === 'musician' && res.status === 'active', "4. Direct and cross1 without role allow using crossMemberData2");
    // 5. crossMemberData1 com organizationRole é usado antes de crossMemberData2;
    res = resolveMembershipRoleAndStatus('user1', {}, null, { organizationRole: 'viewer', status: 'active' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'active', "5. crossMemberData1 with organizationRole is used before crossMemberData2");
    // 6. status vem da fonte que efetivamente forneceu o papel;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, { role: 'viewer', status: 'pending' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'pending', "6. Status comes from the source that actually provided the role");
    // 7. fonte selecionada sem status usa active;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, { role: 'viewer' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'active', "7. Selected source without status uses active");
    // 8. documento direto sem papel e sem alternativas mantém role null;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, null, null);
    assert(res.role === null, "8. Direct document without role and no alternatives keeps role null");
    // 9. nenhum documento retorna role null e status null;
    res = resolveMembershipRoleAndStatus('user1', {}, null, null, null);
    assert(res.role === null && res.status === null, "9. No document returns role null and status null");
    // 10. quando nenhum documento possui papel, o status legado da última fonte existente é preservado;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'status_dir' }, { status: 'status_cr1' }, { status: 'status_cr2' });
    assert(res.role === null && res.status === 'status_cr2', "10a. Legacy status from last existing source is preserved (cr2)");
    
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'status_dir' }, { status: 'status_cr1' }, null);
    assert(res.role === null && res.status === 'status_cr1', "10b. Legacy status from last existing source is preserved (cr1)");
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'status_dir' }, null, null);
    assert(res.role === null && res.status === 'status_dir', "10c. Legacy status from last existing source is preserved (dir)");
    res = resolveMembershipRoleAndStatus('user1', {}, { some_field: true }, null, null);
    assert(res.role === null && res.status === 'active', "10d. Legacy status without explicit status uses active");
    // 11. ownerUid continua sobrescrevendo tudo;
    res = resolveMembershipRoleAndStatus('user1', { ownerUid: 'user1' }, { role: 'viewer', status: 'inactive' }, null, null);
    assert(res.role === 'owner' && res.status === 'active', "11. ownerUid must override anything");
    // 12. ownerId continua sobrescrevendo tudo;
    res = resolveMembershipRoleAndStatus('user1', { ownerId: 'user1' }, { role: 'viewer', status: 'inactive' }, null, null);
    assert(res.role === 'owner' && res.status === 'active', "12. ownerId must override anything");
    // 13. owner sempre recebe status active;
    res = resolveMembershipRoleAndStatus('user1', { ownerId: 'user1' }, { role: 'viewer', status: 'inactive' }, null, null);
    assert(res.role === 'owner' && res.status === 'active', "13. Owner must always get active status");
    const resolverFile = fs.readFileSync('./services/ecosystem/accessContextResolver.ts', 'utf8');
    // 14. helper não acessa Firebase, rede ou armazenamento;
    assert(!resolverFile.includes('firebase') && !resolverFile.includes('fetch') && !resolverFile.includes('localStorage') && !resolverFile.includes('db.'), "14. Helper must not access Firebase, network, or storage");
    const serverFile = fs.readFileSync('./server.ts', 'utf8');
    const startIndex = serverFile.indexOf('app.get("/api/v1/ecosystem/access-context"');
    const endIndex = serverFile.indexOf('app.post("/api/orgs/create"', startIndex);
    const endpointBlock = serverFile.substring(startIndex, endIndex);
    // 14. server.ts usa Promise.all na primeira onda;
    assert(endpointBlock.includes('const [userSnap, orgSnap, orgMemberSnap, rbacModule, resolverModule] = await Promise.all(['), "server.ts must use Promise.all in the first wave");
    // 15. fallback de membership usa Promise.all;
    assert(endpointBlock.includes('const [cross1, cross2] = await Promise.all(['), "Membership fallback must use Promise.all");
    // 16. fallback não é executado quando a membership direta já resolveu o papel;
    assert(endpointBlock.includes('if (!hasDirectRole) {') || endpointBlock.includes('if(!hasDirectRole){'), "Fallback must not be executed when direct membership resolved the role");
    // 17. não existe localStorage ou sessionStorage no endpoint;
    assert(!endpointBlock.includes('localStorage') && !endpointBlock.includes('sessionStorage'), "No localStorage or sessionStorage in the endpoint");
    // 18. não existe consulta a Stripe, subscriptions ou billing dentro do endpoint;
    assert(!endpointBlock.includes('stripe') && !endpointBlock.includes('subscriptions') && !endpointBlock.includes('billing'), "No Stripe, subscriptions, or billing queries in the endpoint");
    // 19. verifyIdToken ocorre antes das leituras canônicas;
    const verifyIndex = endpointBlock.indexOf('verifyIdToken');
    const getIndex = endpointBlock.indexOf('db.collection("users")');
    assert(verifyIndex < getIndex, "verifyIdToken must occur before canonical reads");
    // 20. resposta mantém todos os campos obrigatórios;
    const responseBlock = endpointBlock.substring(endpointBlock.indexOf('res.json({'), endpointBlock.indexOf('});', endpointBlock.indexOf('res.json({')));
    assert(responseBlock.includes('success:') &&
           responseBlock.includes('correlationId,') &&
           responseBlock.includes('userId:') &&
           responseBlock.includes('organizationId:') &&
           responseBlock.includes('systemRole,') &&
           responseBlock.includes('organizationRole:') &&
           responseBlock.includes('membershipStatus,') &&
           responseBlock.includes('musicScaleProfile,') &&
           responseBlock.includes('isGlobalAccess:') &&
           responseBlock.includes('isOrganizationAdmin:') &&
           responseBlock.includes('effectiveCapabilities:') &&
           responseBlock.includes('accessSource:') &&
           responseBlock.includes('resolutionStatus:') &&
           responseBlock.includes('version:') &&
           responseBlock.includes('effectiveContext:'), "Response must maintain all required fields");
    // 21. nenhum token é registrado;
    assert(!endpointBlock.includes('console.log(token)') && !endpointBlock.includes('logger.info(token)'), "No token should be logged");
    // 22. Server-Timing não contém identificadores ou payloads.
    const timingBlock = endpointBlock.substring(endpointBlock.indexOf("res.set('Server-Timing'"), endpointBlock.indexOf(")", endpointBlock.indexOf("res.set('Server-Timing'")));
    assert(!timingBlock.includes('uid') && !timingBlock.includes('orgId') && !timingBlock.includes('token'), "Server-Timing must not contain identifiers or payloads");
    // 23. Ambos os headers Server-Timing e X-MusicScale-Timing usam timingValue
    assert(endpointBlock.includes("res.set('Server-Timing', timingValue);"), "Server-Timing must use timingValue");
    assert(endpointBlock.includes("res.set('X-MusicScale-Timing', timingValue);"), "X-MusicScale-Timing must use timingValue");
    // 24. Sanitização de timingValue existe
    assert(endpointBlock.includes("const sanitizeDuration = (value: number) =>"), "sanitizeDuration function must exist");
    assert(endpointBlock.includes("Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;"), "sanitizeDuration logic must exist");
    // 25. timingValue tem o formato correto
    assert(endpointBlock.includes("const timingValue = ["), "timingValue array must exist");
    assert(endpointBlock.includes("`auth;dur=${sanitizeDuration(durAuth)}`"), "timingValue must include auth");
    assert(endpointBlock.includes("`primary_reads;dur=${sanitizeDuration(durPrimary)}`"), "timingValue must include primary_reads");
    assert(endpointBlock.includes("`membership_fallback;dur=${sanitizeDuration(durFallback)}`"), "timingValue must include membership_fallback");
    assert(endpointBlock.includes("`access_resolution;dur=${sanitizeDuration(durResolve)}`"), "timingValue must include access_resolution");
    assert(endpointBlock.includes("`total;dur=${sanitizeDuration(durTotal)}`"), "timingValue must include total");
    console.log("All MS-PERF-5 tests passed.");
}
runTests();
