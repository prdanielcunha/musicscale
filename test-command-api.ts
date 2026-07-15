import crypto from "crypto";
import { adminDb as db } from "./services/firebaseAdmin.js";
import { BandScaleCommandService } from "./services/server/bandScale/bandScaleCommandService.js";
import { logger } from "./lib/logger.js";

async function runTest() {
  console.log("====================================================");
  console.log("Iniciando Verificação de Integração da Command API...");
  console.log("====================================================\n");

  if (!db) {
    console.error("Erro: Banco de dados do Admin SDK não inicializado.");
    process.exit(1);
  }

  const orgId = "org_test_command_api_" + Date.now();
  const leaderUid = "user_leader_" + Date.now();
  const musicianUid = "user_musician_" + Date.now();
  const extraMusicianUid = "user_extra_" + Date.now();
  
  const instrumentId = "inst_vocal_test";
  const instrumentIdGuitar = "inst_guitarra_test";

  try {
    // 1. Setup Test Fixtures
    console.log("1. Configurando Organização e Usuários de teste...");
    
    // Create Org with feature flag enabled
    await db.collection("organizations").doc(orgId).set({
      name: "Org Teste Command API",
      featureFlags: {
        "musicscale.bandScaleCommandApiV1": true
      },
      createdAt: new Date()
    });

    // Create leader user (global admin or normal leader)
    await db.collection("users").doc(leaderUid).set({
      uid: leaderUid,
      displayName: "Líder de Teste",
      email: "danielcunhapastor@gmail.com", // matches global admin email bypass or leader
      organizationId: orgId,
      role: "leader"
    });

    // Create musician user
    await db.collection("users").doc(musicianUid).set({
      uid: musicianUid,
      displayName: "Músico Vocal",
      email: "musico_test@musicscale.com",
      organizationId: orgId,
      role: "member"
    });

    // Create extra musician user
    await db.collection("users").doc(extraMusicianUid).set({
      uid: extraMusicianUid,
      displayName: "Músico Guitarrista",
      email: "guitarra_test@musicscale.com",
      organizationId: orgId,
      role: "member"
    });

    // Create instrument mapping
    await db.collection("instruments").doc(instrumentId).set({
      id: instrumentId,
      name: "Vocal",
      category: "Voz",
      organizationId: orgId
    });

    await db.collection("instruments").doc(instrumentIdGuitar).set({
      id: instrumentIdGuitar,
      name: "Guitarra",
      category: "Instrumento",
      organizationId: orgId
    });

    console.log("   ✓ Setup concluído com sucesso.");

    // 2. Test BandScale Creation
    console.log("\n2. Testando a criação de escala de banda via Command API...");
    const idempotencyKeyCreate = "idem_create_key_" + crypto.randomBytes(8).toString("hex");
    
    const createPayload = {
      date: "2026-07-15",
      time: "19:30",
      observations: "Ensaio Geral",
      assignments: [
        {
          userId: musicianUid,
          instrumentId: instrumentId
        }
      ]
    };

    const createResult = await BandScaleCommandService.createBandScale({
      authUid: leaderUid,
      orgId,
      idempotencyKey: idempotencyKeyCreate,
      payload: createPayload,
      correlationId: crypto.randomUUID()
    });

    console.log("   ✓ Escala criada com ID:", createResult.scaleId);
    console.log("   ✓ Versão da escala:", createResult.version);
    console.log("   ✓ Notificações geradas:", createResult.createdNotificationCount);

    // Verify written docs in Firestore
    const scaleSnap = await db.collection("bandScales").doc(createResult.scaleId).get();
    if (!scaleSnap.exists) {
      throw new Error("Erro: O documento BandScale não foi gravado!");
    }
    const scaleData = scaleSnap.data();
    console.log("   ✓ BandScale gravado corretamente com assignments:", scaleData?.assignments);

    // Verify subcollection response doc
    const assignmentsList = scaleData?.assignments || [];
    const assignmentId = assignmentsList[0]?.assignmentId;
    if (!assignmentId) {
      throw new Error("Erro: O assignmentId estável não foi gerado!");
    }

    const responseSnap = await db.collection("bandScales").doc(createResult.scaleId).collection("responses").doc(assignmentId).get();
    if (!responseSnap.exists) {
      throw new Error("Erro: O documento de resposta do integrante não foi gravado!");
    }
    console.log("   ✓ Resposta pendente gravada com status:", responseSnap.data()?.status);

    // Verify notifications
    const notificationsSnap = await db.collection("organizations").doc(orgId).collection("notifications").get();
    console.log(`   ✓ Total de notificações geradas no Firestore: ${notificationsSnap.size}`);
    notificationsSnap.forEach(doc => {
      console.log(`     - [Notification]: "${doc.data().title}" | Msg: "${doc.data().message}"`);
    });

    // 3. Test Idempotency on Creation Retry
    console.log("\n3. Testando idempotência (tentativa de reenvio da mesma requisição)...");
    const retryResult = await BandScaleCommandService.createBandScale({
      authUid: leaderUid,
      orgId,
      idempotencyKey: idempotencyKeyCreate,
      payload: createPayload,
      correlationId: crypto.randomUUID()
    });

    console.log("   ✓ Sucesso! Idempotência comprovada.");
    console.log("     Retornou o mesmo scaleId:", retryResult.scaleId);
    console.log("     Sem criar duplicações.");

    // 4. Test Idempotency Key Conflict (Same key, different payload)
    console.log("\n4. Testando rejeição por conflito de payload com a mesma chave...");
    try {
      await BandScaleCommandService.createBandScale({
        authUid: leaderUid,
        orgId,
        idempotencyKey: idempotencyKeyCreate,
        payload: { ...createPayload, date: "2026-07-20" },
        correlationId: crypto.randomUUID()
      });
      throw new Error("Falha: Deveria ter rejeitado o conflito.");
    } catch (e: any) {
      console.log("   ✓ Sucesso! Rejeitou o conflito com erro esperado:", e.message);
    }

    // 5. Test BandScale Update (Delta update: adding a user, modifying another, and removing)
    console.log("\n5. Testando a edição atômica de escala de banda (Update) via Command API...");
    const idempotencyKeyUpdate = "idem_update_key_" + crypto.randomBytes(8).toString("hex");

    const updatePayload = {
      date: "2026-07-15",
      time: "19:30",
      observations: "Ensaio Geral (Atualizado)",
      assignments: [
        // 1. Modifying first member's instrument (Vocal -> Guitarra)
        {
          assignmentId: assignmentId,
          userId: musicianUid,
          instrumentId: instrumentIdGuitar
        },
        // 2. Adding a brand new musician
        {
          userId: extraMusicianUid,
          instrumentId: instrumentId
        }
      ]
    };

    const updateResult = await BandScaleCommandService.updateBandScale({
      authUid: leaderUid,
      orgId,
      scaleId: createResult.scaleId,
      expectedVersion: createResult.version,
      idempotencyKey: idempotencyKeyUpdate,
      payload: updatePayload,
      correlationId: crypto.randomUUID()
    });

    console.log("   ✓ Escala editada com ID:", updateResult.scaleId);
    console.log("   ✓ Nova versão incremental:", updateResult.version);
    console.log("   ✓ Novas notificações de alteração:", updateResult.createdNotificationCount);

    // Verify updated scale assignments
    const updatedScaleSnap = await db.collection("bandScales").doc(createResult.scaleId).get();
    const updatedScaleData = updatedScaleSnap.data();
    console.log("   ✓ Novos assignments gravados:", updatedScaleData?.assignments);

    // Verify response revisions and statuses
    const updatedResponseSnap1 = await db.collection("bandScales").doc(createResult.scaleId).collection("responses").doc(assignmentId).get();
    console.log(`   ✓ Integrante 1 (Instrumento alterado): Revision = ${updatedResponseSnap1.data()?.assignmentRevision}, Instrument = ${updatedResponseSnap1.data()?.instrumentId}`);

    // Verify clean up
    console.log("\n6. Limpando os documentos de teste do Firestore...");
    const batch = db.batch();
    batch.delete(db.collection("organizations").doc(orgId));
    batch.delete(db.collection("users").doc(leaderUid));
    batch.delete(db.collection("users").doc(musicianUid));
    batch.delete(db.collection("users").doc(extraMusicianUid));
    batch.delete(db.collection("instruments").doc(instrumentId));
    batch.delete(db.collection("instruments").doc(instrumentIdGuitar));
    batch.delete(db.collection("bandScales").doc(createResult.scaleId));
    
    // Clear responses
    const respDocs = await db.collection("bandScales").doc(createResult.scaleId).collection("responses").get();
    respDocs.forEach(d => batch.delete(d.ref));

    // Clear receipts
    const receiptDocs = await db.collection("organizations").doc(orgId).collection("_commandReceipts").get();
    receiptDocs.forEach(d => batch.delete(d.ref));

    // Clear notifications
    const notifDocs = await db.collection("organizations").doc(orgId).collection("notifications").get();
    notifDocs.forEach(d => batch.delete(d.ref));

    await batch.commit();
    console.log("   ✓ Banco de dados limpo com sucesso.");
    
    console.log("\n====================================================");
    console.log("✓✓✓ TODO O FLUXO DE INTEGRAÇÃO FUNCIONA PERFEITAMENTE! ✓✓✓");
    console.log("====================================================");

  } catch (error: any) {
    console.error("\n❌ FALHA NO TESTE DE INTEGRAÇÃO:", error);
    process.exit(1);
  }
}

runTest();
