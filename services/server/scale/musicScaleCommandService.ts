import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { IdempotencyService } from '../bandScale/idempotencyService.js';
import { NotificationFactory } from '../bandScale/notificationFactory.js';
import { logger } from '../../../lib/logger.js';
import type { EventAssignment, Scale, BandScale, MusicScalePublishPatch, MusicScalePublishPayload } from '../../../types.js';
import { AssignmentNotificationFormatter } from '../../../lib/AssignmentNotificationFormatter.js';

export class ValidationError extends Error {
  code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

interface InstrumentDocData {
  name: string;
  category: string;
  organizationId: string;
}

interface MemberDocData {
  name?: string;
  status?: string;
  userId?: string;
}

interface UserDocData {
  name?: string;
}

export class MusicScaleCommandService {
  static validatePayload(payload: unknown): asserts payload is MusicScalePublishPayload {
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError("Payload inválido.");
    }

    const payloadObj = payload as Record<string, unknown>;

    if (
      payloadObj.bandScaleId !== undefined &&
      payloadObj.bandScaleId !== null &&
      typeof payloadObj.bandScaleId !== 'string'
    ) {
      throw new ValidationError("O campo bandScaleId deve ser string ou null.");
    }

    if (payloadObj.bandScaleId !== undefined && payloadObj.scalePatch !== undefined) {
      const patchObj = payloadObj.scalePatch as Record<string, unknown>;
      if (patchObj.bandScaleId !== undefined && payloadObj.bandScaleId !== patchObj.bandScaleId) {
        throw new ValidationError("Divergência entre payload.bandScaleId e scalePatch.bandScaleId.");
      }
    }

    if (payloadObj.scalePatch !== undefined) {
      const patch = payloadObj.scalePatch;
      if (!patch || typeof patch !== 'object') {
        throw new ValidationError("O campo scalePatch deve ser um objeto.");
      }

      const patchObj = patch as Record<string, unknown>;
      const allowedKeys = [
        'date', 'time', 'eventTypeId', 'locationId',
        'eventNameId', 'observations', 'songIds',
        'songSettings', 'durationMinutes', 'bandScaleId'
      ];

      const patchKeys = Object.keys(patchObj);
      for (const key of patchKeys) {
        if (!allowedKeys.includes(key)) {
          throw new ValidationError(`Campo não permitido no scalePatch: ${key}`);
        }
      }

      // Validate individual fields
      if (patchObj.date !== undefined) {
        const date = patchObj.date;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
          throw new ValidationError("Formato de data inválido. Deve ser YYYY-MM-DD.");
        }
      }

      if (patchObj.time !== undefined && patchObj.time !== null) {
        const time = patchObj.time;
        if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
          throw new ValidationError("Formato de horário inválido. Deve ser HH:mm.");
        }
      }

      if (patchObj.eventTypeId !== undefined) {
        const eventTypeId = patchObj.eventTypeId;
        if (typeof eventTypeId !== 'string' || eventTypeId.trim() === '') {
          throw new ValidationError("O campo eventTypeId não pode ser vazio.");
        }
      }

      if (patchObj.locationId !== undefined) {
        const locationId = patchObj.locationId;
        if (typeof locationId !== 'string' || locationId.trim() === '') {
          throw new ValidationError("O campo locationId não pode ser vazio.");
        }
      }

      if (patchObj.eventNameId !== undefined && patchObj.eventNameId !== null) {
        const eventNameId = patchObj.eventNameId;
        if (typeof eventNameId !== 'string' || eventNameId.trim() === '') {
          throw new ValidationError("O campo eventNameId não pode ser vazio.");
        }
      }

      if (patchObj.observations !== undefined) {
        const obs = patchObj.observations;
        if (typeof obs !== 'string' || obs.length > 10000) {
          throw new ValidationError("Observações inválidas ou excedem o limite de caracteres.");
        }
      }

      if (patchObj.songIds !== undefined) {
        const songIds = patchObj.songIds;
        if (!Array.isArray(songIds) || songIds.length === 0) {
          throw new ValidationError("A lista de músicas (songIds) deve ser um array não vazio.");
        }
        const seen = new Set<string>();
        for (const id of songIds) {
          if (typeof id !== 'string' || id.trim() === '') {
            throw new ValidationError("A lista de músicas (songIds) contém IDs inválidos.");
          }
          if (seen.has(id)) {
            throw new ValidationError("A lista de músicas (songIds) contém IDs duplicados.");
          }
          seen.add(id);
        }
      }

      if (patchObj.durationMinutes !== undefined) {
        const duration = patchObj.durationMinutes;
        if (typeof duration !== 'number' || isNaN(duration) || duration < 1 || !Number.isInteger(duration)) {
          throw new ValidationError("O campo durationMinutes deve ser um inteiro positivo.");
        }
      }

      if (patchObj.songSettings !== undefined) {
        const songSettings = patchObj.songSettings;
        if (typeof songSettings !== 'object' || songSettings === null) {
          throw new ValidationError("O campo songSettings deve ser um objeto.");
        }
        const settingsObj = songSettings as Record<string, unknown>;
        for (const songId of Object.keys(settingsObj)) {
          const setting = settingsObj[songId];
          if (!setting || typeof setting !== 'object') {
            throw new ValidationError(`Configuração inválida para a música ${songId}.`);
          }
          const settingObj = setting as Record<string, unknown>;
          if (settingObj.key !== undefined && (typeof settingObj.key !== 'string' || settingObj.key.trim() === '')) {
            throw new ValidationError(`O tom da música ${songId} deve ser uma string válida.`);
          }
          if (settingObj.bpm !== undefined && (typeof settingObj.bpm !== 'number' || isNaN(settingObj.bpm) || settingObj.bpm < 1)) {
            throw new ValidationError(`O BPM da música ${songId} deve ser um número positivo.`);
          }
        }
      }

      if (patchObj.bandScaleId !== undefined && patchObj.bandScaleId !== null) {
        const bandScaleId = patchObj.bandScaleId;
        if (typeof bandScaleId !== 'string' || bandScaleId.trim() === '') {
          throw new ValidationError("O campo bandScaleId no patch deve ser uma string não vazia ou null.");
        }
      }
    }
  }

  static async publishMusicScale(params: {
    authUid: string;
    orgId: string;
    musicScaleId: string;
    idempotencyKey: string;
    payload: MusicScalePublishPayload;
    correlationId: string;
  }) {
    const { authUid, orgId, musicScaleId, idempotencyKey, payload, correlationId } = params;
    
    // Validate payload shape and fields before database operations
    MusicScaleCommandService.validatePayload(payload);

    const db = getFirestore();
    const startTime = Date.now();
    const commandId = crypto.randomUUID();
    const receiptId = IdempotencyService.getReceiptId(orgId, idempotencyKey);
    const fingerprint = IdempotencyService.getRequestFingerprint(payload);

    const result = await db.runTransaction(async (transaction) => {
      // -------------------------------------------------------------
      // PHASE 1: READS & VALIDATIONS
      // -------------------------------------------------------------

      // 1. Idempotency Check
      const existingReceipt = await IdempotencyService.getReceiptInTransaction(transaction, orgId, receiptId);
      if (existingReceipt) {
        if (existingReceipt.entityId !== musicScaleId) {
          const conflictErr = new Error(`Este recibo pertence à outra escala (${existingReceipt.entityId}).`);
          (conflictErr as any).code = 'IDEMPOTENCY_CONFLICT';
          throw conflictErr;
        }
        if (existingReceipt.requestFingerprint !== fingerprint) {
          const conflictErr = new Error("Esta chave de idempotência já foi utilizada com um payload diferente.");
          (conflictErr as any).code = 'IDEMPOTENCY_CONFLICT';
          throw conflictErr;
        }
        return {
          ...existingReceipt.result,
          fromCache: true,
        };
      }

      // 2. Load Modifier Name
      let modifierName = 'Sistema';
      const membershipRef = db.collection('organizations').doc(orgId).collection('members').doc(authUid);
      const membershipDoc = await transaction.get(membershipRef);
      if (membershipDoc.exists) {
        const memData = membershipDoc.data() as MemberDocData;
        if (memData?.name) {
          modifierName = memData.name;
        }
      } else {
        const userRef = db.collection('users').doc(authUid);
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists) {
          const userData = userDoc.data() as UserDocData;
          if (userData?.name) {
            modifierName = userData.name;
          }
        }
      }

      // 3. Load MusicScale
      const scaleRef = db.collection('scales').doc(musicScaleId);
      const scaleDoc = await transaction.get(scaleRef);
      if (!scaleDoc.exists) {
        throw new Error("Escala de música não encontrada.");
      }

      const currentScale = scaleDoc.data() as Scale;
      // TENANT-SCOPED VALIDATION
      if (currentScale.organizationId !== orgId) {
        const error = new Error("Acesso negado: a escala não pertence a esta organização.");
        (error as any).code = 'TENANT_SCOPE_MISMATCH';
        throw error;
      }

      // 3.1. Process scalePatch to build final patched data and patch payload
      const patchedScaleData = { ...currentScale };
      const patchToApply: Partial<MusicScalePublishPatch> = {};

      const scalePatch = payload.scalePatch;
      if (scalePatch) {
        const allowedKeys: (keyof MusicScalePublishPatch)[] = [
          'date', 'time', 'eventTypeId', 'locationId', 
          'eventNameId', 'observations', 'songIds', 
          'songSettings', 'durationMinutes', 'bandScaleId'
        ];
        for (const key of allowedKeys) {
          if (scalePatch[key] !== undefined) {
            (patchToApply as any)[key] = scalePatch[key];
            (patchedScaleData as any)[key] = scalePatch[key];
          }
        }
      }

      const nextRevision = (patchedScaleData.publishRevision || 0) + 1;

      // 3.2. If republication, fetch the old active responses to deactivate
      let responsesSnap = { docs: [] as FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[] };
      if (nextRevision > 1 || currentScale.status === 'published') {
        const responsesQueryRef = scaleRef.collection("responses").where("active", "==", true);
        responsesSnap = await transaction.get(responsesQueryRef);
      }

      // 4. Resolve bandScaleId and links
      let previousBandScaleId = currentScale.bandScaleId ?? null;
      let resolvedBandScaleId = currentScale.bandScaleId ?? null;
      let hasBandScalePatch = false;

      if (scalePatch && scalePatch.bandScaleId !== undefined) {
        resolvedBandScaleId = scalePatch.bandScaleId;
        hasBandScalePatch = true;
      } else if (payload.bandScaleId !== undefined) {
        resolvedBandScaleId = payload.bandScaleId;
        hasBandScalePatch = true;
      }

      // Fetch the band scale documents
      let previousBandScaleDoc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;
      let nextBandScaleDoc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;

      if (previousBandScaleId) {
        previousBandScaleDoc = await transaction.get(db.collection('bandScales').doc(previousBandScaleId));
      }

      if (resolvedBandScaleId) {
        if (resolvedBandScaleId === previousBandScaleId) {
          nextBandScaleDoc = previousBandScaleDoc;
        } else {
          nextBandScaleDoc = await transaction.get(db.collection('bandScales').doc(resolvedBandScaleId));
        }
      }

      // Validate Band Scales
      if (previousBandScaleDoc && previousBandScaleDoc.exists) {
        const prevData = previousBandScaleDoc.data() as BandScale;
        if (prevData.organizationId !== orgId) {
          const error = new Error("Acesso negado: a escala da banda anterior não pertence a esta organização.");
          (error as any).code = 'TENANT_SCOPE_MISMATCH';
          throw error;
        }
      }

      if (nextBandScaleDoc) {
        if (!nextBandScaleDoc.exists) {
          throw new Error("Escala de banda especificada não encontrada.");
        }
        const nextData = nextBandScaleDoc.data() as BandScale;
        if (nextData.organizationId !== orgId) {
          const error = new Error("Acesso negado: a escala da banda nova não pertence a esta organização.");
          (error as any).code = 'TENANT_SCOPE_MISMATCH';
          throw error;
        }
        if (nextData.musicScaleId && nextData.musicScaleId !== musicScaleId) {
          const error = new Error("A escala de banda especificada já está vinculada a outra escala de músicas.");
          (error as any).code = 'BAND_SCALE_ALREADY_LINKED';
          throw error;
        }
      }

      // Validate assignments tenant scope and check active members/instruments
      let activeAssignments: any[] = [];
      const instrumentMap = new Map<string, InstrumentDocData>();
      const membersMap = new Map<string, MemberDocData>();
      let orgData: any = null;

      if (resolvedBandScaleId && nextBandScaleDoc && nextBandScaleDoc.exists) {
        const nextBandData = nextBandScaleDoc.data() as BandScale;
        activeAssignments = (nextBandData.assignments as any[])?.filter(a => a.active !== false) || [];

        const uniqueUserIds = new Set<string>();
        const uniqueInstrumentIds = new Set<string>();
        for (const assign of activeAssignments) {
          if (!assign.userId || !assign.instrumentId) {
            const error = new Error("Assignment inválido: sem usuário ou instrumento.");
            (error as any).code = 'INVALID_ASSIGNMENT';
            throw error;
          }
          uniqueUserIds.add(assign.userId);
          uniqueInstrumentIds.add(assign.instrumentId);
        }

        if (uniqueInstrumentIds.size > 0) {
          const instrumentSnap = await transaction.get(db.collection('instruments').where('organizationId', '==', orgId));
          instrumentSnap.docs.forEach(doc => {
            instrumentMap.set(doc.id, doc.data() as InstrumentDocData);
          });
          for (const id of Array.from(uniqueInstrumentIds)) {
            if (!instrumentMap.has(id)) {
              const error = new Error(`Instrumento ${id} não encontrado na organização.`);
              (error as any).code = 'INSTRUMENT_NOT_FOUND';
              throw error;
            }
          }
        }

        if (uniqueUserIds.size > 0) {
          const membersSnap = await transaction.get(db.collection('organizations').doc(orgId).collection('members'));
          membersSnap.docs.forEach(doc => {
            membersMap.set(doc.id, doc.data() as MemberDocData);
          });
          const crossMembersSnap = await transaction.get(db.collection('organization_members').where('organizationId', '==', orgId));
          crossMembersSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.userId && !membersMap.has(data.userId)) {
              membersMap.set(data.userId, data as MemberDocData);
            }
          });

          const orgSnap = await transaction.get(db.collection('organizations').doc(orgId));
          if (orgSnap.exists) {
            orgData = orgSnap.data();
          }

          for (const uid of Array.from(uniqueUserIds)) {
            const isOwner = orgData && (orgData.ownerUid === uid || orgData.ownerId === uid);
            if (!isOwner) {
              const m = membersMap.get(uid);
              if (!m || m.status !== 'active') {
                const error = new Error(`Usuário ${uid} não é membro ativo da organização.`);
                (error as any).code = 'USER_NOT_ACTIVE_MEMBER';
                throw error;
              }
            }
          }
        }
      }

      // If no band, load active members to broadcast notifications
      let activeMembersSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> | null = null;
      if (!resolvedBandScaleId) {
        const activeMembersRef = db.collection('organizations').doc(orgId).collection('members').where('status', '==', 'active');
        activeMembersSnap = await transaction.get(activeMembersRef);
      }

      // -------------------------------------------------------------
      // PHASE 2: WRITES & STATE MUTATIONS
      // -------------------------------------------------------------

      let notificationCount = 0;
      let createdResponseCount = 0;
      const newEventAssignments: EventAssignment[] = [];

      // 5. Deactivate old responses if republishing
      if (nextRevision > 1 || currentScale.status === 'published') {
        for (const doc of responsesSnap.docs) {
          transaction.update(doc.ref, {
            active: false,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // 6. Create new responses and newEventAssignments
      const userFunctions = new Map<string, { id: string; name: string; category: string }[]>();

      if (resolvedBandScaleId && nextBandScaleDoc && nextBandScaleDoc.exists) {
        for (const assign of activeAssignments) {
          const evId = crypto.randomUUID();
          const instData = instrumentMap.get(assign.instrumentId) || { name: '', category: 'musical_instrument', organizationId: orgId };
          const instName = instData.name || "";
          const category = instData.category || 'musical_instrument';

          newEventAssignments.push({
            eventAssignmentId: evId,
            sourceBandScaleId: resolvedBandScaleId,
            sourceAssignmentId: assign.assignmentId || '',
            userId: assign.userId,
            functionId: assign.instrumentId,
            functionName: instName,
            functionCategory: category as any,
            active: true,
            assignmentRevision: 1
          });

          const uf = userFunctions.get(assign.userId) || [];
          uf.push({ id: assign.instrumentId, name: instName, category });
          userFunctions.set(assign.userId, uf);

          // Create pending Response
          const responseRef = scaleRef.collection("responses").doc(evId);
          transaction.set(responseRef, {
            organizationId: orgId,
            musicScaleId: musicScaleId,
            eventAssignmentId: evId,
            userId: assign.userId,
            functionId: assign.instrumentId,
            status: "pending",
            reason: null,
            respondedAt: null,
            respondedBy: null,
            active: true,
            assignmentRevision: 1,
            respondedAgainstRevision: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            override: null,
          });
          createdResponseCount++;
        }

        // Create notifications for each user
        for (const [userId, funcs] of Array.from(userFunctions.entries())) {
          const funcNames = funcs.map(f => f.name).join(', ');
          const notifTitle = AssignmentNotificationFormatter.formatTitle(funcs);

          let eventDate = patchedScaleData.date || 'Data não definida';
          if (patchedScaleData.time) {
            eventDate += ` às ${patchedScaleData.time}`;
          }
          const message = `No evento do dia ${eventDate}.`;

          const notifId = NotificationFactory.getNotificationId(orgId, commandId, "published" as any, userId);
          const notifRef = db.collection("organizations").doc(orgId).collection("notifications").doc(notifId);
          
          transaction.set(notifRef, {
            organizationId: orgId,
            recipientId: userId,
            type: 'music_scale_assignment',
            title: notifTitle,
            message,
            entityType: 'musicScale',
            entityId: musicScaleId,
            link: `/scales/${musicScaleId}`,
            metadata: {
              musicScaleId,
              sourceBandScaleId: resolvedBandScaleId,
              functionNames: funcNames,
              publishRevision: nextRevision,
              action: 'published'
            },
            isRead: false,
            isArchived: false,
            createdAt: FieldValue.serverTimestamp(),
            source: 'music-scale-command-api',
            idempotencyKey,
            commandId
          });
          notificationCount++;
        }
      } else {
        // Broadcast to active members
        if (activeMembersSnap && activeMembersSnap.docs) {
          for (const memberDoc of activeMembersSnap.docs) {
            const userId = memberDoc.id;
            let eventDate = patchedScaleData.date || 'Data não definida';
            if (patchedScaleData.time) {
              eventDate += ` às ${patchedScaleData.time}`;
            }

            const notifId = NotificationFactory.getNotificationId(orgId, commandId, "broadcast" as any, userId);
            const notifRef = db.collection("organizations").doc(orgId).collection("notifications").doc(notifId);
            
            transaction.set(notifRef, {
              organizationId: orgId,
              recipientId: userId,
              type: 'music_scale_published',
              title: 'Nova escala publicada',
              message: `Um novo evento foi preparado para ${eventDate}. Veja repertório, local e detalhes.`,
              entityType: 'musicScale',
              entityId: musicScaleId,
              link: `/scales/${musicScaleId}`,
              metadata: {
                musicScaleId,
                publishRevision: nextRevision,
                action: 'published'
              },
              isRead: false,
              isArchived: false,
              createdAt: FieldValue.serverTimestamp(),
              source: 'music-scale-command-api',
              idempotencyKey,
              commandId
            });
            notificationCount++;
          }
        }
      }

      // 7. Update Bidirectional links for Band Scales
      if (previousBandScaleId && resolvedBandScaleId !== previousBandScaleId && previousBandScaleDoc && previousBandScaleDoc.exists) {
        const prevData = previousBandScaleDoc.data() as BandScale;
        if (prevData.musicScaleId === musicScaleId) {
          transaction.update(db.collection('bandScales').doc(previousBandScaleId), {
            musicScaleId: null,
            lastModifiedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      if (resolvedBandScaleId && nextBandScaleDoc && nextBandScaleDoc.exists) {
        transaction.update(db.collection('bandScales').doc(resolvedBandScaleId), {
          musicScaleId: musicScaleId,
          lastModifiedAt: FieldValue.serverTimestamp(),
        });
      } else if (resolvedBandScaleId && resolvedBandScaleId === previousBandScaleId && nextBandScaleDoc && nextBandScaleDoc.exists) {
        const nextBandData = nextBandScaleDoc.data() as BandScale;
        if (nextBandData.musicScaleId !== musicScaleId) {
          transaction.update(db.collection('bandScales').doc(resolvedBandScaleId), {
            musicScaleId: musicScaleId,
            lastModifiedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // 8. Update MusicScale Document
      const finalUpdatePayload = {
        status: 'published' as const,
        publishRevision: nextRevision,
        eventAssignments: newEventAssignments,
        lastModifiedBy: {
          uid: authUid,
          name: modifierName
        },
        lastModifiedAt: FieldValue.serverTimestamp(),
        bandScaleId: resolvedBandScaleId,
        ...patchToApply
      };
      transaction.update(scaleRef, finalUpdatePayload);

      // 9. Write Idempotency Receipt
      IdempotencyService.writeReceiptInTransaction(transaction, orgId, receiptId, {
        commandType: "musicScale.publish",
        organizationId: orgId,
        userId: authUid,
        entityId: musicScaleId,
        requestFingerprint: fingerprint,
        result: {
          musicScaleId,
          version: nextRevision,
          createdNotificationCount: notificationCount,
          createdResponseCount,
          eventAssignmentCount: newEventAssignments.length,
          broadcastRecipientCount: !resolvedBandScaleId ? notificationCount : 0,
        },
      });

      return {
        musicScaleId,
        version: nextRevision,
        createdNotificationCount: notificationCount,
        createdResponseCount,
        eventAssignmentCount: newEventAssignments.length,
        broadcastRecipientCount: !resolvedBandScaleId ? notificationCount : 0,
        fromCache: false,
      };
    });

    logger.info("MusicScale publish completed", {
      correlationId,
      organizationId: orgId,
      authenticatedUserId: authUid,
      musicScaleId,
      newVersion: result.version,
      createdNotificationCount: result.createdNotificationCount,
      createdResponseCount: result.createdResponseCount,
      fromCache: !!result.fromCache,
    });

    return result;
  }
}
