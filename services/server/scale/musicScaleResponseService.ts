import { adminDb as db } from "../../../services/firebaseAdmin.js";
import admin from "firebase-admin";
import { IdempotencyService } from '../bandScale/idempotencyService.js';

export interface RespondOwnParams {
  authUid: string;
  orgId: string;
  musicScaleId: string;
  idempotencyKey: string;
  payload: {
    status: 'accepted' | 'maybe' | 'declined';
    reason?: string | null;
  };
  correlationId: string;
}

export interface RespondOwnResult {
  success: boolean;
  musicScaleId: string;
  userId: string;
  status: string;
  reason: string | null;
  updatedAssignmentIds: string[];
  updatedResponseCount: number;
  responseRevision: number;
  fromCache: boolean;
  correlationId: string;
}

export class MusicScaleResponseService {
  static async respondOwn(params: RespondOwnParams): Promise<RespondOwnResult> {
    const { authUid, orgId, musicScaleId, idempotencyKey, payload, correlationId } = params;
    const { status, reason = null } = payload;

    if (!['accepted', 'maybe', 'declined'].includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const cleanReason = (status === 'declined' && reason) ? reason.trim().substring(0, 300) : null;
    if (cleanReason && cleanReason.length === 0) {
      // empty after trim
    }

    // Fingerprint for idempotency
    const payloadStr = JSON.stringify({ status, reason: cleanReason });
    const fingerprint = IdempotencyService.getRequestFingerprint({ status, reason: cleanReason });
    const receiptId = IdempotencyService.getReceiptId(orgId, idempotencyKey);
    const scaleRef = db.collection("scales").doc(musicScaleId);

    return db.runTransaction(async (transaction) => {
      // Idempotency check
      const receiptData = await IdempotencyService.getReceiptInTransaction(transaction, orgId, receiptId);
      if (receiptData) {
        if (
          receiptData.commandType === "musicScale.respondOwn" &&
          receiptData.requestFingerprint === fingerprint &&
          receiptData.authenticatedUserId === authUid &&
          receiptData.musicScaleId === musicScaleId
        ) {          return { ...(receiptData.result as RespondOwnResult), fromCache: true, correlationId };        }
        throw { status: 409, message: "Conflito de idempotência: a mesma chave foi usada com um payload diferente.", errorCode: "IDEMPOTENCY_CONFLICT", messageKey: "scaleResponses.errors.idempotencyConflict" };
      }

      // Check scale state
      const scaleSnap = await transaction.get(scaleRef);
      if (!scaleSnap.exists) {
        throw { status: 404, message: "Escala não encontrada.", errorCode: "NOT_FOUND", messageKey: "scaleResponses.errors.notFound" };
      }
      
      const scaleData = scaleSnap.data() || {};
      if (scaleData.organizationId !== orgId) {
        throw { status: 403, message: "Acesso negado.", errorCode: "PERMISSION_DENIED", messageKey: "scaleResponses.errors.permissionDenied" };
      }
      if (scaleData.status !== "published") {
        throw { status: 400, message: "A escala não está publicada.", errorCode: "NOT_PUBLISHED", messageKey: "scaleResponses.errors.notPublished" };
      }

      // Temporal Check
      // Use event date/time to check if started. (Simple implementation using browser time comparison, ignoring TZ differences strictly if not found)
      // Actually we will use a basic check.
      const now = new Date();
      if (scaleData.date) {
        let eventStartStr = scaleData.date;
        if (scaleData.time) {
          eventStartStr += `T${scaleData.time}:00`;
        } else {
          eventStartStr += `T00:00:00`;
        }
        const eventStart = new Date(eventStartStr);
        if (!isNaN(eventStart.getTime()) && now > eventStart) {
           throw { status: 400, message: "O horário deste evento já começou e a resposta não pode mais ser alterada.", errorCode: "EVENT_ALREADY_STARTED", messageKey: "scaleResponses.errors.eventStarted" };
        }
      }

      // Find user assignments in the scale
      const assignments = scaleData.eventAssignments || [];
      const userAssignments = assignments.filter((a: any) => a.userId === authUid && a.active !== false);

      if (userAssignments.length === 0) {
        throw { status: 400, message: "Você não está escalado neste evento.", errorCode: "NOT_ASSIGNED", messageKey: "scaleResponses.errors.notAssigned" };
      }

      const updatedAssignmentIds: string[] = [];
      let updatedResponseCount = 0;
      let highestResponseRevision = 0;

      // Prepare updates for all responses of this user
      const responseUpdates = [];

      for (const assignment of userAssignments) {
        const eventAssignmentId = assignment.eventAssignmentId;
        const responseRef = scaleRef.collection("responses").doc(eventAssignmentId);
        const responseSnap = await transaction.get(responseRef);
        
        let responseData: any = {};
        if (responseSnap.exists) {
           responseData = responseSnap.data();
        } else {
           // Inconsistency recovery
           responseData = {
              organizationId: orgId,
              musicScaleId,
              eventAssignmentId,
              userId: authUid,
              functionId: assignment.functionId,
              functionName: assignment.functionName,
              active: true,
              assignmentRevision: assignment.assignmentRevision || 1,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
           };
        }

        const currentRevision = responseData.responseRevision || 0;
        const newRevision = currentRevision + 1;
        if (newRevision > highestResponseRevision) {
           highestResponseRevision = newRevision;
        }

        const newResponseData = {
          ...responseData,
          status,
          reason: cleanReason,
          respondedAt: admin.firestore.FieldValue.serverTimestamp(),
          respondedBy: authUid,
          respondedAgainstRevision: assignment.assignmentRevision || 1,
          responseRevision: newRevision,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        responseUpdates.push({ ref: responseRef, data: newResponseData });
        updatedAssignmentIds.push(eventAssignmentId);
        updatedResponseCount++;
      }

      // Apply updates
      for (const update of responseUpdates) {
        transaction.set(update.ref, update.data, { merge: true });
      }

      // Audit History
      const historyId = db.collection("temp").doc().id; // generate ID
      const historyRef = scaleRef.collection("responseHistory").doc(historyId);
      transaction.set(historyRef, {
        organizationId: orgId,
        musicScaleId,
        userId: authUid,
        eventAssignmentIds: updatedAssignmentIds,
        newStatus: status,
        reasonProvided: !!cleanReason,
        changedBy: authUid,
        changeSource: 'member',
        commandId: idempotencyKey, // Using idempotencyKey as commandId for simplicity, or we can use correlationId
        correlationId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const result: RespondOwnResult = {
        success: true,
        musicScaleId,
        userId: authUid,
        status,
        reason: cleanReason,
        updatedAssignmentIds,
        updatedResponseCount,
        responseRevision: highestResponseRevision,
        fromCache: false,
        correlationId
      };

      // Save idempotency receipt
      IdempotencyService.writeReceiptInTransaction(transaction, orgId, receiptId, {
        commandType: "musicScale.respondOwn",
        requestFingerprint: fingerprint,
        authenticatedUserId: authUid,
        musicScaleId,
        organizationId: orgId,
        result,
        correlationId
      });

      return result;
    });
  }
}
