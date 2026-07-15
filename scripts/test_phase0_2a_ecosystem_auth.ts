import { validateEcosystemAuthToken } from '../services/server/ecosystemAuth.js';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'path';

// Mock DB and Auth structures
class MockDocSnap {
  private _exists: boolean;
  private _data: any;

  constructor(exists: boolean, data: any) {
    this._exists = exists;
    this._data = data;
  }

  get exists() {
    return this._exists;
  }

  data() {
    return this._data;
  }
}

class MockCollection {
  private users: Record<string, { exists: boolean, data: any, shouldFail?: boolean }>;

  constructor(users: Record<string, { exists: boolean, data: any, shouldFail?: boolean }>) {
    this.users = users;
  }

  doc(uid: string) {
    return {
      get: async () => {
        const user = this.users[uid];
        if (user?.shouldFail) {
          throw new Error("Firestore connection error");
        }
        if (!user) {
          return new MockDocSnap(false, null);
        }
        return new MockDocSnap(user.exists, user.data);
      }
    };
  }
}

class MockDb {
  private collectionMap: Record<string, MockCollection>;

  constructor(collectionMap: Record<string, MockCollection>) {
    this.collectionMap = collectionMap;
  }

  collection(name: string) {
    return this.collectionMap[name];
  }
}

class MockAuth {
  private validTokens: Record<string, { uid: string, email?: string, shouldFail?: boolean }>;
  public lastCheckRevoked: boolean | undefined = undefined;

  constructor(validTokens: Record<string, { uid: string, email?: string, shouldFail?: boolean }>) {
    this.validTokens = validTokens;
  }

  async verifyIdToken(token: string, checkRevoked?: boolean) {
    this.lastCheckRevoked = checkRevoked;
    const data = this.validTokens[token];
    if (!data || data.shouldFail) {
      throw new Error("Invalid token signature or expired");
    }
    return { uid: data.uid, email: data.email };
  }
}

async function runTests() {
  console.log("=== INICIANDO TESTES DO ENDURECIMENTO DA AUTENTICAÇÃO ECOSYSTEM ===");

  // Set up mock data
  const users = {
    "uid_ceo": { exists: true, data: { systemRole: "CEO", email: "ceo@example.com" } },
    "uid_global_admin": { exists: true, data: { systemRole: "global_admin", email: "admin@example.com" } },
    "uid_ecosystem_owner": { exists: true, data: { systemRole: "ecosystem_owner", email: "owner@example.com" } },
    "uid_founder": { exists: true, data: { systemRole: "founder", email: "founder@example.com" } },
    "uid_invalid_admin": { exists: true, data: { systemRole: "admin", email: "invalid_admin@example.com" } },
    "uid_invalid_user": { exists: true, data: { systemRole: "user", email: "user@example.com" } },
    "uid_no_role": { exists: true, data: { systemRole: null, email: "norole@example.com" } },
    "uid_db_error": { exists: false, data: null, shouldFail: true },
    "uid_legacy_email": { exists: true, data: { systemRole: "vocalista", email: "pastordanielpcunha@gmail.com" } }, // legacy email with invalid systemRole
    
    // Novas fixtures para testes de fallback indevidos (11 a 14)
    "uid_role_ceo_only": { exists: true, data: { role: "ceo", email: "role_ceo_only@example.com" } },
    "uid_approle_globaladmin_only": { exists: true, data: { appRole: "global_admin", email: "approle_only@example.com" } },
    "uid_orgrole_owner_only": { exists: true, data: { organizationRole: "owner", email: "orgrole_only@example.com" } },
    "uid_musicscalerole_admin_only": { exists: true, data: { musicscaleRole: "admin", email: "musicscalerole_only@example.com" } },
    
    // Novas fixtures para outras systemRoles (19 a 21)
    "uid_systemrole_admin": { exists: true, data: { systemRole: "admin", email: "sysadmin@example.com" } },
    "uid_systemrole_owner": { exists: true, data: { systemRole: "owner", email: "sysowner@example.com" } },
    "uid_systemrole_support": { exists: true, data: { systemRole: "support", email: "syssupport@example.com" } },

    // Normalização (22)
    "uid_normalization": { exists: true, data: { systemRole: "   EcOsYsTeM_oWnEr   ", email: "normal@example.com" } }
  };

  const tokens = {
    "token_ceo": { uid: "uid_ceo", email: "ceo@example.com" },
    "token_global_admin": { uid: "uid_global_admin", email: "admin@example.com" },
    "token_ecosystem_owner": { uid: "uid_ecosystem_owner", email: "owner@example.com" },
    "token_founder": { uid: "uid_founder", email: "founder@example.com" },
    "token_invalid_admin": { uid: "uid_invalid_admin", email: "invalid_admin@example.com" },
    "token_invalid_user": { uid: "uid_invalid_user", email: "user@example.com" },
    "token_no_role": { uid: "uid_no_role", email: "norole@example.com" },
    "token_db_error": { uid: "uid_db_error", email: "error@example.com" },
    "token_legacy_email": { uid: "uid_legacy_email", email: "pastordanielpcunha@gmail.com" },
    "token_unknown_user": { uid: "uid_unknown", email: "unknown@example.com" },
    
    // Tokens novos para fallbacks (11 a 14)
    "token_role_ceo_only": { uid: "uid_role_ceo_only", email: "role_ceo_only@example.com" },
    "token_approle_globaladmin_only": { uid: "uid_approle_globaladmin_only", email: "approle_only@example.com" },
    "token_orgrole_owner_only": { uid: "uid_orgrole_owner_only", email: "orgrole_only@example.com" },
    "token_musicscalerole_admin_only": { uid: "uid_musicscalerole_admin_only", email: "musicscalerole_only@example.com" },

    // Outras systemRoles (19 a 21)
    "token_systemrole_admin": { uid: "uid_systemrole_admin", email: "sysadmin@example.com" },
    "token_systemrole_owner": { uid: "uid_systemrole_owner", email: "sysowner@example.com" },
    "token_systemrole_support": { uid: "uid_systemrole_support", email: "syssupport@example.com" },

    // Normalização (22)
    "token_normalization": { uid: "uid_normalization", email: "normal@example.com" }
  };

  const mockDb = new MockDb({ "users": new MockCollection(users) });
  const mockAuth = new MockAuth(tokens);

  let successCount = 0;

  function pass(testNum: number, desc: string) {
    successCount++;
    console.log(`✓ [REQUISITO ${testNum.toString().padStart(2, '0')}] ${desc}`);
  }

  // 1. Header ausente retorna 401.
  {
    const res = await validateEcosystemAuthToken(undefined, mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.error || "", /UNAUTHORIZED/);
    pass(1, "Header ausente retorna 401");
  }

  // 2. Header Basic retorna 401.
  {
    const res = await validateEcosystemAuthToken("Basic am9objpkb2U=", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.error || "", /UNAUTHORIZED/);
    pass(2, "Header Basic retorna 401");
  }

  // 3. Header Bearer malformado retorna 401.
  {
    const res = await validateEcosystemAuthToken("Bearer", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.error || "", /UNAUTHORIZED/);
    pass(3, "Header Bearer malformado retorna 401");
  }

  // 4. Token inválido retorna 401.
  {
    const res = await validateEcosystemAuthToken("Bearer token_fake_invalid", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.error || "", /UNAUTHORIZED/);
    pass(4, "Token inválido retorna 401");
  }

  // 5. Token revogado ou rejeitado retorna 401.
  {
    // No mock, token_db_error ou qualquer token cujo verifyIdToken falhe simula token revogado/rejeitado
    const mockAuthRevoked = new MockAuth({
      "token_revoked": { uid: "uid_ceo", shouldFail: true }
    });
    const res = await validateEcosystemAuthToken("Bearer token_revoked", mockDb, mockAuthRevoked);
    assert.strictEqual(res.statusCode, 401);
    assert.match(res.error || "", /UNAUTHORIZED/);
    pass(5, "Token revogado ou rejeitado retorna 401");
  }

  // 6. verifyIdToken foi chamado com checkRevoked === true.
  {
    mockAuth.lastCheckRevoked = undefined;
    await validateEcosystemAuthToken("Bearer token_ceo", mockDb, mockAuth);
    assert.strictEqual(mockAuth.lastCheckRevoked, true);
    pass(6, "verifyIdToken foi chamado com checkRevoked === true");
  }

  // 7. Perfil inexistente retorna 403.
  {
    const res = await validateEcosystemAuthToken("Bearer token_unknown_user", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || "", /FORBIDDEN/);
    pass(7, "Perfil inexistente retorna 403");
  }

  // 8. Falha de leitura do banco retorna 503 e não concede contexto.
  {
    const res = await validateEcosystemAuthToken("Bearer token_db_error", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 503);
    assert.match(res.error || "", /Serviço temporariamente indisponível/);
    assert.strictEqual(res.context, undefined);
    pass(8, "Falha de leitura do banco retorna 503 e não concede contexto");
  }

  // 9. Auth ou DB ausente retorna 503.
  {
    const resDbAusente = await validateEcosystemAuthToken("Bearer token_ceo", null, mockAuth);
    assert.strictEqual(resDbAusente.statusCode, 503);
    assert.match(resDbAusente.error || "", /SERVICE_UNAVAILABLE/);

    const resAuthAusente = await validateEcosystemAuthToken("Bearer token_ceo", mockDb, null);
    assert.strictEqual(resAuthAusente.statusCode, 503);
    assert.match(resAuthAusente.error || "", /SERVICE_UNAVAILABLE/);
    pass(9, "Auth ou DB ausente retorna 503");
  }

  // 10. E-mail anteriormente permitido, sem systemRole válido, retorna 403.
  {
    const res = await validateEcosystemAuthToken("Bearer token_legacy_email", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || "", /FORBIDDEN/);
    pass(10, "E-mail anteriormente permitido, sem systemRole válido, retorna 403");
  }

  // 11. Somente role = "ceo", sem systemRole, retorna 403.
  {
    const res = await validateEcosystemAuthToken("Bearer token_role_ceo_only", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || "", /FORBIDDEN/);
    pass(11, "Somente role = 'ceo', sem systemRole, retorna 403");
  }

  // 12. Somente appRole = "global_admin", sem systemRole, retorna 403.
  {
    const res = await validateEcosystemAuthToken("Bearer token_approle_globaladmin_only", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || "", /FORBIDDEN/);
    pass(12, "Somente appRole = 'global_admin', sem systemRole, retorna 403");
  }

  // 13. organizationRole = "owner", sem systemRole, retorna 403.
  {
    const res = await validateEcosystemAuthToken("Bearer token_orgrole_owner_only", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || "", /FORBIDDEN/);
    pass(13, "organizationRole = 'owner', sem systemRole, retorna 403");
  }

  // 14. musicscaleRole ou função interna = "admin", sem systemRole, retorna 403.
  {
    const res = await validateEcosystemAuthToken("Bearer token_musicscalerole_admin_only", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || "", /FORBIDDEN/);
    pass(14, "musicscaleRole = 'admin', sem systemRole, retorna 403");
  }

  // 15. systemRole = "ceo" concede acesso.
  {
    const res = await validateEcosystemAuthToken("Bearer token_ceo", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, undefined);
    assert.ok(res.context);
    assert.strictEqual(res.context.systemRole, "ceo");
    assert.strictEqual(res.context.hasCurationAccess, true);
    pass(15, "systemRole = 'ceo' concede acesso");
  }

  // 16. systemRole = "global_admin" concede acesso.
  {
    const res = await validateEcosystemAuthToken("Bearer token_global_admin", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, undefined);
    assert.ok(res.context);
    assert.strictEqual(res.context.systemRole, "global_admin");
    assert.strictEqual(res.context.hasCurationAccess, true);
    pass(16, "systemRole = 'global_admin' concede acesso");
  }

  // 17. systemRole = "ecosystem_owner" concede acesso.
  {
    const res = await validateEcosystemAuthToken("Bearer token_ecosystem_owner", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, undefined);
    assert.ok(res.context);
    assert.strictEqual(res.context.systemRole, "ecosystem_owner");
    assert.strictEqual(res.context.hasCurationAccess, true);
    pass(17, "systemRole = 'ecosystem_owner' concede acesso");
  }

  // 18. systemRole = "founder" concede acesso.
  {
    const res = await validateEcosystemAuthToken("Bearer token_founder", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, undefined);
    assert.ok(res.context);
    assert.strictEqual(res.context.systemRole, "founder");
    assert.strictEqual(res.context.hasCurationAccess, true);
    pass(18, "systemRole = 'founder' concede acesso");
  }

  // 19. systemRole = "admin" retorna 403.
  {
    const res = await validateEcosystemAuthToken("Bearer token_systemrole_admin", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || "", /FORBIDDEN/);
    pass(19, "systemRole = 'admin' retorna 403");
  }

  // 20. systemRole = "owner" retorna 403.
  {
    const res = await validateEcosystemAuthToken("Bearer token_systemrole_owner", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || "", /FORBIDDEN/);
    pass(20, "systemRole = 'owner' retorna 403");
  }

  // 21. systemRole = "support" retorna 403.
  {
    const res = await validateEcosystemAuthToken("Bearer token_systemrole_support", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, 403);
    assert.match(res.error || "", /FORBIDDEN/);
    pass(21, "systemRole = 'support' retorna 403");
  }

  // 22. systemRole com espaços e letras maiúsculas é normalizado corretamente.
  {
    const res = await validateEcosystemAuthToken("Bearer token_normalization", mockDb, mockAuth);
    assert.strictEqual(res.statusCode, undefined);
    assert.ok(res.context);
    assert.strictEqual(res.context.systemRole, "ecosystem_owner");
    pass(22, "systemRole com espaços e maiúsculas é normalizado para 'ecosystem_owner'");
  }

  // 23. O contexto autorizado não contém isGlobalAdminEmail, caso a propriedade tenha sido removida.
  {
    const res = await validateEcosystemAuthToken("Bearer token_ceo", mockDb, mockAuth);
    assert.ok(res.context);
    assert.strictEqual((res.context as any).isGlobalAdminEmail, undefined);
    pass(23, "O contexto autorizado não contém isGlobalAdminEmail");
  }

  // --- TESTES ESTÁTICOS DE server.ts ---
  console.log("\n=== INICIANDO ANALISE ESTATICA DE server.ts ===");
  const serverPath = path.resolve(process.cwd(), 'server.ts');
  const serverContent = fs.readFileSync(serverPath, 'utf-8');

  // 24. POST /api/admin/backfill-global-titles possui requireEcosystemRole antes do handler.
  {
    const hasMiddleware = serverContent.includes('app.post("/api/admin/backfill-global-titles", requireEcosystemRole,');
    assert.ok(hasMiddleware, "POST /api/admin/backfill-global-titles deve possuir requireEcosystemRole antes do handler");
    pass(24, "POST /api/admin/backfill-global-titles possui requireEcosystemRole antes do handler");
  }

  // 25. POST /api/admin/reanalyze-candidates possui requireEcosystemRole antes do handler.
  {
    const hasMiddleware = serverContent.includes('app.post("/api/admin/reanalyze-candidates", requireEcosystemRole,');
    assert.ok(hasMiddleware, "POST /api/admin/reanalyze-candidates deve possuir requireEcosystemRole antes do handler");
    pass(25, "POST /api/admin/reanalyze-candidates possui requireEcosystemRole antes do handler");
  }

  // 26. GET /api/fix-user retorna status 410.
  const fixUserStartIndex = serverContent.indexOf('app.get("/api/fix-user"');
  assert.ok(fixUserStartIndex !== -1, "Endpoint /api/fix-user deve existir no server.ts");
  const fixUserEndIndex = serverContent.indexOf('app.get("/api/orgs/check-slug"');
  assert.ok(fixUserEndIndex !== -1, "Endpoint seguinte ao fix-user deve existir no server.ts");
  const fixUserBlock = serverContent.substring(fixUserStartIndex, fixUserEndIndex);

  {
    assert.match(fixUserBlock, /res\.status\(410\)/, "GET /api/fix-user deve retornar status 410");
    pass(26, "GET /api/fix-user retorna status 410");
  }

  // 27. O corpo de /api/fix-user contém LEGACY_REPAIR_ENDPOINT_DISABLED.
  {
    assert.match(fixUserBlock, /LEGACY_REPAIR_ENDPOINT_DISABLED/, "O corpo de /api/fix-user deve conter LEGACY_REPAIR_ENDPOINT_DISABLED");
    pass(27, "O corpo de /api/fix-user contém LEGACY_REPAIR_ENDPOINT_DISABLED");
  }

  // 28. O trecho do handler /api/fix-user não contém operações do Firestore ou transações.
  {
    const forbiddenPatterns = [
      "db.collection",
      ".set(",
      ".update(",
      ".delete(",
      ".add(",
      "runTransaction",
      "batch"
    ];
    for (const pattern of forbiddenPatterns) {
      assert.ok(!fixUserBlock.includes(pattern), `O handler de /api/fix-user não deve conter: ${pattern}`);
    }
    pass(28, "O trecho do handler /api/fix-user não contém escritas ou operações do Firestore");
  }

  // 29. O trecho do handler /api/fix-user não chama qualquer função de reparo.
  {
    // O bloco do handler de fix-user após a nossa desativação só faz res.status(410).json(...) e não chama nenhuma função de reparo ou iteração
    assert.ok(!fixUserBlock.includes("usersSnap"), "O handler de /api/fix-user não deve iterar ou reparar usuários");
    assert.ok(!fixUserBlock.includes("updatedOps"), "O handler de /api/fix-user não deve gerar arrays de operações");
    pass(29, "O trecho do handler /api/fix-user não chama nenhuma função de reparo");
  }

  console.log(`\n=== SUCESSO COMPLETO: ${successCount}/29 TESTES EXECUTADOS E APROVADOS! ===`);
}

runTests().catch((e) => {
  console.error("❌ Falha na execução dos testes:", e);
  process.exit(1);
});
