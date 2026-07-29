import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { IdempotencyService } from '../bandScale/idempotencyService.js';
import { NotificationFactory } from '../bandScale/notificationFactory.js';
import { logger } from '../../../lib/logger.js';
import type { EventAssignment, Scale, BandScale, MusicScalePublishPatch, MusicScalePublishPayload } from '../../../types.js';
import { AssignmentNotificationFormatter } from '../../../lib/AssignmentNotificationFormatter.js';
import type { FirebaseFirestore } from '@firebase/firestore-types';

export class PublishCommandError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'PublishCommandError';
    this.code = code;
  }
}

export class ValidationError extends PublishCommandError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
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

interface OrganizationDocument {
  ownerUid?: string;
  ownerId?: string;
}

interface BandAssignmentDocument {
  assignmentId?: string;
  userId?: string;
  instrumentId?: string;
  active?: boolean;
}

export class MusicScaleCommandService {
  static validatePayload(payload: unknown): asserts payload is MusicScalePublishPayload {
    if (!payload || typeof payload !== 'object') {
      throw new ValidationError("Payload inválido.");
    }

    const payloadObj = payload as Record<string, unknown>;

    // Strict check for unknown fields on the root payload
    const allowedRootKeys = ['scalePatch', 'bandScaleId'];
    for (const key of Object.keys(payloadObj)) {
      if (!allowedRootKeys.includes(key)) {
        throw new ValidationError(`Campo raiz desconhecido no payload: ${key}`);
      }
    }

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
        throw new PublishCommandError("Divergência entre payload.bandScaleId e scalePatch.bandScaleId.", "PAYLOAD_CONFLICT");
      }
    }

    if (payloadObj.scalePatch !== undefined) {
      const patch = payloadObj.scalePatch;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new ValidationError("O campo scalePatch deve ser um objeto simples.");
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
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new ValidationError("Formato de data inválido. Deve ser YYYY-MM-DD.");
        }
        const [year, month, day] = date.split('-').map(Number);
        const parsedDate = new Date(Date.UTC(year, month - 1, day));
        if (
          parsedDate.getUTCFullYear() !== year ||
          parsedDate.getUTCMonth() !== month - 1 ||
          parsedDate.getUTCDate() !== day
        ) {
          throw new ValidationError("Data impossível.");
        }
      }

      if (patchObj.time !== undefined && patchObj.time !== null) {
        const time = patchObj.time;
        if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
          throw new ValidationError("Formato de horário inválido. Deve ser HH:mm.");
        }
        const [hour, minute] = time.split(':').map(Number);
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
          throw new ValidationError("Horário impossível.");
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
        if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 1 || !Number.isInteger(duration)) {
          throw new ValidationError("O campo durationMinutes deve ser um inteiro positivo e finito.");
        }
      }

      if (patchObj.songSettings !== undefined) {
        const songSettings = patchObj.songSettings;
        if (typeof songSettings !== 'object' || Array.isArray(songSettings) || songSettings === null) {
          throw new ValidationError("O campo songSettings deve ser um objeto simples.");
        }
        const settingsObj = songSettings as Record<string, unknown>;
        for (const songId of Object.keys(settingsObj)) {
          const setting = settingsObj[songId];
          if (!setting || typeof setting !== 'object' || Array.isArray(setting)) {
            throw new ValidationError(`Configuração inválida para a música ${songId}.`);
          }
          const settingObj = setting as Record<string, unknown>;
          
          for (const key of Object.keys(settingObj)) {
            if (key !== 'key' && key !== 'bpm') {
              throw new ValidationError(`Campo desconhecido na configuração da música ${songId}: ${key}`);
            }
          }

          if (settingObj.key !== undefined && settingObj.key !== null && (typeof settingObj.key !== 'string' || settingObj.key.trim() === '')) {
            throw new ValidationError(`O tom da música ${songId} deve ser uma string válida ou null.`);
          }
          if (settingObj.bpm !== undefined && settingObj.bpm !== null && (typeof settingObj.bpm !== 'number' || !Number.isFinite(settingObj.bpm) || settingObj.bpm < 20 || settingObj.bpm > 300)) {
            throw new ValidationError(`O BPM da música ${songId} deve ser finito e entre 20 e 300.`);
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

    // Normalize payload to canonical patch format if possible
    let normalizedPayload = payload;
    if (payload && typeof payload === 'object' && payload.bandScaleId !== undefined && payload.scalePatch === undefined) {
      normalizedPayload = { scalePatch: { bandScaleId: payload.bandScaleId } };
    } else if (payload && typeof payload === 'object' && payload.scalePatch) {
      const canonicalPatch = { ...payload.scalePatch };
      if (payload.bandScaleId !== undefined && canonicalPatch.bandScaleId === undefined) {
        canonicalPatch.bandScaleId = payload.bandScaleId;
      }
      normalizedPayload = { scalePatch: canonicalPatch };
    }

    const db = getFirestore();
    const startTime = Date.now();
    const commandId = crypto.randomUUID();
    const receiptId = IdempotencyService.getReceiptId(orgId, idempotencyKey);
    const fingerprint = IdempotencyService.getRequestFingerprint(normalizedPayload);

    const result = await db.runTransaction(async (transaction) => {
      // -------------------------------------------------------------
      // PHASE 1: READS & VALIDATIONS
      // -------------------------------------------------------------

      // 1. Idempotency Check
      const existingReceipt = await IdempotencyService.getReceiptInTransaction(transaction, orgId, receiptId);
      if (existingReceipt) {
        if (existingReceipt.entityId !== musicScaleId) {
          throw new PublishCommandError(`Este recibo pertence à outra escala (${existingReceipt.entityId}).`, 'IDEMPOTENCY_CONFLICT');
        }
        if (existingReceipt.requestFingerprint !== fingerprint) {
          throw new PublishCommandError("Esta chave de idempotência já foi utilizada com um payload diferente.", 'IDEMPOTENCY_CONFLICT');
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
        throw new PublishCommandError("Acesso negado: a escala não pertence a esta organização.", 'TENANT_SCOPE_MISMATCH');
      }

      // 3.1. Process scalePatch to build final patched data and patch payload
      const patchedScaleData = { ...currentScale };
      const patchToApply: Partial<MusicScalePublishPatch> = {};

      const scalePatch = normalizedPayload.scalePatch;
      if (scalePatch) {
        const allowedKeys: (keyof MusicScalePublishPatch)[] = [
          'date', 'time', 'eventTypeId', 'locationId', 
          'eventNameId', 'observations', 'songIds', 
          'songSettings', 'durationMinutes', 'bandScaleId'
        ];
        for (const key of allowedKeys) {
          if (scalePatch[key] !== undefined) {
            (patchToApply as Record<string, unknown>)[key] = scalePatch[key];
            (patchedScaleData as Record<string, unknown>)[key] = scalePatch[key];
          }
        }
      }

      // Phase 7: Validar o estado final
      if (!patchedScaleData.organizationId) {
        throw new ValidationError("Estado final inválido: organizationId ausente.");
      }
      if (!patchedScaleData.date) {
        throw new ValidationError("Estado final inválido: date ausente.");
      }
      if (!patchedScaleData.eventTypeId) {
        throw new ValidationError("Estado final inválido: eventTypeId ausente.");
      }
      if (!patchedScaleData.locationId) {
        throw new ValidationError("Estado final inválido: locationId ausente.");
      }
      if (!Array.isArray(patchedScaleData.songIds) || patchedScaleData.songIds.length === 0) {
        throw new ValidationError("Estado final inválido: songIds não pode estar vazio.");
      }
      const uniqueSongs = new Set(patchedScaleData.songIds);
      if (uniqueSongs.size !== patchedScaleData.songIds.length) {
        throw new ValidationError("Estado final inválido: songIds contém duplicações.");
      }
      if (patchedScaleData.songSettings) {
        for (const songId of Object.keys(patchedScaleData.songSettings)) {
          if (!uniqueSongs.has(songId)) {
            throw new ValidationError(`Estado final inválido: songSettings contém configuração para música órfã (${songId}).`);
          }
        }
      }
      if (patchedScaleData.durationMinutes !== undefined && patchedScaleData.durationMinutes !== null) {
        if (typeof patchedScaleData.durationMinutes !== 'number' || patchedScaleData.durationMinutes < 1) {
          throw new ValidationError("Estado final inválido: durationMinutes inválido.");
        }
      }
      if (patchedScaleData.bandScaleId !== undefined && patchedScaleData.bandScaleId !== null) {
        if (typeof patchedScaleData.bandScaleId !== 'string' || patchedScaleData.bandScaleId.trim() === '') {
          throw new ValidationError("Estado final inválido: bandScaleId inválido.");
        }
      }
      if (patchedScaleData.status === 'cancelled') {
        throw new ValidationError("Não é possível publicar uma escala cancelada.");
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
      } else if (normalizedPayload.bandScaleId !== undefined) {
        resolvedBandScaleId = normalizedPayload.bandScaleId;
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
          throw new PublishCommandError("Acesso negado: a escala da banda anterior não pertence a esta organização.", 'TENANT_SCOPE_MISMATCH');
        }
      }

      if (nextBandScaleDoc) {
        if (!nextBandScaleDoc.exists) {
          throw new Error("Escala de banda especificada não encontrada.");
        }
        const nextData = nextBandScaleDoc.data() as BandScale;
        if (nextData.organizationId !== orgId) {
          throw new PublishCommandError("Acesso negado: a escala da banda nova não pertence a esta organização.", 'TENANT_SCOPE_MISMATCH');
        }
        if (nextData.musicScaleId && nextData.musicScaleId !== musicScaleId) {
          throw new PublishCommandError("A escala de banda especificada já está vinculada a outra escala de músicas.", 'BAND_SCALE_ALREADY_LINKED');
        }
      }

      // Validate assignments tenant scope and check active members/instruments
      let activeAssignments: BandAssignmentDocument[] = [];
      const instrumentMap = new Map<string, InstrumentDocData>();
      const membersMap = new Map<string, MemberDocData>();
      let orgData: OrganizationDocument | null = null;

      if (resolvedBandScaleId && nextBandScaleDoc && nextBandScaleDoc.exists) {
        const nextBandData = nextBandScaleDoc.data() as BandScale;
        activeAssignments = ((nextBandData.assignments as BandAssignmentDocument[]) || []).filter(a => a.active !== false);

        const uniqueUserIds = new Set<string>();
        const uniqueInstrumentIds = new Set<string>();
        for (const assign of activeAssignments) {
          if (!assign.userId || !assign.instrumentId) {
            throw new PublishCommandError("Assignment inválido: sem usuário ou instrumento.", 'INVALID_ASSIGNMENT');
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
              throw new PublishCommandError(`Instrumento ${id} não encontrado na organização.`, 'INSTRUMENT_NOT_FOUND');
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
            const data = doc.data() as MemberDocData;
            if (data.userId && !membersMap.has(data.userId)) {
              membersMap.set(data.userId, data);
            }
          });

          const orgSnap = await transaction.get(db.collection('organizations').doc(orgId));
          if (orgSnap.exists) {
            orgData = orgSnap.data() as OrganizationDocument;
          }

          for (const uid of Array.from(uniqueUserIds)) {
            const isOwner = orgData && (orgData.ownerUid === uid || orgData.ownerId === uid);
            if (!isOwner) {
              const m = membersMap.get(uid);
              if (!m || m.status !== 'active') {
                throw new PublishCommandError(`Usuário ${uid} não é membro ativo da organização.`, 'USER_NOT_ACTIVE_MEMBER');
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
          const instData = instrumentMap.get(assign.instrumentId!) || { name: '', category: 'musical_instrument', organizationId: orgId };
          const instName = instData.name || "";
          const category = instData.category || 'musical_instrument';

          newEventAssignments.push({
            eventAssignmentId: evId,
            sourceBandScaleId: resolvedBandScaleId,
            sourceAssignmentId: assign.assignmentId || '',
            userId: assign.userId!,
            functionId: assign.instrumentId!,
            functionName: instName,
            functionCategory: category as 'musical_instrument' | 'vocal' | 'technical' | 'leadership' | 'general',
            active: true,
            assignmentRevision: nextRevision
          });

          const uf = userFunctions.get(assign.userId!) || [];
          uf.push({ id: assign.instrumentId!, name: instName, category });
          userFunctions.set(assign.userId!, uf);

          // Create pending Response
          const responseRef = scaleRef.collection("responses").doc(evId);
          transaction.set(responseRef, {
            organizationId: orgId,
            musicScaleId,
            userId: assign.userId,
            status: "pending",
            reason: null,
            eventAssignmentId: evId,
            bandAssignmentId: assign.assignmentId || '',
            functionId: assign.instrumentId,
            respondedAt: null,
            respondedBy: null,
            active: true,
            assignmentRevision: nextRevision,
            respondedAgainstRevision: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            override: null,
          });
          createdResponseCount++;
        }

        // Create notifications for each user
        for (const [userId, funcs] of Array.from(userFunctions.entries())) {
          if (userId !== authUid) { // Optional: Don't notify the modifier
            const notifId = crypto.randomUUID();
            const funcNames = funcs.map(f => f.name);
            const bodyStr = funcNames.length > 1 
              ? `Você foi escalado(a) como ${funcNames.slice(0, -1).join(', ')} e ${funcNames[funcNames.length - 1]}.`
              : `Você foi escalado(a) como ${funcNames[0]}.`;

            const notification = {
              id: notifId,
              organizationId: orgId,
              userId: userId,
              type: 'assignment',
              title: 'Nova Escala',
              message: bodyStr,
              link: `/scales/${musicScaleId}`,
              metadata: {
                musicScaleId,
                sourceBandScaleId: resolvedBandScaleId,
                functionNames: funcNames,
                publishRevision: nextRevision,
                action: 'published'
              },
              isRead: false,
              createdAt: FieldValue.serverTimestamp()
            };
            const notifRef = db.collection("users").doc(userId).collection("notifications").doc(notifId);
            transaction.set(notifRef, notification);
            notificationCount++;
          }
        }
      } else if (!resolvedBandScaleId && activeMembersSnap && !hasBandScalePatch) {
        // Broadcast notification if no band scale is linked, unless bandScaleId was explicitly cleared
        for (const doc of activeMembersSnap.docs) {
          const mData = doc.data();
          const userId = mData.userId || doc.id;
          if (userId && userId !== authUid) {
            const notifId = crypto.randomUUID();
            const notification = {
              id: notifId,
              organizationId: orgId,
              userId: userId,
              type: 'system_alert',
              title: 'Escala Publicada',
              message: `Uma nova escala de música foi publicada.`,
              link: `/scales/${musicScaleId}`,
              metadata: {
                musicScaleId,
                publishRevision: nextRevision,
                action: 'published'
              },
              isRead: false,
              createdAt: FieldValue.serverTimestamp()
            };
            const notifRef = db.collection("users").doc(userId).collection("notifications").doc(notifId);
            transaction.set(notifRef, notification);
            notificationCount++;
          }
        }
      }

      // 7. Handle Band Scale Bidirectional Links
      if (hasBandScalePatch) {
        // If there was a previous band scale and it changed, remove this music scale from its linkage
        if (previousBandScaleId && previousBandScaleId !== resolvedBandScaleId && previousBandScaleDoc && previousBandScaleDoc.exists) {
          transaction.update(previousBandScaleDoc.ref, {
            musicScaleId: null,
            updatedAt: FieldValue.serverTimestamp()
          });
        }

        // If a new band scale was specified, link this music scale to it
        if (resolvedBandScaleId && nextBandScaleDoc && nextBandScaleDoc.exists) {
          transaction.update(nextBandScaleDoc.ref, {
            musicScaleId: musicScaleId,
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      } else {
         // Even if not patching bandScaleId, if we resolve one from current state, ensure it points back to us (self-healing)
         if (resolvedBandScaleId && nextBandScaleDoc && nextBandScaleDoc.exists) {
           const nextData = nextBandScaleDoc.data() as BandScale;
           if (nextData.musicScaleId !== musicScaleId) {
              transaction.update(nextBandScaleDoc.ref, {
                 musicScaleId: musicScaleId,
                 updatedAt: FieldValue.serverTimestamp()
              });
           }
         }
      }

      // 8. Update MusicScale Document
      const finalUpdatePayload = {
        status: 'published' as const,
        publishRevision: nextRevision,
        eventAssignments: newEventAssignments,
        lastModifiedBy: {
          uid: authUid,
          name: modifierName,
          timestamp: FieldValue.serverTimestamp(),
        },
        bandScaleId: resolvedBandScaleId,
        updatedAt: FieldValue.serverTimestamp(),
        ...patchToApply,
      };

      transaction.update(scaleRef, finalUpdatePayload);

      // 9. Write Idempotency Receipt
      const successResult = {
        musicScaleId,
        version: nextRevision,
        createdNotificationCount: notificationCount,
        createdResponseCount,
        eventAssignmentCount: newEventAssignments.length,
      };

      IdempotencyService.writeReceiptInTransaction(transaction, orgId, receiptId, {
        commandType: "musicScale.publish",
        organizationId: orgId,
        authenticatedUserId: authUid,
        entityId: musicScaleId,
        requestFingerprint: fingerprint,
        correlationId,
        result: successResult,
      });

      return successResult;
    });

    const duration = Date.now() - startTime;
    logger.info(`[MusicScalePublishCommand] Processed command ${commandId} in ${duration}ms`, {
      musicScaleId,
      orgId,
      correlationId,
      version: (result as { version: number }).version
    });

    return {
      correlationId,
      organizationId: orgId,
      authenticatedUserId: authUid,
      ...result,
      fromCache: (result as { fromCache?: boolean }).fromCache || false
    };
  }
}
