import fs from 'fs';
import { resolveMembershipRoleAndStatus } from './services/ecosystem/accessContextResolver.js';

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function runTests() {
    console.log("Running MS-PERF-5 tests...");

    // Test cases for resolveMembershipRoleAndStatus
    // 1. membership direta possui precedência;
    let res = resolveMembershipRoleAndStatus('user1', {}, { role: 'admin', status: 'active' }, { role: 'viewer', status: 'active' }, { role: 'musician', status: 'active' });
    assert(res.role === 'admin' && res.status === 'active', "Direct membership must have precedence");

    // 2. primeira membership alternativa é usada quando a direta não existe;
    res = resolveMembershipRoleAndStatus('user1', {}, null, { role: 'viewer', status: 'active' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'active', "First alternative must be used if direct is missing");

    // 3. segunda alternativa é usada quando as anteriores não existem;
    res = resolveMembershipRoleAndStatus('user1', {}, null, null, { role: 'musician', status: 'active' });
    assert(res.role === 'musician' && res.status === 'active', "Second alternative must be used if previous are missing");

    // 4. primeira alternativa possui precedência sobre a segunda;
    res = resolveMembershipRoleAndStatus('user1', {}, null, { role: 'viewer', status: 'active' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'active', "First alternative must have precedence over second");

    // 5. ownerUid sobrescreve qualquer papel;
    res = resolveMembershipRoleAndStatus('user1', { ownerUid: 'user1' }, { role: 'viewer', status: 'active' }, null, null);
    assert(res.role === 'owner' && res.status === 'active', "ownerUid must override any role");

    // 6. ownerId sobrescreve qualquer papel;
    res = resolveMembershipRoleAndStatus('user1', { ownerId: 'user1' }, { role: 'viewer', status: 'active' }, null, null);
    assert(res.role === 'owner' && res.status === 'active', "ownerId must override any role");

    // 7. owner sempre recebe status active;
    res = resolveMembershipRoleAndStatus('user1', { ownerId: 'user1' }, { role: 'viewer', status: 'inactive' }, null, null);
    assert(res.role === 'owner' && res.status === 'active', "Owner must always get active status");

    // 8. status explícito active é preservado;
    res = resolveMembershipRoleAndStatus('user1', {}, { role: 'viewer', status: 'active' }, null, null);
    assert(res.status === 'active', "Explicit active status must be preserved");

    // 9. status explícito inactive é preservado;
    res = resolveMembershipRoleAndStatus('user1', {}, { role: 'viewer', status: 'inactive' }, null, null);
    assert(res.status === 'inactive', "Explicit inactive status must be preserved");

    // 10. documento existente sem status usa active;
    res = resolveMembershipRoleAndStatus('user1', {}, { role: 'viewer' }, null, null);
    assert(res.status === 'active', "Existing document without status must use active");

    // 11. ausência completa retorna role null e status null;
    res = resolveMembershipRoleAndStatus('user1', {}, null, null, null);
    assert(res.role === null && res.status === null, "Complete absence must return role null and status null");

    // 12. role possui precedência sobre organizationRole dentro do mesmo documento;
    res = resolveMembershipRoleAndStatus('user1', {}, { role: 'admin', organizationRole: 'viewer' }, null, null);
    assert(res.role === 'admin', "role must have precedence over organizationRole");

    const resolverFile = fs.readFileSync('./services/ecosystem/accessContextResolver.ts', 'utf8');
    // 13. helper não acessa Firebase, rede ou armazenamento;
    assert(!resolverFile.includes('firebase') && !resolverFile.includes('fetch') && !resolverFile.includes('localStorage') && !resolverFile.includes('db.'), "Helper must not access Firebase, network, or storage");

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

    console.log("All MS-PERF-5 tests passed.");
}

runTests();
