import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { resolveOrganizationAuthorization } from '../services/server/organizationAuthorization';

const mockDb = {
    collections: {
        'organizations': {
            docs: {
                'org1': { id: 'org1', status: 'active', ownerUid: 'owner1' },
                'org_archived': { id: 'org_archived', status: 'archived', ownerUid: 'owner1' },
                'org_archived_space': { id: 'org_archived_space', status: ' ARCHIVED ', ownerUid: 'owner1' },
            }
        },
        'roles': {
            docs: {
                'role1': { name: 'role1', organizationId: 'org1', permissions: { canManageUsers: true } },
                'role_no_manage': { name: 'role_no_manage', organizationId: 'org1', permissions: { canManageUsers: false } },
                'role_admin_interno': { name: 'Administrador', organizationId: 'org1', permissions: { canManageUsers: true } },
                'role_other': { name: 'role2', organizationId: 'org2', permissions: { canManageUsers: true } }
            }
        },
        'users': {
            docs: {
                'user1': { uid: 'user1', email: 'user1@test.com' },
                'legacy_admin': { uid: 'legacy_admin' },
                'legacy_inactive': { uid: 'legacy_inactive' },
                'active_space': { uid: 'active_space' },
                'ceo1': { uid: 'ceo1', systemRole: 'ceo' },
                'founder1': { uid: 'founder1', systemRole: 'founder' },
                'global1': { uid: 'global1', systemRole: 'global_admin' },
                'eco1': { uid: 'eco1', systemRole: 'ecosystem_owner' },
                'admin1': { uid: 'admin1', systemRole: 'admin' },
                'owner1': { uid: 'owner1', systemRole: 'owner' },
                'support1': { uid: 'support1', systemRole: 'support' },
            }
        },
        'org_members_org1': {
            docs: {
                'user1': { status: 'active', roleId: 'role1', organizationRole: 'member', uid: 'user1' },
                'legacy_admin': { status: 'active', organizationRole: 'admin', uid: 'legacy_admin' },
                'legacy_inactive': { status: 'inactive', organizationRole: 'admin', uid: 'legacy_inactive' },
                'active_space': { status: ' ACTIVE ', organizationRole: 'member', uid: 'active_space' }
            }
        }
    },
    collection: function(colName: string) {
        return {
            doc: (docId: string) => {
                let actualCol = colName;
                if (colName === 'members') {
                    // Hack to simulate subcollections
                    actualCol = 'org_members_org1'; 
                }
                const doc = this.collections[actualCol]?.docs[docId];
                return {
                    get: async () => {
                        if (colName === 'roles' && docId === 'role_fetch_error') throw new Error("Fetch error");
                        return { exists: !!doc, data: () => doc, ref: {} };
                    },
                    collection: (subCol) => ({
                        doc: (subDocId) => {
                            let actualCol = colName === 'organizations' && subCol === 'members' ? 'org_members_org1' : subCol;
                            const sDoc = mockDb.collections[actualCol]?.docs[subDocId];
                            return {
                                get: async () => ({ exists: !!sDoc, data: () => sDoc, ref: {} })
                            };
                        }
                    }),
                    data: () => doc,
                    ref: {}
                };
            },
            where: () => ({ get: async () => ({ docs: [] }) })
        };
    }
};

class MockAuth {
    lastTokenReceived: string | null = null;
    lastCheckRevoked: boolean | null = null;

    async verifyIdToken(token: string, checkRevoked: boolean = false) {
        this.lastTokenReceived = token;
        this.lastCheckRevoked = checkRevoked;

        if (token === 'INVALID_TOKEN') {
            throw new Error('Invalid token');
        }
        if (token === 'VALID_TOKEN') return { uid: 'user1', email: 'user1@test.com' };
        if (token === 'CEO_TOKEN') return { uid: 'ceo1' };
        if (token === 'FOUNDER_TOKEN') return { uid: 'founder1' };
        if (token === 'GLOBAL_TOKEN') return { uid: 'global1' };
        if (token === 'ECO_TOKEN') return { uid: 'eco1' };
        if (token === 'ADMIN_TOKEN') return { uid: 'admin1' };
        if (token === 'OWNER_TOKEN') return { uid: 'owner1' };
        if (token === 'SUPPORT_TOKEN') return { uid: 'support1' };
        if (token === 'LEGACY_ADMIN_TOKEN') return { uid: 'legacy_admin' };
        if (token === 'LEGACY_INACTIVE_TOKEN') return { uid: 'legacy_inactive' };
        if (token === 'ACTIVE_SPACE_TOKEN') return { uid: 'active_space' };
        if (token === 'OWNER_UID_TOKEN') return { uid: 'owner1' };
        if (token === 'OWNER_EMAIL_TOKEN') return { uid: 'non_existent', email: 'owner1@test.com' };
        if (token === 'NO_PROFILE_TOKEN') return { uid: 'no_profile' };

        return { uid: 'user1' };
    }
}

let successCount = 0;

async function test(number: number, description: string, assertion: () => Promise<void> | void) {
    try {
        await assertion();
        successCount++;
        console.log(`[PASS] ${number}. ${description}`);
    } catch (e: any) {
        console.error(`[FAIL] ${number}. ${description}`);
        console.error(e);
        process.exitCode = 1;
        throw e;
    }
}

async function runTests() {
    console.log("=== INICIANDO TESTES DO ENDURECIMENTO DAS ORGANIZAÇÕES (FASE 0.2B.3) ===");
    const auth = new MockAuth();

    // DINÂMICOS
    await test(1, "Header ausente retorna 401", async () => {
        const res = await resolveOrganizationAuthorization("", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.statusCode, 401);
    });

    await test(2, "Token inválido retorna 401", async () => {
        const res = await resolveOrganizationAuthorization("Bearer INVALID_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.statusCode, 401);
    });

    await test(3, "verifyIdToken recebe true", async () => {
        await resolveOrganizationAuthorization("Bearer VALID_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(auth.lastCheckRevoked, true);
    });

    await test(4, "Perfil inexistente em users/{uid}, com organização existente, retorna 403", async () => {
        const res = await resolveOrganizationAuthorization("Bearer NO_PROFILE_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.statusCode, 403);
    });

    await test(5, "DB ausente retorna 503", async () => {
        const res = await resolveOrganizationAuthorization("Bearer VALID_TOKEN", 'org1', null as any, auth as any);
        assert.strictEqual(res.statusCode, 503);
    });

    await test(6, "Auth ausente retorna 503", async () => {
        const res = await resolveOrganizationAuthorization("Bearer VALID_TOKEN", 'org1', mockDb as any, null as any);
        assert.strictEqual(res.statusCode, 503);
    });

    await test(7, "systemRole ceo retorna ceo", async () => {
        const res = await resolveOrganizationAuthorization("Bearer CEO_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.systemRole, 'ceo');
    });

    await test(8, "systemRole global_admin retorna global_admin", async () => {
        const res = await resolveOrganizationAuthorization("Bearer GLOBAL_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.systemRole, 'global_admin');
    });

    await test(9, "systemRole ecosystem_owner retorna ecosystem_owner", async () => {
        const res = await resolveOrganizationAuthorization("Bearer ECO_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.systemRole, 'ecosystem_owner');
    });

    await test(10, "systemRole founder retorna founder", async () => {
        const res = await resolveOrganizationAuthorization("Bearer FOUNDER_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.systemRole, 'founder');
    });

    await test(11, "systemRole admin resulta null", async () => {
        const res = await resolveOrganizationAuthorization("Bearer ADMIN_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.systemRole, null);
    });

    await test(12, "systemRole owner resulta null", async () => {
        const res = await resolveOrganizationAuthorization("Bearer OWNER_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.systemRole, null);
    });

    await test(13, "systemRole support resulta null", async () => {
        const res = await resolveOrganizationAuthorization("Bearer SUPPORT_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.systemRole, null);
    });

    await test(14, "Membership canônica ativa prevalece sobre legado admin", async () => {
        mockDb.collections['org_members_org1'].docs['legacy_admin'] = { status: 'active', organizationRole: 'member', uid: 'legacy_admin' };
        mockDb.collections['organization_members'] = mockDb.collections['organization_members'] || { docs: {} };
        mockDb.collections['organization_members'].docs['legacy_admin_org1'] = { status: 'active', organizationRole: 'admin', uid: 'legacy_admin', organization_id: 'org1' };
        
        const res = await resolveOrganizationAuthorization("Bearer LEGACY_ADMIN_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.isActive, true);
        assert.strictEqual(res.context?.organizationRole, 'member');
    });

    await test(15, "Membership canônica inativa bloqueia legado ativo", async () => {
        mockDb.collections['org_members_org1'].docs['legacy_inactive'] = { status: 'inactive', organizationRole: 'member', uid: 'legacy_inactive' };
        mockDb.collections['organization_members'] = mockDb.collections['organization_members'] || { docs: {} };
        mockDb.collections['organization_members'].docs['legacy_inactive_org1'] = { status: 'active', organizationRole: 'admin', uid: 'legacy_inactive', organization_id: 'org1' };
        
        const res = await resolveOrganizationAuthorization("Bearer LEGACY_INACTIVE_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.isActive, false);
        assert.notStrictEqual(res.context?.organizationRole, 'admin');
    });

    await test(16, "Status ' ACTIVE ' é reconhecido como ativo", async () => {
        const res = await resolveOrganizationAuthorization("Bearer ACTIVE_SPACE_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.isActive, true);
    });

    await test(17, "Organização com status ' ARCHIVED ' é bloqueada", async () => {
        const res = await resolveOrganizationAuthorization("Bearer VALID_TOKEN", 'org_archived_space', mockDb as any, auth as any);
        assert.strictEqual(res.statusCode, 403);
    });

    await test(18, "Owner por UID é reconhecido", async () => {
        const res = await resolveOrganizationAuthorization("Bearer OWNER_UID_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.isOwner, true);
    });

    await test(19, "Mesmo e-mail sem UID correspondente não é owner", async () => {
        mockDb.collections['users'].docs['non_existent'] = { uid: 'non_existent', email: 'owner1@test.com' };
        mockDb.collections['organizations'].docs['org1'].ownerUid = 'owner1';
        
        const res = await resolveOrganizationAuthorization("Bearer OWNER_EMAIL_TOKEN", 'org1', mockDb as any, auth as any);
        assert.ok(res.context);
        assert.strictEqual(res.context?.isOwner, false);
    });

    await test(20, "Role de outra organização não concede organization.members.manage", async () => {
        mockDb.collections['org_members_org1'].docs['user1'].roleId = 'role_other';
        const res = await resolveOrganizationAuthorization("Bearer VALID_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.capabilities.includes('organization.members.manage'), false);
    });

    await test(21, "Role com canManageUsers true concede organization.members.manage", async () => {
        mockDb.collections['org_members_org1'].docs['user1'].roleId = 'role1';
        const res = await resolveOrganizationAuthorization("Bearer VALID_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.capabilities.includes('organization.members.manage'), true);
    });

    await test(22, "Role com canManageUsers false não concede organization.members.manage", async () => {
        mockDb.collections['org_members_org1'].docs['user1'].roleId = 'role_no_manage';
        const res = await resolveOrganizationAuthorization("Bearer VALID_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.capabilities.includes('organization.members.manage'), false);
    });

    await test(23, "Role interna chamada Administrador não muda organizationRole de member para admin", async () => {
        mockDb.collections['org_members_org1'].docs['user1'].roleId = 'role_admin_interno';
        mockDb.collections['org_members_org1'].docs['user1'].organizationRole = 'member';
        const res = await resolveOrganizationAuthorization("Bearer VALID_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.organizationRole, 'member');
    });

    await test(24, "Erro ao buscar Role não deve conceder capability", async () => {
        mockDb.collections['org_members_org1'].docs['user1'].roleId = 'role_fetch_error';
        const res = await resolveOrganizationAuthorization("Bearer VALID_TOKEN", 'org1', mockDb as any, auth as any);
        assert.strictEqual(res.context?.capabilities.includes('organization.members.manage'), false);
    });

    // ESTÁTICOS
    const serverPath = path.resolve(process.cwd(), 'server.ts');
    const serverContent = fs.readFileSync(serverPath, 'utf-8');

    const extractHandler = (startRoute, nextRoute) => {
        const start = serverContent.indexOf(startRoute);
        let end = serverContent.length;
        if (nextRoute) end = serverContent.indexOf(nextRoute, start);
        return serverContent.substring(start, end);
    };

    const updateEndpoint = extractHandler('app.post("/api/orgs/update"', 'app.post("/api/orgs/join"');
    const joinHandler = extractHandler('app.post("/api/orgs/join"', 'app.post("/api/orgs/invite"');
    const inviteHandler = extractHandler('app.post("/api/orgs/invite"', 'app.post("/api/orgs/accept-invite"');
    const acceptInviteHandler = extractHandler('app.post("/api/orgs/accept-invite"', 'app.post("/api/orgs/check-access"');
    const checkAccessHandler = extractHandler('app.post("/api/orgs/check-access"', 'app.get("/api/orgs/list"');

    await test(25, "update valida ID antes do resolvedor", () => {
        assert.ok(updateEndpoint.indexOf('^[A-Za-z0-9_-]{1,128}$') < updateEndpoint.indexOf('resolveOrganizationAuthorization'));
    });

    await test(26, "join consulta ownerUid", () => {
        assert.ok(joinHandler.includes('ownerUid === ownerUid') || joinHandler.includes("ownerUid', '==', ownerUid"));
    });

    await test(27, "join consulta ownerUserId", () => {
        assert.ok(joinHandler.includes('ownerUserId === ownerUid') || joinHandler.includes("ownerUserId', '==', ownerUid"));
    });

    await test(28, "join consulta ownerId", () => {
        assert.ok(joinHandler.includes('ownerId === ownerUid') || joinHandler.includes("ownerId', '==', ownerUid"));
    });

    await test(29, "join normaliza status da membership", () => {
        assert.ok(joinHandler.includes("String(canonDoc.data()?.status || '')"));
    });

    await test(30, "join normaliza status da solicitação", () => {
        assert.ok(joinHandler.includes("String(reqDoc.data()?.status || '')"));
    });

    await test(31, "join mapeia ALREADY_MEMBER para 409", () => {
        assert.ok(joinHandler.includes('return res.status(409).json({ error: msg })') && joinHandler.includes('ALREADY_MEMBER'));
    });

    await test(32, "join mapeia JOIN_REQUEST_ALREADY_ACCEPTED para 409", () => {
         assert.ok(joinHandler.includes('return res.status(409).json({ error: msg })') && joinHandler.includes('JOIN_REQUEST_ALREADY_ACCEPTED'));
    });

    await test(33, "join mapeia JOIN_REQUEST_NOT_PENDING para 409", () => {
         assert.ok(joinHandler.includes('return res.status(409).json({ error: msg })') && joinHandler.includes('JOIN_REQUEST_NOT_PENDING'));
    });

    await test(34, "invite lê roles/{roleId}", () => {
        assert.ok(inviteHandler.includes("db.collection('roles').doc("));
    });

    await test(35, "invite verifica organização da Role", () => {
        assert.ok(inviteHandler.includes("roleData?.organizationId !== organizationId") || inviteHandler.includes("roleData.organizationId !== organizationId"));
    });

    await test(36, "invite salva roleId validado", () => {
        assert.ok(inviteHandler.includes("roleId: safeRoleId"));
    });

    await test(37, "invite não salva token bruto", () => {
        assert.ok(!inviteHandler.includes("token: rawToken"));
    });

    await test(38, "accept compara inviteData.tokenHash com o tokenHash apresentado dentro da transaction", () => {
        assert.ok(acceptInviteHandler.includes("crypto.timingSafeEqual"));
    });

    await test(39, "accept compara token legado dentro da transaction", () => {
        assert.ok(acceptInviteHandler.includes("Buffer.from(String(inviteData.token)"));
    });

    await test(40, "accept rejeita convite sem hash e sem token legado", () => {
        assert.ok(acceptInviteHandler.includes("if (!tokenIsValid)"));
    });

    await test(41, "accept relê roles/{roleId} dentro da transaction", () => {
        assert.ok(acceptInviteHandler.includes("db.collection('roles').doc(roleIdToAssign)"));
    });

    await test(42, "accept salva roleId", () => {
        assert.ok(acceptInviteHandler.includes("roleId: roleIdToAssign"));
    });

    await test(43, "accept salva musicscaleRole", () => {
        assert.ok(acceptInviteHandler.includes("musicscaleRole: derivedMusicscaleRole"));
    });

    await test(44, "accept força organizationRole member para convite com roleId", () => {
        assert.ok(acceptInviteHandler.includes("organizationRole: roleIdToAssign ? 'member'"));
    });

    await test(45, "accept força organizationRole member para convite legado", () => {
        assert.ok(acceptInviteHandler.includes("finalOrgRole = 'member'"));
    });

    await test(46, "accept não grava appRole", () => {
        assert.ok(!acceptInviteHandler.includes("appRole:"));
    });

    await test(47, "accept não grava systemRole", () => {
        assert.ok(!acceptInviteHandler.includes("systemRole:"));
    });

    await test(48, "accept mapeia USER_NOT_FOUND para 403", () => {
        assert.ok(acceptInviteHandler.includes('return res.status(403).json({ error: msg })') && acceptInviteHandler.includes('USER_NOT_FOUND'));
    });

    await test(49, "accept mapeia ROLE_NOT_FOUND para 404", () => {
        assert.ok(acceptInviteHandler.includes('return res.status(404).json({ error: msg })') && acceptInviteHandler.includes('ROLE_NOT_FOUND'));
    });

    await test(50, "accept mapeia ROLE_ORGANIZATION_MISMATCH para 403", () => {
        assert.ok(acceptInviteHandler.includes('return res.status(403).json({ error: msg })') && acceptInviteHandler.includes('ROLE_ORGANIZATION_MISMATCH'));
    });

    await test(51, "accept preserva tokenHash", () => {
        assert.ok(acceptInviteHandler.includes("tokenHash: tokenHash"));
    });

    await test(52, "accept remove token bruto legado", () => {
        assert.ok(acceptInviteHandler.includes("inviteUpdates.token = admin.firestore.FieldValue.delete()"));
    });

    await test(53, "teste com falha define process.exitCode = 1", () => {
        const testScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/test_phase0_2b_organization_security.ts'), 'utf-8');
        assert.ok(testScript.includes('catch (e: any)') || testScript.includes('catch (e)'));
        assert.ok(testScript.includes('process.exitCode = 1'));
    });

    console.log(`\n=== SUCESSO COMPLETO: ${successCount} TESTES EXECUTADOS E APROVADOS! ===`);
}

runTests().then(() => {
    if (successCount < 53) {
        console.error(`Falha: Número de asserções executadas foi menor que o exigido (${successCount}).`);
        process.exitCode = 1;
    }
}).catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
