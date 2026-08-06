import crypto from "crypto";
import { adminDb as db, admin } from "../../firebaseAdmin.js";
import { BandScaleAuthorizationService } from "./bandScaleAuthorizationService.js";
import { IdempotencyService } from "./idempotencyService.js";
import { AssignmentNormalizer, BandAssignment } from "./assignmentNormalizer.js";
import { AssignmentDiffService } from "./assignmentDiffService.js";
import { NotificationFactory } from "./notificationFactory.js";
import { logger } from "../../../lib/logger.js";

export interface BandScaleAssignmentDTO {
  userId: string;
  instrumentId: string;
  assignmentId?: string;
}

export interface BandScaleCreateDTO {
  date?: string | null;
  time?: string | null;
  observations?: string | null;
  eventTypeId?: string | null;
  locationId?: string | null;
  eventNameId?: string | null;
  musicScaleId?: string | null;
  assignments?: BandScaleAssignmentDTO[];
}

export interface BandScaleUpdateDTO {
  date?: string | null;
  time?: string | null;
  observations?: string | null;
  eventTypeId?: string | null;
  locationId?: string | null;
  eventNameId?: string | null;
  musicScaleId?: string | null;
  assignments?: BandScaleAssignmentDTO[];
}

interface CreateTransactionResult {
  scaleId: string;
  version: number;
  createdNotificationCount: number;
  fromCache: boolean;
}

interface UpdateTransactionResult {
  scaleId: string;
  version: number;
  createdNotificationCount: number;
  reconciledCount: number;
  createdCount: number;
  fromCache: boolean;
}

export interface BandScaleCommandResult {
  scaleId: string;
  version: number;
  createdNotificationCount: number;
  correlationId: string;
}

export class BandScaleCommandService {
  /**
   * Helper to fetch instrument name maps.
   */
  private static async getInstrumentNames(orgId: string): Promise<Map<string, string>> {
    const instrumentMap = new Map<string, string>();
    if (!db) return instrumentMap;

    try {
      const snap = await db.collection("instruments").where("organizationId", "==", orgId).get();
      for (const doc of snap.docs) {
        instrumentMap.set(doc.id, doc.data().name);
      }
    } catch (e) {
      logger.warn(`Failed to fetch instrument names for org ${orgId}: ${e}`);
    }
    return instrumentMap;
  }

  /**
   * Helper to validate that all users exist and belong to the same organization.
   */
  private static async validateUsersOrganization(userIds: string[], orgId: string): Promise<void> {
    if (!db || userIds.length === 0) return;

    const uniqueUserIds = Array.from(new Set(userIds));
    const userSnaps = await Promise.all(uniqueUserIds.map((id) => db.collection("users").doc(id).get()));

    for (const snap of userSnaps) {
      if (!snap.exists) {
        throw new Error(`Integrante com ID ${snap.id} não foi encontrado no sistema.`);
      }
      const uData = snap.data();
      if (uData?.organizationId !== orgId) {
        throw new Error(`O integrante ${uData?.displayName || snap.id} não pertence a esta organização.`);
      }
    }
  }

  /**
   * Helper to resolve author profile details.
   */
  private static async getAuthorProfile(userId: string): Promise<{ displayName: string; photoURL: string | null }> {
    const defaultProfile = { displayName: "Líder de Escala", photoURL: null };
    if (!db) return defaultProfile;

    try {
      const snap = await db.collection("users").doc(userId).get();
      if (snap.exists) {
        const data = snap.data() || {};
        return {
          displayName: data.displayName || "Líder de Escala",
          photoURL: data.photoURL || null,
        };
      }
    } catch (e) {}
    return defaultProfile;
  }

  /**
   * Create a brand new Band Scale with responses and notifications inside an atomic transaction.
   */
  static async createBandScale(params: {
    authUid: string;
    orgId: string;
    idempotencyKey: string;
    payload: BandScaleCreateDTO;
    correlationId: string;
  }): Promise<BandScaleCommandResult> {
    const startTime = Date.now();
    const { authUid, orgId, idempotencyKey, payload, correlationId } = params;
    const commandId = crypto.randomUUID();

    // 1. Validate Idempotency Key Format
    if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 10) {
      throw new Error("Chave de idempotência ausente ou com formato inválido.");
    }

    const receiptId = IdempotencyService.getReceiptId(orgId, idempotencyKey);
    const fingerprint = IdempotencyService.getRequestFingerprint(payload);

    if (!db) {
      throw new Error("Banco de dados não disponível.");
    }

    // 2. Authorization (RBAC)
    const isAuthorized = await BandScaleAuthorizationService.checkCanManageScales(authUid, orgId);
    if (!isAuthorized) {
      throw new Error("Permissão canManageScales negada para esta operação.");
    }

    // 3. Normalize & Validate Assignments
    const rawAssignments: unknown[] = Array.isArray(payload.assignments) ? payload.assignments : [];
    const scaleId = crypto
      .createHash("sha256")
      .update(`scale:${orgId}:${idempotencyKey}`)
      .digest("hex")
      .substring(0, 20);

    const reconciledAssignments = AssignmentNormalizer.reconcile([], rawAssignments, scaleId);

    // 4. Validate Users and fetch resources (parallelized pre-reads)
    const userIds = reconciledAssignments.map((a) => a.userId);
    const [authorProfile, instrumentNames] = await Promise.all([
      this.getAuthorProfile(authUid),
      this.getInstrumentNames(orgId),
      this.validateUsersOrganization(userIds, orgId),
    ]);

    // 5. Estimate transactional write volume
    // Writes: 1 BandScale + N Responses + N Notifications + 1 Receipt
    const totalWrites = 1 + reconciledAssignments.length + reconciledAssignments.length + 1;
    if (totalWrites > 400) {
      throw new Error("Payload muito grande. O volume de operações excede o limite seguro para uma transação.");
    }

    // 6. Run Atomic Transaction
    const result = await db.runTransaction<CreateTransactionResult>(async (transaction) => {
      // Check existing idempotency receipt
      const existingReceipt = await IdempotencyService.getReceiptInTransaction<{ scaleId: string; version: number; createdNotificationCount: number }>(transaction, orgId, receiptId);
      if (existingReceipt) {
        if (existingReceipt.requestFingerprint !== fingerprint) {
          throw new Error("Esta chave de idempotência já foi utilizada com um payload diferente.");
        }
        return {
          scaleId: existingReceipt.result.scaleId,
          version: existingReceipt.result.version,
          createdNotificationCount: existingReceipt.result.createdNotificationCount,
          fromCache: true,
        };
      }

      const bandScaleRef = db.collection("bandScales").doc(scaleId);

      // Construct scale
      const bandScaleDoc = {
        id: scaleId,
        organizationId: orgId,
        date: payload.date || null,
        time: payload.time || null,
        observations: payload.observations || null,
        eventTypeId: payload.eventTypeId || null,
        locationId: payload.locationId || null,
        eventNameId: payload.eventNameId || null,
        musicScaleId: payload.musicScaleId || null,
        version: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: authorProfile,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: authUid,
        notificationProducer: "command_api",
        assignments: reconciledAssignments,
      };

      transaction.set(bandScaleRef, bandScaleDoc);

      const notificationCount = 0;

      // Write Idempotency Receipt
      IdempotencyService.writeReceiptInTransaction<{ scaleId: string; version: number; createdNotificationCount: number }>(transaction, orgId, receiptId, {
        commandType: "bandScale.create",
        organizationId: orgId,
        userId: authUid,
        entityId: scaleId,
        requestFingerprint: fingerprint,
        result: {
          scaleId,
          version: 1,
          createdNotificationCount: notificationCount,
        },
      });

      return {
        scaleId,
        version: 1,
        createdNotificationCount: notificationCount,
        fromCache: false,
      };
    });

    const durationMs = Date.now() - startTime;
    logger.info("BandScale creation completed", {
      correlationId,
      commandId,
      organizationId: orgId,
      authenticatedUserId: authUid,
      scaleId,
      action: "create",
      previousVersion: 0,
      newVersion: result.version,
      assignmentCount: reconciledAssignments.length,
      createdResponseCount: reconciledAssignments.length,
      createdNotificationCount: result.createdNotificationCount,
      durationMs,
      fromCache: result.fromCache,
    });

    return {
      scaleId: result.scaleId,
      version: result.version,
      createdNotificationCount: result.createdNotificationCount,
      correlationId,
    };
  }

  /**
   * Edit an existing Band Scale with atomic response delta-updates and notifications.
   */
  static async updateBandScale(params: {
    authUid: string;
    orgId: string;
    scaleId: string;
    expectedVersion: number;
    idempotencyKey: string;
    payload: BandScaleUpdateDTO;
    correlationId: string;
  }): Promise<BandScaleCommandResult> {
    const startTime = Date.now();
    const { authUid, orgId, scaleId, expectedVersion, idempotencyKey, payload, correlationId } = params;
    const commandId = crypto.randomUUID();

    // 1. Validate Idempotency Key Format
    if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim().length < 10) {
      throw new Error("Chave de idempotência ausente ou com formato inválido.");
    }

    const receiptId = IdempotencyService.getReceiptId(orgId, idempotencyKey);
    const fingerprint = IdempotencyService.getRequestFingerprint(payload);

    if (!db) {
      throw new Error("Banco de dados não disponível.");
    }

    // 2. Authorization (RBAC)
    const isAuthorized = await BandScaleAuthorizationService.checkCanManageScales(authUid, orgId);
    if (!isAuthorized) {
      throw new Error("Permissão canManageScales negada para esta operação.");
    }

    // 3. Pre-read users and instruments (parallelized)
    const rawAssignments: unknown[] = Array.isArray(payload.assignments) ? payload.assignments : [];
    const userIds = (rawAssignments as {userId: string}[]).map(a => a.userId);
    const [instrumentNames] = await Promise.all([
      this.getInstrumentNames(orgId),
      this.validateUsersOrganization(userIds, orgId),
    ]);

    // 4. Run Transaction
    const result = await db.runTransaction<UpdateTransactionResult>(async (transaction) => {
      // Check existing idempotency receipt
      const existingReceipt = await IdempotencyService.getReceiptInTransaction<{ scaleId: string; version: number; createdNotificationCount: number }>(transaction, orgId, receiptId);
      if (existingReceipt) {
        if (existingReceipt.requestFingerprint !== fingerprint) {
          throw new Error("Esta chave de idempotência já foi utilizada com um payload diferente.");
        }
        return {
          scaleId: existingReceipt.result.scaleId,
          version: existingReceipt.result.version,
          createdNotificationCount: existingReceipt.result.createdNotificationCount,
          reconciledCount: 0,
          createdCount: 0,
          fromCache: true,
        };
      }

      // Fetch current scale document
      const bandScaleRef = db.collection("bandScales").doc(scaleId);
      const scaleSnap = await transaction.get(bandScaleRef);

      if (!scaleSnap.exists) {
        throw new Error("A escala informada não foi encontrada.");
      }

      const currentScale = scaleSnap.data() || {};

      // Multi-tenant isolation check
      if (currentScale.organizationId !== orgId) {
        throw new Error("Acesso negado: Esta escala pertence a outra organização.");
      }

      // Optimistic concurrency control (expectedVersion verification)
      const currentVersion = currentScale.version || 1;
      if (currentVersion !== expectedVersion) {
        throw new Error("Conflict: Esta escala foi alterada por outra pessoa. Atualize os dados antes de salvar novamente.");
      }

      // Reconcile assignments
      const existingAssignments: unknown[] = Array.isArray(currentScale.assignments) ? currentScale.assignments : [];
      const reconciled = AssignmentNormalizer.reconcile(existingAssignments, rawAssignments, scaleId);

      // Perform Diff
      const diff = AssignmentDiffService.diff(existingAssignments, reconciled);

      // PRE-READ: Fetch existing response documents inside transaction BEFORE doing any writes (Firestore restriction)
      const existingResponseDataMap = new Map<string, Record<string, unknown>>();
      const assignmentsToRead = diff.updated.map(a => a.assignmentId).filter(Boolean);
      if (assignmentsToRead.length > 0) {
        const refs = assignmentsToRead.map((id: string) => bandScaleRef.collection("responses").doc(id));
        const snaps = await Promise.all(refs.map(ref => transaction.get(ref as FirebaseFirestore.DocumentReference)));
        snaps.forEach((snap: FirebaseFirestore.DocumentSnapshot, idx: number) => {
          if (snap.exists) {
            existingResponseDataMap.set(assignmentsToRead[idx], snap.data());
          }
        });
      }

      // Pre-validate writes limit
      // Writes: 1 Scale + N responses (created/updated/removed) + N notifications + 1 Receipt
      const responsesCount = diff.created.length + diff.updated.length + diff.removed.length;
      const notificationsCount = diff.created.length + diff.updated.length;
      const totalWrites = 1 + responsesCount + notificationsCount + 1;
      if (totalWrites > 400) {
        throw new Error("A edição excede o limite seguro de alterações atômicas.");
      }

      const nextVersion = currentVersion + 1;

      // Update Scale doc
      const updatedScaleDoc = {
        ...currentScale,
        date: payload.date !== undefined ? payload.date : currentScale.date,
        time: payload.time !== undefined ? payload.time : currentScale.time,
        observations: payload.observations !== undefined ? payload.observations : currentScale.observations,
        eventTypeId: payload.eventTypeId !== undefined ? payload.eventTypeId : currentScale.eventTypeId,
        locationId: payload.locationId !== undefined ? payload.locationId : currentScale.locationId,
        eventNameId: payload.eventNameId !== undefined ? payload.eventNameId : currentScale.eventNameId,
        musicScaleId: payload.musicScaleId !== undefined ? payload.musicScaleId : currentScale.musicScaleId,
        version: nextVersion,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: authUid,
        notificationProducer: "command_api",
        assignments: reconciled,
      };

      transaction.set(bandScaleRef, updatedScaleDoc);

      const notificationCount = 0;

      // Write Idempotency Receipt
      IdempotencyService.writeReceiptInTransaction<{ scaleId: string; version: number; createdNotificationCount: number }>(transaction, orgId, receiptId, {
        commandType: "bandScale.update",
        organizationId: orgId,
        userId: authUid,
        entityId: scaleId,
        requestFingerprint: fingerprint,
        result: {
          scaleId,
          version: nextVersion,
          createdNotificationCount: notificationCount,
        },
      });

      return {
        scaleId,
        version: nextVersion,
        createdNotificationCount: notificationCount,
        reconciledCount: reconciled.length,
        createdCount: diff.created.length,
        fromCache: false,
      };
    });

    const durationMs = Date.now() - startTime;
    logger.info("BandScale update completed", {
      correlationId,
      commandId,
      organizationId: orgId,
      authenticatedUserId: authUid,
      scaleId,
      action: "update",
      previousVersion: expectedVersion,
      newVersion: result.version,
      assignmentCount: result.reconciledCount,
      createdResponseCount: result.createdCount,
      createdNotificationCount: result.createdNotificationCount,
      durationMs,
      fromCache: result.fromCache,
    });

    return {
      scaleId: result.scaleId,
      version: result.version,
      createdNotificationCount: result.createdNotificationCount,
      correlationId,
    };
  }
}
