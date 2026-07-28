import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as crypto from 'crypto';
import { IdempotencyService } from '../bandScale/idempotencyService.js';
import { NotificationFactory } from '../bandScale/notificationFactory.js';
import { logger } from '../../../lib/logger.js';
import type { EventAssignment, Scale } from '../../../types.js';
import type { BandScale } from '../../../types.js';

import { AssignmentNotificationFormatter } from '../../../lib/AssignmentNotificationFormatter.js';
import { normalizeSystemRole, normalizeOrganizationRole, isGlobalMusicScaleAdministrator } from '../../../utils/rbac.js';

export class MusicScaleCommandService {
  static async publishMusicScale(params: {
    authUid: string;
    orgId: string;
    musicScaleId: string;
    idempotencyKey: string;
    payload: any;
    correlationId: string;
  }) {
    const { authUid, orgId, musicScaleId, idempotencyKey, payload, correlationId } = params;
    const db = getFirestore();

    const startTime = Date.now();
    const commandId = crypto.randomUUID();
    const receiptId = IdempotencyService.getReceiptId(orgId, idempotencyKey);
    const fingerprint = IdempotencyService.getRequestFingerprint(payload);

    const result = await db.runTransaction(async (transaction) => {
      // 1. Idempotency Check
      const existingReceipt = await IdempotencyService.getReceiptInTransaction(transaction, orgId, receiptId);
      if (existingReceipt) {
        if (existingReceipt.requestFingerprint !== fingerprint) {
          throw new Error("Esta chave de idempotência já foi utilizada com um payload diferente.");
        }
        return {
          ...existingReceipt.result,
          fromCache: true,
        };
      }

      // 2. Load Modifier Name (Authorization is handled by the caller route handler)
      let modifierName = 'Sistema';
      const membershipRef = db.collection('organizations').doc(orgId).collection('members').doc(authUid);
      const membershipDoc = await transaction.get(membershipRef);
      if (membershipDoc.exists && membershipDoc.data()?.name) {
        modifierName = membershipDoc.data()?.name;
      } else {
        const userRef = db.collection('users').doc(authUid);
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists && userDoc.data()?.name) {
            modifierName = userDoc.data()?.name;
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
      if ((currentScale as any).organizationId !== orgId) {
        const error = new Error("Acesso negado: a escala não pertence a esta organização.");
        (error as any).code = 'TENANT_SCOPE_MISMATCH';
        throw error;
      }

      // 3.1. Process scalePatch if present in payload (Atomic Update)
      let patchedScaleData = { ...currentScale };
      let patchToApply: any = {};

      if (payload.scalePatch && typeof payload.scalePatch === 'object') {
        const allowedKeys = [
          'date', 'time', 'eventTypeId', 'locationId', 
          'eventNameId', 'observations', 'songIds', 
          'songSettings', 'durationMinutes', 'bandScaleId'
        ];
        for (const key of allowedKeys) {
          if (payload.scalePatch[key] !== undefined) {
            patchToApply[key] = payload.scalePatch[key];
            (patchedScaleData as any)[key] = payload.scalePatch[key];
          }
        }
      }

      const nextRevision = (patchedScaleData.publishRevision || 0) + 1;
      let notificationCount = 0;
      let createdResponseCount = 0;
      let newEventAssignments: EventAssignment[] = [];

      // 4. Process BandScale if it exists
      const bandScaleId = payload.bandScaleId || patchedScaleData.bandScaleId;
      let hasBand = false;

      // 4.1. If republication (nextRevision > 1 or status is already published), deactivate old active responses
      if (nextRevision > 1 || currentScale.status === 'published') {
        const responsesQueryRef = scaleRef.collection("responses").where("active", "==", true);
        const responsesSnap = await transaction.get(responsesQueryRef);
        for (const doc of responsesSnap.docs) {
          transaction.update(doc.ref, {
            active: false,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }

      if (bandScaleId) {
        const bandScaleRef = db.collection('bandScales').doc(bandScaleId);
        const bandScaleDoc = await transaction.get(bandScaleRef);
        
        if (bandScaleDoc.exists) {
          hasBand = true;
          const bandScaleData = bandScaleDoc.data() as BandScale;
          // TENANT-SCOPED VALIDATION
          if ((bandScaleData as any).organizationId !== orgId) {
            const error = new Error("Acesso negado: a escala da banda não pertence a esta organização.");
            (error as any).code = 'TENANT_SCOPE_MISMATCH';
            throw error;
          }
          if (bandScaleData.musicScaleId && bandScaleData.musicScaleId !== musicScaleId) {
             const error = new Error("BandScale vinculada a outra MusicScale.");
             (error as any).code = 'TENANT_SCOPE_MISMATCH';
             throw error;
          }
          const activeAssignments = (bandScaleData.assignments as any[])?.filter(a => a.active !== false) || [];

          // Validate assignments tenant scope
          const uniqueUserIds = new Set<string>();
          const uniqueInstrumentIds = new Set<string>();
          for (const assign of activeAssignments) {
            if (!assign.userId || !assign.instrumentId) {
                const error = new Error("Assignment inválido: sem usuário ou instrumento.");
                (error as any).code = 'TENANT_SCOPE_MISMATCH';
                throw error;
            }
            uniqueUserIds.add(assign.userId);
            uniqueInstrumentIds.add(assign.instrumentId);
          }

          const instrumentMap = new Map<string, any>();
          if (uniqueInstrumentIds.size > 0) {
            const instrumentSnap = await transaction.get(db.collection('instruments').where('organizationId', '==', orgId));
            instrumentSnap.docs.forEach(doc => instrumentMap.set(doc.id, doc.data()));
            for (const id of Array.from(uniqueInstrumentIds)) {
                if (!instrumentMap.has(id)) {
                    const error = new Error(`Instrumento ${id} não encontrado na organização.`);
                    (error as any).code = 'TENANT_SCOPE_MISMATCH';
                    throw error;
                }
            }
          }

          if (uniqueUserIds.size > 0) {
            const membersSnap = await transaction.get(db.collection('organizations').doc(orgId).collection('members'));
            const membersMap = new Map<string, any>();
            membersSnap.docs.forEach(doc => membersMap.set(doc.id, doc.data()));
            const crossMembersSnap = await transaction.get(db.collection('organization_members').where('organizationId', '==', orgId));
            crossMembersSnap.docs.forEach(doc => {
               if (doc.data().userId && !membersMap.has(doc.data().userId)) membersMap.set(doc.data().userId, doc.data());
            });

            for (const uid of Array.from(uniqueUserIds)) {
                if (!membersMap.has(uid) || membersMap.get(uid).status !== 'active') {
                    // Check if owner
                    const orgSnap = await transaction.get(db.collection('organizations').doc(orgId));
                    const isOwner = orgSnap.exists && (orgSnap.data().ownerUid === uid || orgSnap.data().ownerId === uid);
                    if (!isOwner) {
                       const error = new Error(`Usuário ${uid} não é membro ativo da organização.`);
                       (error as any).code = 'TENANT_SCOPE_MISMATCH';
                       throw error;
                    }
                }
            }
          }


          // Group by user for notifications
          const userFunctions = new Map<string, { id: string; name: string; category: string }[]>();

          for (const assign of activeAssignments) {
            const evId = crypto.randomUUID();
            const instData = instrumentMap.get(assign.instrumentId) || {};
            const instName = instData.name || "";
            const category = instData.category || 'musical_instrument';

            newEventAssignments.push({
              eventAssignmentId: evId,
              sourceBandScaleId: bandScaleId,
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

          // Create Notifications per user
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
                sourceBandScaleId: bandScaleId,
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
        }
      }

      // 5. If no band, broadcast to all active members
      if (!hasBand) {
        const membersSnap = await db.collection('organizations').doc(orgId).collection('members').where('status', '==', 'active').get();
        for (const memberDoc of membersSnap.docs) {
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

      // 6. Update MusicScale Document
      const finalUpdatePayload: any = {
        status: 'published',
        publishRevision: nextRevision,
        eventAssignments: newEventAssignments,
        lastModifiedBy: {
          uid: authUid,
          name: modifierName
        },
        lastModifiedAt: FieldValue.serverTimestamp(),
        ...patchToApply
      };
      transaction.update(scaleRef, finalUpdatePayload);

      // 7. Write Idempotency Receipt
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
          broadcastRecipientCount: !hasBand ? notificationCount : 0,
        },
      });

      return {
        musicScaleId,
        version: nextRevision,
        createdNotificationCount: notificationCount,
        createdResponseCount,
        eventAssignmentCount: newEventAssignments.length,
        broadcastRecipientCount: !hasBand ? notificationCount : 0,
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
