import { adminDb as db } from "../../../services/firebaseAdmin.js";
import admin from "firebase-admin";
import { IdempotencyService } from '../bandScale/idempotencyService.js';

const RESPONSE_CUTOFF_MINUTES = 5;
const LEGACY_DEFAULT_TIME_ZONE = 'America/Sao_Paulo';

const getTimeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values: Record<string, number> = {};
  formatter.formatToParts(date).forEach((part) => {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  });
  const asUtc = Date.UTC(
    values.year,
    (values.month || 1) - 1,
    values.day || 1,
    values.hour || 0,
    values.minute || 0,
    values.second || 0,
  );
  return asUtc - date.getTime();
};

const parseEventStartInTimeZone = (
  date: unknown,
  time: unknown,
  timeZone: unknown,
): Date | null => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) return null;

  const resolvedTimeZone =
    typeof timeZone === 'string' && timeZone.trim()
      ? timeZone.trim()
      : LEGACY_DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: resolvedTimeZone }).format(new Date());
  } catch {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59
  ) {
    return null;
  }

  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidateUtc = naiveUtc;
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = getTimeZoneOffsetMs(new Date(candidateUtc), resolvedTimeZone);
    candidateUtc = naiveUtc - offset;
  }
  const eventStart = new Date(candidateUtc);
  return Number.isNaN(eventStart.getTime()) ? null : eventStart;
};

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

      // Members may respond until exactly 5 minutes before the event.
      // date/time are wall-clock values from the church, so never interpret them
      // in the Vercel server timezone (usually UTC).
      const now = new Date();
      const eventStart = parseEventStartInTimeZone(
        scaleData.date,
        scaleData.time,
        scaleData.timeZone,
      );
      if (eventStart) {
        const responseDeadline = new Date(
          eventStart.getTime() - RESPONSE_CUTOFF_MINUTES * 60 * 1000,
        );
        if (now.getTime() >= responseDeadline.getTime()) {
          throw {
            status: 400,
            message: "O prazo de confirmação encerra 5 minutos antes do evento.",
            errorCode: "RESPONSE_DEADLINE_PASSED",
            messageKey: "scaleResponses.errors.responseDeadlinePassed",
          };
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
